import { createClient } from '@/lib/supabase/client'
import { TradeProposal, TradeItem, CreateProposalRequest, RespondToProposalRequest } from '@/types'

const supabase = createClient()

export class TradeProposalService {
  /**
   * Create a new trade proposal
   */
  static async createProposal(request: CreateProposalRequest): Promise<{
    success: boolean
    proposal?: TradeProposal
    error?: string
  }> {
    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return { success: false, error: 'Authentication required' }
      }

      // Validate session exists and user is participant
      const { data: session, error: sessionError } = await supabase
        .from('trade_sessions')
        .select('*')
        .eq('id', request.sessionId)
        .single()

      if (sessionError || !session) {
        return { success: false, error: 'Session not found' }
      }

      if (session.user_a_id !== user.id && session.user_b_id !== user.id) {
        return { success: false, error: 'Not a participant in this session' }
      }

      if (session.status !== 'connected') {
        return { success: false, error: 'Session must be connected to create proposals' }
      }

      // Determine recipient
      const recipientId = session.user_a_id === user.id ? session.user_b_id : session.user_a_id
      if (!recipientId) {
        return { success: false, error: 'Session not fully connected' }
      }

      // Calculate total values (simplified for P0 - using mock pricing)
      const proposerTotal = await this.calculateItemsValue(request.proposerItems)
      const recipientTotal = await this.calculateItemsValue(request.recipientItems)

      // Calculate fairness percentage
      const fairnessPercentage = this.calculateFairness(proposerTotal, recipientTotal)

      // Create proposal with reservation
      const { data: proposal, error: createError } = await supabase.rpc(
        'create_trade_proposal_with_reservations',
        {
          p_session_id: request.sessionId,
          p_proposer_id: user.id,
          p_recipient_id: recipientId,
          p_proposer_items: JSON.stringify(request.proposerItems),
          p_recipient_items: JSON.stringify(request.recipientItems),
          p_proposer_total: proposerTotal,
          p_recipient_total: recipientTotal,
          p_fairness_percentage: fairnessPercentage,
          p_message: request.message || null
        }
      )

      if (createError) {
        console.error('Error creating proposal:', createError)
        return { success: false, error: createError.message }
      }

      // Fetch the created proposal with full details
      const createdProposal = await this.getProposalById(proposal.id)
      if (!createdProposal) {
        return { success: false, error: 'Failed to retrieve created proposal' }
      }

