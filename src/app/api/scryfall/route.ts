import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory caches. Acceptable for small scale and SSR runtime.
// For production scale, replace with an external store (e.g., Redis) or Edge caching.
const queryCache = new Map<string, { timestamp: number; payload: unknown }>()
const ipLastRequestAt = new Map<string, number>()

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const MIN_DELAY_BETWEEN_REQUESTS_MS = 100 // Scryfall suggests 50-100ms between requests

function getClientIp(request: NextRequest): string {
  // Honor common proxy headers; fall back to remote address
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  // Not always available in serverless, so default
  return 'unknown'
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q) {
    return NextResponse.json(
      { error: 'Missing required query param: q' },
      { status: 400 }
    )
  }

  // Cache key can include the full query string to differentiate flags
  const cacheKey = `scryfall:search:${q}`
  const now = Date.now()

  // Serve from cache if fresh
  const cached = queryCache.get(cacheKey)
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.payload, {
      headers: {
        'Cache-Control': 'public, max-age=60',
      },
    })
  }

  // Per-IP minimal throttling
  const ip = getClientIp(request)
  const lastAt = ipLastRequestAt.get(ip) ?? 0
  const elapsed = now - lastAt
  if (elapsed < MIN_DELAY_BETWEEN_REQUESTS_MS) {
    // Wait the remaining time to respect min delay
    const waitMs = MIN_DELAY_BETWEEN_REQUESTS_MS - elapsed
    await new Promise((r) => setTimeout(r, waitMs))
  }

  try {
    const scryUrl = new URL('https://api.scryfall.com/cards/search')
    // Forward all incoming params (q, order, dir, page, unique, etc.)
    searchParams.forEach((value, key) => {
      if (value != null) scryUrl.searchParams.set(key, value)
    })

    const upstream = await fetch(scryUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TradeEqualizer/0.1 (+github)'
      },
      // Revalidate frequently
      cache: 'no-store',
      next: { revalidate: 0 },
    })

    ipLastRequestAt.set(ip, Date.now())

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')

      // If Scryfall returned a 404 "not_found" (no matching cards), treat it as an empty
      // result set for the frontend autocomplete instead of surfacing an error.
      // Scryfall returns a JSON error object for 404s, so try to detect that.
      if (upstream.status === 404) {
        try {
          // Prefer returning the Scryfall shape the client expects: { data: [] }
          return NextResponse.json({ data: [] }, {
            headers: {
              'Cache-Control': 'public, max-age=30',
            },
          })
        } catch (e) {
          // Fall through to return a safe empty result
          return NextResponse.json({ data: [] }, { headers: { 'Cache-Control': 'public, max-age=30' } })
        }
      }

      return NextResponse.json(
        { error: 'Upstream error', status: upstream.status, details: text },
        { status: 502 }
      )
    }

    const data = await upstream.json()
    // Cache result
    queryCache.set(cacheKey, { timestamp: Date.now(), payload: data })

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Request failed', details: String(error) },
      { status: 500 }
    )
  }
}


