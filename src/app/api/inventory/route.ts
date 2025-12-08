import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const client = await createClient()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supa: any = client
    // Return inventory rows joined with item info
    const { data, error } = await supa
      .from('inventory')
      .select(`id, item_id, quantity, condition, language, finish, tradable, acquired_at, created_at, updated_at, items(id, name, set_code, collector_number, image_url)`)
      .eq('user_id', userData.user.id)

    if (error) {
      console.error('Inventory GET error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Normalize shape to what the frontend expects
    const mapped = (data || []).map((row: any) => ({
      id: row.id,
      itemId: row.item_id,
      itemName: row.items?.name ?? null,
      itemSet: row.items?.set_code ?? null,
      itemCollectorNumber: row.items?.collector_number ?? null,
      itemImageUrl: row.items?.image_url ?? null,
      quantity: row.quantity,
      condition: row.condition,
      language: row.language,
      finish: row.finish,
      tradable: row.tradable,
      acquiredAt: row.acquired_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return NextResponse.json({ data: mapped }, { status: 200 })
  } catch (e) {
    console.error('Error fetching inventory:', e)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body) {
    return NextResponse.json({ error: 'Missing request body' }, { status: 400 })
  }

  const client = await createClient()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supa: any = client

  // Validate required fields
  const { itemId, quantity, condition, language, finish, tradable } = body
  if (!itemId || typeof itemId !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid itemId' }, { status: 400 })
  }
  if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
    return NextResponse.json({ error: 'Missing or invalid quantity' }, { status: 400 })
  }

  // Resolve item: by id or scryfall id, create if necessary
  let resolvedItemId: string | null = null
  try {
    const { data: byId } = await supa.from('items').select('id').eq('id', itemId).maybeSingle()
    if (byId && byId.id) resolvedItemId = byId.id
    else {
      const { data: byScry } = await supa.from('items').select('id').eq('scryfall_id', itemId).maybeSingle()
      if (byScry && byScry.id) resolvedItemId = byScry.id
    }
  } catch (e) {
    console.error('Error resolving item:', e)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  if (!resolvedItemId) {
    // Try Scryfall fetch and insert minimal item using service client
    try {
      const sfRes = await fetch(`https://api.scryfall.com/cards/${encodeURIComponent(itemId)}`, { headers: { Accept: 'application/json', 'User-Agent': 'TradeEqualizer/0.1' }, cache: 'no-store' })
      if (!sfRes.ok) {
        const text = await sfRes.text().catch(() => '')
        console.error('Scryfall fetch failed:', sfRes.status, text)
        return NextResponse.json({ error: 'Unable to resolve card id' }, { status: 400 })
      }
      const card = await sfRes.json()

      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is not set; cannot insert item')
        return NextResponse.json({ error: 'Server configuration error', details: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
      }
      const svc = await createServiceClient()
      const { data: newItem, error: insertErr } = await (svc as any)
        .from('items')
        .insert({
          scryfall_id: card.id,
          name: card.name ?? 'Unknown',
          set_code: card.set ?? 'unknown',
          collector_number: card.collector_number ?? '0',
          image_url: card.image_uris?.normal ?? null,
        })
        .select()
        .maybeSingle()

      if (insertErr) {
        console.error('Failed to insert item via service client:', insertErr)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }

      resolvedItemId = newItem?.id ?? null
      if (!resolvedItemId) return NextResponse.json({ error: 'Failed to create item record' }, { status: 500 })
    } catch (e) {
      console.error('Error fetching/inserting Scryfall item:', e)
      return NextResponse.json({ error: 'Unable to resolve card id' }, { status: 400 })
    }
  }

  // Ensure users row exists (RLS) similar to wants endpoint
  try {
    const { data: existingUser } = await supa.from('users').select('id').eq('id', userData.user.id).maybeSingle()
    if (!existingUser) {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('SUPABASE_SERVICE_ROLE_KEY is not set; cannot create users row')
        return NextResponse.json({ error: 'Server configuration error', details: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
      }
      try {
        const svc = await createServiceClient()
        const upsertPayload = {
          id: userData.user.id,
          email: userData.user.email,
          name: (userData.user.user_metadata as any)?.full_name ?? userData.user.user_metadata?.name ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        const { error: upsertErr } = await (svc as any).from('users').upsert(upsertPayload)
        if (upsertErr) {
          console.error('Failed to upsert users row via service client:', upsertErr)
          return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }
      } catch (e) {
        console.error('Error creating users row via service client:', e)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
      }
    }
  } catch (e) {
    console.error('Error checking users row:', e)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Insert inventory row
  try {
    const { data: inserted, error: insertError } = await supa
      .from('inventory')
      .insert({
        user_id: userData.user.id,
        item_id: resolvedItemId,
        quantity,
        condition: condition ?? 'NM',
        language: language ?? 'en',
        finish: finish ?? 'normal',
        tradable: typeof tradable === 'boolean' ? tradable : true,
      })
      .select()

    if (insertError) {
      console.error('Inventory insert error:', insertError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const created = Array.isArray(inserted) ? inserted[0] : inserted

    // Join item info for frontend
    const { data: itemRow } = await supa.from('items').select('id, name, set_code, collector_number, image_url').eq('id', created.item_id).maybeSingle()

    const response = {
      id: created.id,
      itemId: created.item_id,
      itemName: itemRow?.name ?? null,
      itemSet: itemRow?.set_code ?? null,
      itemCollectorNumber: itemRow?.collector_number ?? null,
      itemImageUrl: itemRow?.image_url ?? null,
      quantity: created.quantity,
      condition: created.condition,
      language: created.language,
      finish: created.finish,
      tradable: created.tradable,
      acquiredAt: created.acquired_at,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    }

    return NextResponse.json(response, { status: 201 })
  } catch (e) {
    console.error('Error inserting inventory:', e)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
