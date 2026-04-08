import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CreateProposalRequest } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body: CreateProposalRequest = await request.json()

    if (!body.sessionId || !body.proposerItems || !body.recipientItems) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }
    if (!Array.isArray(body.proposerItems) || !Array.isArray(body.recipientItems)) {
      return NextResponse.json({ success: false, error: 'Items must be arrays' }, { status: 400 })
    }
    if (body.proposerItems.length === 0 && body.recipientItems.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one side must have items' }, { status: 400 })
    }

    const validateItems = (items: any[]) =>
      items.every(item =>
        item.itemId &&
        typeof item.quantity === 'number' && item.quantity > 0 &&
        ['NM', 'LP', 'MP', 'HP'].includes(item.condition) &&
        ['normal', 'foil', 'etched', 'showcase'].includes(item.finish) &&
        typeof item.language === 'string'
      )

    if (!validateItems(body.proposerItems) || !validateItems(body.recipientItems)) {
      return NextResponse.json({ success: false, error: 'Invalid item structure' }, { status: 400 })
    }

    // Look up the session
    const { data: session, error: sessionError } = await supabase
      .from('trade_sessions')
      .select('*')
      .eq('id', body.sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
    }

    const s = session as any
    if (s.user_a_id !== user.id && s.user_b_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Not a participant in this session' }, { status: 403 })
    }
    if (s.status !== 'connected') {
      return NextResponse.json({ success: false, error: 'Session must be connected to create proposals' }, { status: 400 })
    }

    const recipientId = s.user_a_id === user.id ? s.user_b_id : s.user_a_id
    if (!recipientId) {
      return NextResponse.json({ success: false, error: 'Session not fully connected' }, { status: 400 })
    }

    // Simple price calculation (condition + finish multipliers)
    const COND: Record<string, number> = { NM: 1, LP: 0.9, MP: 0.75, HP: 0.5 }
    const FINISH: Record<string, number> = { normal: 1, foil: 1.5, etched: 1.3, showcase: 1.2 }
    const calcTotal = (items: any[]) =>
      Math.round(items.reduce((sum: number, i: any) => {
        const base = i.currentPrice || 10
        return sum + base * (COND[i.condition] || 1) * (FINISH[i.finish] || 1) * i.quantity
      }, 0) * 100) / 100

    const proposerTotal = calcTotal(body.proposerItems)
    const recipientTotal = calcTotal(body.recipientItems)
    const fairness = proposerTotal === 0 && recipientTotal === 0 ? 0
      : proposerTotal === 0 ? 100
      : Math.round(((recipientTotal - proposerTotal) / proposerTotal * 100) * 100) / 100

    const proposal = {
      id: crypto.randomUUID(),
      sessionId: body.sessionId,
      proposerId: user.id,
      recipientId,
      proposerItems: body.proposerItems,
      recipientItems: body.recipientItems,
      proposerTotalValue: proposerTotal,
      recipientTotalValue: recipientTotal,
      fairnessPercentage: fairness,
      priceVersion: 'current',
      status: 'pending' as const,
      message: body.message,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }

    return NextResponse.json({ success: true, proposal }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/trades/proposals:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: true, proposals: [] })
    }

    // For now return empty — proposals are returned inline from POST
    return NextResponse.json({ success: true, proposals: [] })
  } catch (error) {
    console.error('Error in GET /api/trades/proposals:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
