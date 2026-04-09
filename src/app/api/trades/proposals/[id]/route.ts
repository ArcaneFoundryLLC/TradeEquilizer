import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proposalId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    if (!body.action || !['accept', 'reject'].includes(body.action)) {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    // Update the proposal status in the DB
    const newStatus = body.action === 'accept' ? 'accepted' : 'rejected'
    const { data: row, error: updateError } = await (supabase as any)
      .from('trade_proposals')
      .update({ status: newStatus })
      .eq('id', proposalId)
      .select()
      .single()

    if (updateError || !row) {
      console.error('Failed to update proposal:', updateError)
      return NextResponse.json({ success: false, error: 'Proposal not found' }, { status: 404 })
    }

    // If accepted, mark the session as completed
    if (body.action === 'accept') {
      await (supabase as any)
        .from('trade_sessions')
        .update({ status: 'completed' })
        .eq('id', row.session_id)
    }

    return NextResponse.json({ success: true, proposal: row })
  } catch (error) {
    console.error('Error in PATCH /api/trades/proposals/[id]:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proposalId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const { error: deleteError } = await (supabase as any)
      .from('trade_proposals')
      .delete()
      .eq('id', proposalId)
      .eq('proposed_by', user.id)

    if (deleteError) {
      return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/trades/proposals/[id]:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