      return { success: true, proposal: createdProposal }
    } catch (error) {
      console.error('Error in createProposal:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }
    }
  }

  /**
   * Respond to a trade proposal (accept/reject)
   */
  static async respondToProposal(
    proposalId: string, 
    request: RespondToProposalRequest
  ): Promise<{
    success: boolean
    proposal?: TradeProposal
    error?: string
  }> {
    try {
      // Get current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return { success: false, error: 'Authentication required' }
      }

      // Get proposal and verify user is recipient
      const { data: proposal, error: proposalError } = await supabase
        .from('trade_proposals')
        .select('*')
        .eq('id', proposalId)
        .single()

      if (proposalError || !proposal) {
        return { success: false, error: 'Proposal not found' }
      }

      if (proposal.recipient_id !== user.id) {
        return { success: false, error: 'Only the recipient can respond to this proposal' }
      }

      if (proposal.status !== 'pending') {
        return { success: false, error: 'Proposal is no longer pending' }
      }

      // Check if proposal has expired
      if (new Date(proposal.expires_at) < new Date()) {
        await supabase
          .from('trade_proposals')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', proposalId)
        
        return { success: false, error: 'Proposal has expired' }
      }

      // Update proposal status
      const newStatus = request.action === 'accept' ? 'accepted' : 'rejected'
      const updateData: any = {
        status: newStatus,
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      if (request.action === 'reject' && request.rejectionReason) {
        updateData.rejection_reason = request.rejectionReason
      }

      const { error: updateError } = await supabase
        .from('trade_proposals')
        .update(updateData)
        .eq('id', proposalId)

      if (updateError) {
        console.error('Error updating proposal:', updateError)
        return { success: false, error: updateError.message }
      }

      // If accepted, update session status to completed
      if (request.action === 'accept') {
        await supabase
          .from('trade_sessions')
          .update({ 
            status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', proposal.session_id)
      }

      // Clean up reservations if rejected
      if (request.action === 'reject') {
        await supabase
          .from('item_reservations')
          .delete()
          .eq('proposal_id', proposalId)
      }

      // Fetch updated proposal
      const updatedProposal = await this.getProposalById(proposalId)
      if (!updatedProposal) {
        return { success: false, error: 'Failed to retrieve updated proposal' }
      }

      return { success: true, proposal: updatedProposal }
    } catch (error) {
      console.error('Error in respondToProposal:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }
    }
  }

  /**
   * Get proposals for a session
   */
  static async getSessionProposals(sessionId: string): Promise<TradeProposal[]> {
    try {
      const { data: proposals, error } = await supabase
        .from('trade_proposals')
        .select(`
          *,
          proposer:proposer_id(email),
          recipient:recipient_id(email)
        `)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching session proposals:', error)
        return []
      }

      return proposals?.map(this.mapDatabaseProposal) || []
    } catch (error) {
      console.error('Error in getSessionProposals:', error)
      return []
    }
  }

  /**
   * Get proposals for current user (as proposer or recipient)
   */
  static async getUserProposals(): Promise<TradeProposal[]> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return []
      }

      const { data: proposals, error } = await supabase
        .from('trade_proposals')
        .select(`
          *,
          proposer:proposer_id(email),
          recipient:recipient_id(email),
          session:session_id(qr_code, status)
        `)
        .or(`proposer_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching user proposals:', error)
        return []
      }

      return proposals?.map(this.mapDatabaseProposal) || []
    } catch (error) {
      console.error('Error in getUserProposals:', error)
      return []
    }
  }

  /**
   * Cancel a proposal (only by proposer)
   */
  static async cancelProposal(proposalId: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return { success: false, error: 'Authentication required' }
      }

      // Verify user is proposer and proposal is pending
      const { data: proposal, error: proposalError } = await supabase
        .from('trade_proposals')
        .select('*')
        .eq('id', proposalId)
        .eq('proposer_id', user.id)
        .eq('status', 'pending')
        .single()

      if (proposalError || !proposal) {
        return { success: false, error: 'Proposal not found or cannot be cancelled' }
      }

      // Update status to cancelled
      const { error: updateError } = await supabase
        .from('trade_proposals')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', proposalId)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      // Clean up reservations
      await supabase
        .from('item_reservations')
        .delete()
        .eq('proposal_id', proposalId)

      return { success: true }
    } catch (error) {
      console.error('Error in cancelProposal:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }
    }
  }

  /**
   * Get a single proposal by ID
   */
  private static async getProposalById(proposalId: string): Promise<TradeProposal | null> {
    try {
      const { data: proposal, error } = await supabase
        .from('trade_proposals')
        .select(`
          *,
          proposer:proposer_id(email),
          recipient:recipient_id(email)
        `)
        .eq('id', proposalId)
        .single()

      if (error || !proposal) {
        return null
      }

      return this.mapDatabaseProposal(proposal)
    } catch (error) {
      console.error('Error in getProposalById:', error)
      return null
    }
  }

  /**
   * Calculate total value of items (simplified for P0)
   */
  private static async calculateItemsValue(items: TradeItem[]): Promise<number> {
    // For P0, use mock pricing - in production this would fetch real prices
    let total = 0
    
    for (const item of items) {
      // Mock price calculation based on condition
      let basePrice = 10 // Default $10 per card for P0
      
      // Condition multipliers
      const conditionMultipliers = {
        'NM': 1.0,
        'LP': 0.9,
        'MP': 0.75,
        'HP': 0.5
      }
      
      // Finish multipliers
      const finishMultipliers = {
        'normal': 1.0,
        'foil': 1.5,
        'etched': 1.3,
        'showcase': 1.2
      }
      
      const conditionMultiplier = conditionMultipliers[item.condition] || 1.0
      const finishMultiplier = finishMultipliers[item.finish] || 1.0
      
      const itemValue = basePrice * conditionMultiplier * finishMultiplier * item.quantity
      total += itemValue
    }
    
    return Math.round(total * 100) / 100 // Round to 2 decimal places
  }

  /**
   * Calculate fairness percentage between two values
   */
  private static calculateFairness(proposerValue: number, recipientValue: number): number {
    if (proposerValue === 0 && recipientValue === 0) return 0
    if (proposerValue === 0) return 100
    if (recipientValue === 0) return -100
    
    return Math.round(((recipientValue - proposerValue) / proposerValue * 100) * 100) / 100
  }

  /**
   * Map database proposal to TypeScript interface
   */
  private static mapDatabaseProposal(dbProposal: any): TradeProposal {
    return {
      id: dbProposal.id,
      sessionId: dbProposal.session_id,
      proposerId: dbProposal.proposer_id,
      recipientId: dbProposal.recipient_id,
      proposerItems: JSON.parse(dbProposal.proposer_items || '[]'),
      recipientItems: JSON.parse(dbProposal.recipient_items || '[]'),
      proposerTotalValue: parseFloat(dbProposal.proposer_total_value || '0'),
      recipientTotalValue: parseFloat(dbProposal.recipient_total_value || '0'),
      fairnessPercentage: parseFloat(dbProposal.fairness_percentage || '0'),
      priceVersion: dbProposal.price_version || 'current',
      status: dbProposal.status,
      message: dbProposal.message,
      rejectionReason: dbProposal.rejection_reason,
      createdAt: dbProposal.created_at,
      updatedAt: dbProposal.updated_at,
      expiresAt: dbProposal.expires_at,
      respondedAt: dbProposal.responded_at
    }
  }
}

// Cleanup function to be called periodically
export async function cleanupExpiredProposals(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('cleanup_expired_proposals')
    
    if (error) {
      console.error('Error cleaning up expired proposals:', error)
      return 0
    }
    
    return data || 0
  } catch (error) {
    console.error('Error in cleanupExpiredProposals:', error)
    return 0
  }
}