import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/cards/search?q=black%20lotus&limit=24&page=1
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = (searchParams.get('q') || '').trim()
    const limit = Math.min(Number(searchParams.get('limit') || 24), 50)
    const page = Math.max(Number(searchParams.get('page') || 1), 1)
    const from = (page - 1) * limit
    const to = from + limit - 1

    const supabase = await createClient()

    // Build filters once
    const buildFilter = (qb: any) => {
      let qbx = qb.eq('game', 'mtg')
      if (q) {
        const escaped = q.replace(/[,]/g, ' ')
        qbx = qbx.or(
          `name.ilike.%${escaped}%,collector_number.ilike.%${escaped}%,set_code.ilike.%${escaped}%`
        )
      }
      return qbx
    }

    // First, count total results to avoid out-of-range errors
    const countQuery = buildFilter(
      supabase.from('items').select('id', { count: 'exact', head: true })
    )
    const { count: totalCount, error: countError } = (await countQuery) as unknown as {
      count: number | null; error: { message: string } | null
    }
    if (countError) {
      return NextResponse.json(
        { error: 'DB count failed', details: countError.message },
        { status: 500 }
      )
    }
    if ((totalCount ?? 0) === 0 || from >= (totalCount ?? 0)) {
      return NextResponse.json({ data: [], total: totalCount ?? 0, page, limit }, {
        headers: { 'Cache-Control': 'public, max-age=15' },
      })
    }

    // Fetch the current page
    let query = buildFilter(
      supabase
        .from('items')
        .select('id,name,set_code,collector_number,image_url', { count: 'exact' })
        .range(from, to)
    )

    type ItemRow = {
      id: string
      name: string
      set_code: string
      collector_number: string
      image_url: string | null
    }
    const { data, error, count } = await query as unknown as {
      data: ItemRow[] | null; error: { message: string } | null; count: number | null
    }
    if (error) {
      return NextResponse.json(
        { error: 'DB query failed', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        data: (data || []).map((row: ItemRow) => ({
          id: row.id,
          name: row.name,
          set: row.set_code,
          collector_number: row.collector_number,
          image_uris: row.image_url ? { small: row.image_url, normal: row.image_url } : undefined,
        })),
        total: count ?? 0,
        page,
        limit,
      },
      { headers: { 'Cache-Control': 'public, max-age=30' } }
    )
  } catch (e) {
    return NextResponse.json(
      { error: 'Unhandled error', details: String(e) },
      { status: 500 }
    )
  }
}


