'use client'

import { useEffect, useState, useRef } from 'react'
import ProtectedRoute from '@/components/ProtectedRoute'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAuth } from '@/contexts/AuthContext'

interface PriceData {
  itemId: string
  name: string
  set: string
  collectorNumber: string
  source: string
  currency: string
  market: number
  low: number
  high: number
  conditionMultipliers: {
    NM: number
    LP: number
    MP: number
    HP: number
  }
  finishMultipliers: {
    normal: number
    foil: number
    etched: number
    showcase: number
  }
  asOf: string
  version: string
}

interface SyncStatus {
  lastSync: string | null
  status: 'syncing' | 'success' | 'error' | 'idle'
  totalItems: number
  syncedItems: number
}

export default function MarketPricingPage() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [priceData, setPriceData] = useState<PriceData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    lastSync: null,
    status: 'idle',
    totalItems: 0,
    syncedItems: 0,
  })

  // Autocomplete/search for cards when doing a price lookup
  const [cardQuery, setCardQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedCard, setSelectedCard] = useState<any | null>(null)
  const fetchAbortRef = useRef<AbortController | null>(null)

  // Fetch sync status
  useEffect(() => {
    const fetchSyncStatus = async () => {
      try {
        // This would come from a status endpoint
        // For now, we'll use a placeholder
        setSyncStatus({
          lastSync: null,
          status: 'idle',
          totalItems: 0,
          syncedItems: 0,
        })
      } catch (err) {
        console.warn('Sync status API not available:', err)
      }
    }

    fetchSyncStatus()
  }, [])

  // Fetch card search results when the user types (autocomplete)
  useEffect(() => {
    const q = cardQuery.trim()
    if (q.length < 2) {
      setSearchResults([])
      setSearchError(null)
      setSearchLoading(false)
      return
    }

    const handle = setTimeout(async () => {
      try {
        setSearchLoading(true)
        setSearchError(null)

        // Abort any in-flight request
        if (fetchAbortRef.current) fetchAbortRef.current.abort()
        const controller = new AbortController()
        fetchAbortRef.current = controller

        const params = new URLSearchParams({ q, limit: '8', page: '1' })
        let res = await fetch(`/api/cards/search?${params.toString()}`, { signal: controller.signal })
        let data = await res.json()
        if (!res.ok || !Array.isArray(data?.data) || data.data.length === 0) {
          // Fallback to Scryfall search
          const sfRes = await fetch(`/api/scryfall?${params.toString()}`, { signal: controller.signal })
          if (!sfRes.ok) {
            // Treat 404 from Scryfall (no matches) as empty result set instead of an error
            if (sfRes.status === 404) {
              setSearchResults([])
              setSearchLoading(false)
              return
            }
            const text = await sfRes.text().catch(() => '')
            throw new Error(text || 'Failed to fetch')
          }
          data = await sfRes.json()
        }

        const items = (data?.data ?? [])
        setSearchResults(items)
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return
        console.error('Search error', e)
        // Surface the error message from the failing fetch where possible
        const msg = e instanceof Error ? e.message : String(e)
        setSearchError(msg || 'Unable to fetch results')
      } finally {
        setSearchLoading(false)
      }
    }, 300)

    return () => clearTimeout(handle)
  }, [cardQuery])

  const handlePriceLookup = async (selectedCardOverride?: any) => {
    const effectiveSelected = selectedCardOverride ?? selectedCard
    // Determine itemId: prefer a selected card, otherwise try to resolve by searching
    let itemIdToLookup = ''
    if (effectiveSelected) {
      // Selected card may be a Scryfall object (its id is a scryfall id) or an internal item id.
      // Resolve it to an internal items.id via the server endpoint which will create a minimal
      // catalog entry if needed.
      try {
        const res = await fetch(`/api/items/resolve?id=${encodeURIComponent(effectiveSelected.id)}`)
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || 'Failed to resolve selected card')
        }
        const json = await res.json()
        itemIdToLookup = json?.id || ''
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to resolve selected card')
        return
      }
    } else if (searchQuery.trim()) itemIdToLookup = searchQuery.trim()
    else {
      setError('Please enter a card name or ID')
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // If the value looks like a UUID (id from items), use it directly. Otherwise try to resolve via search API.
      const uuidRegex = /^[0-9a-fA-F-]{36}$/
      if (!uuidRegex.test(itemIdToLookup)) {
        // Try to resolve by searching items with the cards search endpoint
        const params = new URLSearchParams({ q: itemIdToLookup, limit: '1', page: '1' })
        const res = await fetch(`/api/cards/search?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.data) && data.data.length > 0) {
            itemIdToLookup = data.data[0].id
          }
        }
      }

      if (!itemIdToLookup) throw new Error('Could not resolve item to lookup')

      const response = await fetch(`/api/prices/market?itemId=${encodeURIComponent(itemIdToLookup)}`)

      if (!response.ok) {
        throw new Error('Failed to fetch price data')
      }

      const data = await response.json()
      setPriceData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch price data')
      setPriceData(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSyncPrices = async () => {
    try {
      setSyncStatus({ ...syncStatus, status: 'syncing' })
      const response = await fetch('/api/prices/sync', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to sync prices')
      }

      setSyncStatus({
        lastSync: new Date().toISOString(),
        status: 'success',
        totalItems: 0,
        syncedItems: 0,
      })
    } catch (err) {
      setSyncStatus({ ...syncStatus, status: 'error' })
      setError(err instanceof Error ? err.message : 'Failed to sync prices')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <ProtectedRoute>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Market Pricing</h1>
            <p className="mt-2 text-sm text-gray-500">
              View and sync current market prices.
            </p>
          </div>
          <Button
            onClick={handleSyncPrices}
            disabled={syncStatus.status === 'syncing'}
          >
            {syncStatus.status === 'syncing' ? 'Syncing...' : 'Sync Prices'}
          </Button>
        </header>

        {/* Sync Status */}
        <section className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Price Sync Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        syncStatus.status === 'success'
                          ? 'bg-green-100 text-green-800'
                          : syncStatus.status === 'syncing'
                          ? 'bg-blue-100 text-blue-800'
                          : syncStatus.status === 'error'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {syncStatus.status === 'success'
                        ? 'Synced'
                        : syncStatus.status === 'syncing'
                        ? 'Syncing...'
                        : syncStatus.status === 'error'
                        ? 'Error'
                        : 'Idle'}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Last Sync</div>
                  <div className="mt-1 text-sm font-medium">
                    {syncStatus.lastSync
                      ? formatDate(syncStatus.lastSync)
                      : 'Never'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Source</div>
                  <div className="mt-1 text-sm font-medium">Scryfall / TCGplayer</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Price Lookup */}
        <section className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Price Lookup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Search card name or ID..."
                    value={cardQuery}
                    onChange={(e) => { setCardQuery(e.target.value); setSelectedCard(null); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handlePriceLookup()
                      }
                    }}
                    className="flex-1"
                  />
                  <Button onClick={handlePriceLookup} disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'Lookup'}
                  </Button>
                </div>

                {/* Dropdown results */}
                {cardQuery.trim().length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-white shadow-sm">
                    {searchLoading ? (
                      <div className="p-3 text-sm text-gray-500">Searching...</div>
                    ) : searchError ? (
                      <div className="p-3 text-sm text-red-600">{searchError}</div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500">No results</div>
                    ) : (
                      searchResults.map((card) => (
                        <div
                          key={card.id}
                          className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50"
                          onClick={async () => {
                            setSelectedCard(card)
                            setCardQuery(`${card.name} • ${card.set}`)
                            setSearchResults([])
                            // Immediately resolve & lookup price for the selected card
                            await handlePriceLookup(card)
                          }}
                        >
                          {card.image_uris?.small ? (
                            <img src={card.image_uris.small} alt={card.name} className="h-10 w-8 object-contain" />
                          ) : (
                            <div className="h-10 w-8 bg-gray-100" />
                          )}
                          <div className="flex-1 text-sm">
                            <div className="font-medium">{card.name}</div>
                            <div className="text-xs text-gray-500">{card.set} • #{card.collector_number}</div>
                          </div>
                          <div className="text-xs text-gray-400">Select</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              {error && (
                <div className="mt-4 rounded-md bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Price Display */}
        {priceData && (
          <section className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle>{priceData.name}</CardTitle>
                <div className="text-sm text-gray-500">
                  {priceData.set} • #{priceData.collectorNumber}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Price Range */}
                  <div>
                    <h3 className="mb-3 text-lg font-semibold">Price Range</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-gray-500">Low</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {formatCurrency(priceData.low)}
                        </div>
                      </div>
                      <div className="rounded-lg border p-4 bg-blue-50">
                        <div className="text-sm text-gray-500">Market</div>
                        <div className="text-2xl font-bold text-blue-700">
                          {formatCurrency(priceData.market)}
                        </div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-gray-500">High</div>
                        <div className="text-2xl font-bold text-blue-600">
                          {formatCurrency(priceData.high)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Condition Multipliers */}
                  <div>
                    <h3 className="mb-3 text-lg font-semibold">Condition Multipliers</h3>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {Object.entries(priceData.conditionMultipliers).map(([condition, multiplier]) => (
                        <div key={condition} className="rounded-lg border p-3">
                          <div className="text-sm text-gray-500">{condition}</div>
                          <div className="text-lg font-semibold">
                            {multiplier}x
                          </div>
                          <div className="text-xs text-gray-600">
                            {formatCurrency(priceData.market * multiplier)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Finish Multipliers */}
                  <div>
                    <h3 className="mb-3 text-lg font-semibold">Finish Multipliers</h3>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {Object.entries(priceData.finishMultipliers).map(([finish, multiplier]) => (
                        <div key={finish} className="rounded-lg border p-3">
                          <div className="text-sm text-gray-500 capitalize">{finish}</div>
                          <div className="text-lg font-semibold">
                            {multiplier}x
                          </div>
                          <div className="text-xs text-gray-600">
                            {formatCurrency(priceData.market * multiplier)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="border-t pt-4">
                    <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                      <div>
                        <span className="text-gray-500">Source: </span>
                        <span className="font-medium">{priceData.source}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Currency: </span>
                        <span className="font-medium">{priceData.currency}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">As of: </span>
                        <span className="font-medium">{formatDate(priceData.asOf)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Version: </span>
                        <span className="font-medium">{priceData.version}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Information Card */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle>About Market Pricing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  Prices are sourced from Scryfall and TCGplayer Market data, updated daily.
                  Condition and finish multipliers are applied automatically based on your preferences.
                </p>
                <p>
                  <strong>Condition Multipliers:</strong> Prices adjust based on card condition
                  (Near Mint = 100%, Lightly Played = 90%, etc.)
                </p>
                <p>
                  <strong>Finish Multipliers:</strong> Foil, etched, and showcase variants
                  have their own pricing multipliers applied to the base market price.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </ProtectedRoute>
  )
}
