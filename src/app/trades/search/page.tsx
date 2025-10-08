"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

type MockCard = {
  id: string
  name: string
  set: string
  number: string
}

type ScryfallCard = {
  id: string
  name: string
  set_name?: string
  set: string
  collector_number: string
  image_uris?: { small?: string; normal?: string }
}

type DisplayCard = {
  id: string
  name: string
  set: string
  set_name?: string
  collector_number: string
  image_uris?: { small?: string; normal?: string }
}

export default function TradeSearchPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ScryfallCard[]>([])
  const fetchAbortRef = useRef<AbortController | null>(null)

  // Placeholder mock results to visualize layout (Magic: The Gathering)
  const allCards: MockCard[] = useMemo(
    () => [
      { id: '1', name: 'Black Lotus', set: 'Alpha', number: '233' },
      { id: '2', name: 'Ancestral Recall', set: 'Alpha', number: '48' },
      { id: '3', name: 'Time Walk', set: 'Alpha', number: '285' },
      { id: '4', name: 'Tarmogoyf', set: 'Future Sight', number: '153' },
      { id: '5', name: 'Lightning Bolt', set: 'Magic 2010', number: '146' },
      { id: '6', name: 'Thoughtseize', set: 'Lorwyn', number: '145' },
    ],
    []
  )

  const filteredCards: DisplayCard[] = useMemo(() => {
    // When real data is present, filter that; else show mock cards as placeholder
    const base: DisplayCard[] = results.length > 0
      ? results.map<DisplayCard>((c) => c)
      : allCards.map<DisplayCard>((c) => ({
          id: c.id,
          name: c.name,
          set: c.set,
          collector_number: c.number,
        }))

    return base.filter((card) => {
      if (!query) return true
      const q = query.toLowerCase()
      return (
        card.name.toLowerCase().includes(q) ||
        card.collector_number.toLowerCase().includes(q)
      )
    })
  }, [allCards, query, results])

  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Abort previous in-flight request
        if (fetchAbortRef.current) fetchAbortRef.current.abort()
        const controller = new AbortController()
        fetchAbortRef.current = controller

        // If no query, show some default popular MTG results
        const params = new URLSearchParams(
          query && query.trim().length >= 2
            ? { q: query }
            : { q: 't:creature cmc<=3 game:paper' }
        )
        // Request sorted by EDHREC rank to surface well-known cards
        params.set('order', 'edhrec')
        params.set('dir', 'asc')
        params.set('unique', 'cards')
        params.set('include_extras', 'false')
        params.set('include_multilingual', 'false')
        params.set('page', '1')
        // Try local catalog first; fallback to Scryfall on error/empty
        let res = await fetch(`/api/cards/search?${params.toString()}`)
        let data = await res.json()
        if (!res.ok || !Array.isArray(data?.data) || data.data.length === 0) {
          const sfRes = await fetch(`/api/scryfall?${params.toString()}`, {
            signal: controller.signal,
          })
          if (!sfRes.ok) {
            const text = await sfRes.text()
            throw new Error(text || 'Failed to fetch')
          }
          data = await sfRes.json()
        }
        const items: ScryfallCard[] = (data?.data ?? [])
        setResults(items)
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return
        setError('Unable to fetch results')
      } finally {
        setIsLoading(false)
      }
    }, 350) // debounce

    return () => clearTimeout(handle)
  }, [query])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Search Cards</h1>
        <p className="mt-2 text-sm text-gray-500">
          Find cards and add them to your trade list or wishlist.
        </p>
      </header>

      <section aria-label="Search" className="mb-8 rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="query" className="mb-1 block text-sm font-medium">
              Search by name or number
            </label>
            <input
              id="query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Black Lotus or 233"
              className="w-full rounded-md border px-3 py-2 outline-none shadow-sm focus:ring-2 focus:ring-black/20"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Button size="md" className="w-full sm:w-auto" onClick={() => { /* search handled by debounce */ }}>Search</Button>
          <Button
            variant="secondary"
            size="md"
            className="w-full sm:w-auto"
            onClick={() => {
              setQuery('')
            }}
          >
            Clear
          </Button>
        </div>
      </section>

      <section aria-label="Results" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Results</h2>
          <p className="text-sm text-gray-500">{isLoading ? 'Loading…' : `${filteredCards.length} items`}</p>
        </div>

        {isLoading ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="rounded-xl border p-4 shadow-sm">
                <div className="mb-3 h-28 w-full animate-pulse rounded-md bg-gray-100" />
                <div className="mb-2 h-4 w-1/3 animate-pulse rounded bg-gray-100" />
                <div className="mb-4 h-5 w-2/3 animate-pulse rounded bg-gray-100" />
                <div className="flex gap-2">
                  <div className="h-10 w-full animate-pulse rounded-md bg-gray-100 sm:w-40" />
                  <div className="h-10 w-full animate-pulse rounded-md bg-gray-100 sm:w-40" />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCards.map((card) => (
            <li key={card.id} className="rounded-xl border p-4 shadow-sm transition hover:shadow-md hover:border-gray-300">
              {card.image_uris?.small ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.image_uris.small}
                  alt={card.name}
                  className="mb-3 h-28 w-full rounded-md object-contain bg-gray-50"
                />
              ) : (
                <div className="mb-3 h-28 w-full rounded-md bg-gray-100" aria-hidden />
              )}

              <div className="mb-3">
                <div className="text-sm text-gray-500">
                  {card.set_name || card.set} • #{card.collector_number}
                </div>
                <div className="text-base font-medium">{card.name}</div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    if (!user) {
                      router.push('/login')
                      return
                    }
                    // TODO: integrate save-to-trade-list
                  }}
                >
                  Add to Trade List
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    if (!user) {
                      router.push('/login')
                      return
                    }
                    // TODO: integrate add-to-wishlist
                  }}
                >
                  Add to Wishlist
                </Button>
              </div>
            </li>
          ))}
          </ul>
        )}

        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}
      </section>
    </div>
  )
}


