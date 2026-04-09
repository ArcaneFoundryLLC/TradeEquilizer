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
      return NextResponse.json({ success: false, error: 'Not a participant' }, { status: 403 })
    }
    if (s.status !== 'connected') {
      return NextResponse.json({ success: false, error: 'Session must be connected' }, { status: 400 })
    }

    const recipientId = s.user_a_id === user.id ? s.user_b_id : s.user_a_id
    if (!recipientId) {
      return NextResponse.json({ success: false, error: 'Session not fully connected' }, { status: 400 })
    }

    // Price calculation
    const COND: Record<string, number> = { NM: 1, LP: 0.9, MP: 0.75, HP: 0.5 }
    const FINISH: Record<string, number> = { normal: 1, foil: 1.5, etched: 1.3, showcase: 1.2 }
    const calcTotal = (items: any[]) =>
      Math.round(items.reduce((sum: number, i: any) => {
        const base = i.currentPrice || 10
        return sum + base * (COND[i.condition] || 1) * (FINISH[i.finish] || 1) * i.quantity
      }, 0) * 100) / 100

    const proposerTotal = calcTotal(body.proposerItems)
    const recipientTotal = calcTotal(body.recipientItems)

    // Determine which side is A and which is B based on session roles
    const isUserA = s.user_a_id === user.id
    const itemsFromA = isUserA ? body.proposerItems : body.recipientItems
    const itemsFromB = isUserA ? body.recipientItems : body.proposerItems
    const valueA = isUserA ? proposerTotal : recipientTotal
    const valueB = isUserA ? recipientTotal : proposerTotal

    // Insert into the actual trade_proposals table (001 schema)
    const { data: row, error: insertError } = await (supabase as any)
      .from('trade_proposals')
      .insert({
        session_id: body.sessionId,
        proposed_by: user.id,
        items_from_a: itemsFromA,
        items_from_b: itemsFromB,
        value_a: valueA,
        value_b: valueB,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to insert proposal:', insertError)
      return NextResponse.json({ success: false, error: 'Failed to create proposal' }, { status: 500 })
    }

    // Map DB row back to the frontend TradeProposal shape
    const fairness = proposerTotal === 0 && recipientTotal === 0 ? 0
      : proposerTotal === 0 ? 100
      : Math.round(((recipientTotal - proposerTotal) / proposerTotal * 100) * 100) / 100

    const proposal = {
      id: row.id,
      sessionId: body.sessionId,
      proposerId: user.id,
      recipientId,
      proposerItems: body.proposerItems,
      recipientItems: body.recipientItems,
      proposerTotalValue: proposerTotal,
      recipientTotalValue: recipientTotal,
      fairnessPercentage: fairness,
      priceVersion: 'current',
      status: 'pending',
      message: body.message,
      createdAt: row.created_at,
      updatedAt: row.created_at,
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

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ success: true, proposals: [] })
    }

    // Verify user is a participant in this session
    const { data: session } = await supabase
      .from('trade_sessions')
      .select('user_a_id, user_b_id')
      .eq('id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json({ success: true, proposals: [] })
    }

    const s = session as any
    if (s.user_a_id !== user.id && s.user_b_id !== user.id) {
      return NextResponse.json({ success: true, proposals: [] })
    }

    const isUserA = s.user_a_id === user.id

    // Fetch proposals for this session
    const { data: rows, error } = await (supabase as any)
      .from('trade_proposals')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    if (error || !rows) {
      console.error('Failed to fetch proposals:', error)
      return NextResponse.json({ success: true, proposals: [] })
    }

    // Map DB rows to frontend shape
    const proposals = rows.map((row: any) => {
      const iAmProposer = row.proposed_by === user.id
      // items_from_a = items user A is giving, items_from_b = items user B is giving
      // If I'm user A and I proposed: my items = items_from_a, their items = items_from_b
      // If I'm user B and I proposed: my items = items_from_b, their items = items_from_a
      const proposerItems = iAmProposer
        ? (isUserA ? row.items_from_a : row.items_from_b)
        : (isUserA ? row.items_from_b : row.items_from_a)
      const recipientItems = iAmProposer
        ? (isUserA ? row.items_from_b : row.items_from_a)
        : (isUserA ? row.items_from_a : row.items_from_b)

      const proposerTotal = iAmProposer
        ? (isUserA ? Number(row.value_a) : Number(row.value_b))
        : (isUserA ? Number(row.value_b) : Number(row.value_a))
      const recipientTotal = iAmProposer
        ? (isUserA ? Number(row.value_b) : Number(row.value_a))
        : (isUserA ? Number(row.value_a) : Number(row.value_b))

      const fairness = proposerTotal === 0 && recipientTotal === 0 ? 0
        : proposerTotal === 0 ? 100
        : Math.round(((recipientTotal - proposerTotal) / proposerTotal * 100) * 100) / 100

      const recipientId = row.proposed_by === s.user_a_id ? s.user_b_id : s.user_a_id

      return {
        id: row.id,
        sessionId: row.session_id,
        proposerId: row.proposed_by,
        recipientId,
        proposerItems: proposerItems || [],
        recipientItems: recipientItems || [],
        proposerTotalValue: proposerTotal,
        recipientTotalValue: recipientTotal,
        fairnessPercentage: fairness,
        priceVersion: 'current',
        status: row.status,
        message: null,
        createdAt: row.created_at,
        updatedAt: row.created_at,
        expiresAt: new Date(new Date(row.created_at).getTime() + 10 * 60 * 1000).toISOString(),
      }
    })

    return NextResponse.json({ success: true, proposals })
  } catch (error) {
    console.error('Error in GET /api/trades/proposals:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
