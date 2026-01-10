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

      // Type assertion for session data
      const sessionData = session as any

      if (sessionData.user_a_id !== user.id && sessionData.user_b_id !== user.id) {
        return { success: false, error: 'Not a participant in this session' }
      }

      if (sessionData.status !== 'connected') {
        return { success: false, error: 'Session must be connected to create proposals' }
      }

      // Determine recipient
      const recipientId = sessionData.user_a_id === user.id ? sessionData.user_b_id : sessionData.user_a_id
      if (!recipientId) {
        return { success: false, error: 'Session not fully connected' }
      }

      // Calculate total values (simplified for P0 - using mock pricing)
      const proposerTotal = await this.calculateItemsValue(request.proposerItems)
      const recipientTotal = await this.calculateItemsValue(request.recipientItems)

      // Calculate fairness percentage
      const fairnessPercentage = this.calculateFairness(proposerTotal, recipientTotal)

      // For P0: Create a mock proposal (database integration will be added when migration is applied)
      const mockProposal: TradeProposal = {
        id: crypto.randomUUID(),
        sessionId: request.sessionId,
        proposerId: user.id,
        recipientId: recipientId,
        proposerItems: request.proposerItems,
        recipientItems: request.recipientItems,
        proposerTotalValue: proposerTotal,
        recipientTotalValue: recipientTotal,
        fairnessPercentage: fairnessPercentage,
        priceVersion: 'current',
        status: 'pending',
        message: request.message,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now
      }

      // TODO: Replace with actual database insert when migration is applied
      console.log('Mock proposal created:', mockProposal)
      return { success: true, proposal: mockProposal }
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

      // TODO: Replace with actual database query when migration is applied
      // For now, return mock response
      const mockProposal: TradeProposal = {
        id: proposalId,
        sessionId: 'mock-session',
        proposerId: 'mock-proposer',
        recipientId: user.id,
        proposerItems: [],
        recipientItems: [],
        proposerTotalValue: 0,
        recipientTotalValue: 0,
        fairnessPercentage: 0,
        priceVersion: 'current',
        status: request.action === 'accept' ? 'accepted' : 'rejected',
        rejectionReason: request.rejectionReason,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        respondedAt: new Date().toISOString()
      }

      console.log('Mock proposal response:', mockProposal)
      return { success: true, proposal: mockProposal }
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
      // TODO: Replace with actual database query when migration is applied
      console.log('Mock getSessionProposals for session:', sessionId)
      return []
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
      // TODO: Replace with actual database query when migration is applied
      console.log('Mock getUserProposals')
      return []
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
      // TODO: Replace with actual database query when migration is applied
      console.log('Mock cancelProposal:', proposalId)
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
}

// Cleanup function to be called periodically (simplified for P0)
export async function cleanupExpiredProposals(): Promise<number> {
  try {
    // Update expired proposals (with type assertion for tables that may not exist yet)
    const { error: updateError } = await (supabase as any)
      .from('trade_proposals')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())
    
    if (updateError) {
      console.error('Error cleaning up expired proposals:', updateError)
      return 0
    }
    
    // Delete expired reservations (with type assertion for tables that may not exist yet)
    const { error: deleteError } = await (supabase as any)
      .from('item_reservations')
      .delete()
      .lt('expires_at', new Date().toISOString())
    
    if (deleteError) {
      console.error('Error cleaning up expired reservations:', deleteError)
    }
    
    return 1 // Return success indicator
  } catch (error) {
    console.error('Error in cleanupExpiredProposals:', error)
    return 0
  }
}