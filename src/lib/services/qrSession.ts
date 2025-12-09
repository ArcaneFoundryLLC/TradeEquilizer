import { createClient } from '@/lib/supabase/server'
import { TradeSession, CreateSessionRequest, SessionResponse } from '@/types'
import { Database } from '@/types/supabase'

type TradeSessionRow = Database['public']['Tables']['trade_sessions']['Row']
type TradeSessionInsert = Database['public']['Tables']['trade_sessions']['Insert']

const QR_TOKEN_TTL_MINUTES = 2
const QR_RATE_LIMIT_PER_MINUTE = 10

export class QRSessionService {
  /**
   * Create a new trading session with a single-use QR code
   */
  static async createSession(
    userId: string,
    ipAddress: string,
    request: CreateSessionRequest = {}
  ): Promise<SessionResponse> {
    const supabase = await createClient()

    try {
      // Check rate limiting (10 sessions per minute per IP)
      const { data: rateLimitOk, error: rateLimitError } = await (supabase as any)
        .rpc('check_qr_rate_limit', {
          p_ip_address: ipAddress
        })

      if (rateLimitError) {
        console.error('Rate limit check error:', rateLimitError)
        throw new Error('Rate limit check failed')
      }

      if (!rateLimitOk) {
        throw new Error('Rate limit exceeded. Maximum 10 sessions per minute.')
      }

      // Generate unique QR code
      const { data: qrCode, error: qrError } = await (supabase as any)
        .rpc('generate_qr_code')

      if (qrError || !qrCode) {
        console.error('QR code generation error:', qrError)
        throw new Error('Failed to generate QR code')
      }

      // Calculate expiration (2 minutes from now)
      const expiresAt = new Date()
      expiresAt.setMinutes(expiresAt.getMinutes() + QR_TOKEN_TTL_MINUTES)

      // Create session
      const sessionData: TradeSessionInsert = {
        qr_code: qrCode,
        user_a_id: userId,
        game: request.game || 'mtg',
        price_source: request.priceSource || 'tcgplayer_market',
        fairness_threshold: request.fairnessThreshold || 5.0,
        currency: 'USD',
        status: 'waiting',
        event_id: request.eventId || null,
        expires_at: expiresAt.toISOString()
      }

      const { data: session, error: sessionError } = await supabase
        .from('trade_sessions')
        .insert(sessionData as any)
        .select()
        .single()

      if (sessionError || !session) {
        console.error('Session creation error:', sessionError)
        throw new Error('Failed to create trading session')
      }

      return {
        session: this.dbRowToSession(session as any),
        isCreator: true
      }
    } catch (error) {
      console.error('Error creating session:', error)
      throw error
    }
  }

  /**
   * Join an existing session using a QR code
   */
  static async joinSession(
    userId: string,
    qrCode: string
  ): Promise<SessionResponse> {
    const supabase = await createClient()

    try {
      // Find session by QR code
      const { data: session, error: findError } = await supabase
        .from('trade_sessions')
        .select('*')
        .eq('qr_code', qrCode)
        .single()

      if (findError || !session) {
        if (findError?.code === 'PGRST116') {
          throw new Error('Invalid QR code')
        }
        console.error('Session lookup error:', findError)
        throw new Error('Failed to find session')
      }

      const sessionRow = session as any as TradeSessionRow

      // Check if session has expired
      if (new Date(sessionRow.expires_at) < new Date()) {
        throw new Error('QR code has expired. Please generate a new one.')
      }

      // Check if session is still waiting
      if (sessionRow.status !== 'waiting') {
        throw new Error('This session is no longer available')
      }

      // Check if user is trying to join their own session
      if (sessionRow.user_a_id === userId) {
        throw new Error('You cannot join your own trading session')
      }

      // Check if session already has a second user
      if (sessionRow.user_b_id) {
        throw new Error('This session already has two participants')
      }

      // Update session with second user
      const { data: updatedSession, error: updateError } = await (supabase
        .from('trade_sessions') as any)
        .update({
          user_b_id: userId,
          status: 'connected'
        })
        .eq('id', sessionRow.id)
        .select()
        .single()

      if (updateError || !updatedSession) {
        console.error('Session update error:', updateError)
        throw new Error('Failed to join session')
      }

      return {
        session: this.dbRowToSession(updatedSession as any),
        isCreator: false
      }
    } catch (error) {
      console.error('Error joining session:', error)
      throw error
    }
  }

  /**
   * Get session by ID
   */
  static async getSession(sessionId: string, userId: string): Promise<TradeSession | null> {
    const supabase = await createClient()

    try {
      const { data: session, error } = await supabase
        .from('trade_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null
        }
        throw new Error(`Failed to fetch session: ${error.message}`)
      }

      const sessionRow = session as any as TradeSessionRow

      // Verify user is a participant
      if (sessionRow.user_a_id !== userId && sessionRow.user_b_id !== userId) {
        throw new Error('Unauthorized: You are not a participant in this session')
      }

      return this.dbRowToSession(sessionRow)
    } catch (error) {
      console.error('Error fetching session:', error)
      throw error
    }
  }

  /**
   * Cancel a session
   */
  static async cancelSession(sessionId: string, userId: string): Promise<void> {
    const supabase = await createClient()

    try {
      // Verify user is the creator
      const { data: session, error: fetchError } = await supabase
        .from('trade_sessions')
        .select('user_a_id, status')
        .eq('id', sessionId)
        .single()

      if (fetchError || !session) {
        throw new Error('Session not found')
      }

      if ((session as any).user_a_id !== userId) {
        throw new Error('Only the session creator can cancel')
      }

      if ((session as any).status === 'completed') {
        throw new Error('Cannot cancel a completed session')
      }

      // Update session status
      const { error: updateError } = await (supabase
        .from('trade_sessions') as any)
        .update({ status: 'cancelled' })
        .eq('id', sessionId)

      if (updateError) {
        throw new Error(`Failed to cancel session: ${updateError.message}`)
      }
    } catch (error) {
      console.error('Error cancelling session:', error)
      throw error
    }
  }

  /**
   * Clean up expired sessions (called by background job)
   */
  static async cleanupExpiredSessions(): Promise<{ deleted: number }> {
    const supabase = await createClient()

    try {
      const { error } = await (supabase as any).rpc('cleanup_expired_data')

      if (error) {
        console.error('Cleanup error:', error)
        throw new Error('Failed to cleanup expired sessions')
      }

      // Note: The function doesn't return count, but we can query
      const { count } = await supabase
        .from('trade_sessions')
        .select('*', { count: 'exact', head: true })
        .lt('expires_at', new Date().toISOString())
        .in('status', ['waiting', 'connected'])

      return { deleted: count || 0 }
    } catch (error) {
      console.error('Error cleaning up sessions:', error)
      throw error
    }
  }

  /**
   * Convert database row to TradeSession type
   */
  private static dbRowToSession(row: TradeSessionRow): TradeSession {
    return {
      id: row.id,
      qrCode: row.qr_code,
      userAId: row.user_a_id,
      userBId: row.user_b_id || undefined,
      game: 'mtg',
      priceSource: 'tcgplayer_market',
      fairnessThreshold: row.fairness_threshold,
      currency: 'USD',
      status: row.status as 'waiting' | 'connected' | 'proposing' | 'completed' | 'cancelled',
      eventId: row.event_id || undefined,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }
  }
}
