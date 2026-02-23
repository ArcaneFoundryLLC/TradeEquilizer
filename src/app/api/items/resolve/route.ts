import { NextRequest, NextResponse } from 'next/server'
import { createClient} from '@/lib/supabase/server'

// GET /api/items/resolve?id=<id-or-scryfall-id>
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = (searchParams.get('id') || '').trim()
    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 })
    }

    const supa = await createClient()

    // Try to find by internal id first
    try {
      const { data: byId } = await (supa as any).from('items').select('id').eq('id', id).maybeSingle()
      if (byId && byId.id) {
        return NextResponse.json({ id: byId.id })
      }

      // Try by scryfall_id
      const { data: byScry } = await (supa as any).from('items').select('id').eq('scryfall_id', id).maybeSingle()
      if (byScry && byScry.id) {
        return NextResponse.json({ id: byScry.id })
      }
    } catch (e) {
      console.error('DB lookup failed:', e)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // If not found, try to fetch from Scryfall and insert a minimal item record
    try {
      const sfRes = await fetch(`https://api.scryfall.com/cards/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json', 'User-Agent': 'TradeEqualizer/0.1' }, cache: 'no-store' })
      if (!sfRes.ok) {
        const text = await sfRes.text().catch(() => '')
        console.error('Scryfall fetch failed:', sfRes.status, text)
        return NextResponse.json({ error: 'Unable to resolve id via Scryfall' }, { status: 400 })
      }

      const card = await sfRes.json()

      if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY not set; cannot insert item')
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
      }

      const svc = await createClient()
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

      if (!newItem || !newItem.id) {
        return NextResponse.json({ error: 'Failed to create item record' }, { status: 500 })
      }

      return NextResponse.json({ id: newItem.id })
    } catch (e) {
      console.error('Error resolving/inserting item:', e)
      return NextResponse.json({ error: 'Unable to resolve id' }, { status: 400 })
    }
  } catch (e) {
    console.error('Unexpected error in items/resolve:', e)
    return NextResponse.json({ error: 'Unhandled error', details: String(e) }, { status: 500 })
  }
}
