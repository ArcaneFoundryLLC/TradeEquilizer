import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const client = await createClient()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  if (!body) return NextResponse.json({ error: 'Missing request body' }, { status: 400 })

  const inventoryId = params.id
  const updates = body

  try {
    const supa: any = client
    const { data: updated, error: updateError } = await supa
      .from('inventory')
      .update(updates)
      .eq('id', inventoryId)
      .eq('user_id', userData.user.id)
      .select()

    if (updateError) {
      console.error('Inventory update error:', updateError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Inventory not found' }, { status: 404 })
    }

    const row = Array.isArray(updated) ? updated[0] : updated

    // Attach item info
    const { data: itemRow } = await supa.from('items').select('id, name, set_code, collector_number, image_url').eq('id', row.item_id).maybeSingle()

    const response = {
      id: row.id,
      itemId: row.item_id,
      itemName: itemRow?.name ?? null,
      itemSet: itemRow?.set_code ?? null,
      itemCollectorNumber: itemRow?.collector_number ?? null,
      itemImageUrl: itemRow?.image_url ?? null,
      quantity: row.quantity,
      condition: row.condition,
      language: row.language,
      finish: row.finish,
      tradable: row.tradable,
      acquiredAt: row.acquired_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (e) {
    console.error('Error updating inventory:', e)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const client = await createClient()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const inventoryId = params.id
  try {
    const supa: any = client
    const { data: deleted, error: deleteError } = await supa
      .from('inventory')
      .delete()
      .eq('id', inventoryId)
      .eq('user_id', userData.user.id)
      .select()

    if (deleteError) {
      console.error('Inventory delete error:', deleteError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Inventory not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Inventory deleted' }, { status: 200 })
  } catch (e) {
    console.error('Error deleting inventory:', e)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
