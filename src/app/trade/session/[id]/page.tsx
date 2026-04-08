'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { TradeSession, TradeProposal, TradeItem } from '@/types'

// ── Scryfall card shape (subset we care about) ──
interface ScryfallCard {
  id: string
  name: string
  set_name: string
  set: string
  collector_number: string
  image_uris?: { small: string; normal: string }
  card_faces?: { image_uris?: { small: string; normal: string } }[]
  prices?: { usd?: string; usd_foil?: string }
}

// ── Local item added to a trade side ──
interface TradeLineItem {
  scryfallId: string
  localItemId?: string // resolved DB id
  name: string
  set: string
  imageUrl: string
  quantity: number
  condition: 'NM' | 'LP' | 'MP' | 'HP'
  finish: 'normal' | 'foil'
  price: number // unit price
}

const CONDITIONS: TradeLineItem['condition'][] = ['NM', 'LP', 'MP', 'HP']
const CONDITION_MULT: Record<string, number> = { NM: 1, LP: 0.9, MP: 0.75, HP: 0.5 }
const FINISH_MULT: Record<string, number> = { normal: 1, foil: 1.5 }

function cardImage(c: ScryfallCard): string {
  return c.image_uris?.small ?? c.card_faces?.[0]?.image_uris?.small ?? ''
}
function cardPrice(c: ScryfallCard, finish: 'normal' | 'foil'): number {
  const raw = finish === 'foil' ? c.prices?.usd_foil : c.prices?.usd
  return raw ? parseFloat(raw) : 0
}
function lineTotal(item: TradeLineItem): number {
  return Math.round(item.price * CONDITION_MULT[item.condition] * FINISH_MULT[item.finish] * item.quantity * 100) / 100
}
function sideTotal(items: TradeLineItem[]): number {
  return Math.round(items.reduce((s, i) => s + lineTotal(i), 0) * 100) / 100
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────
export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [session, setSession] = useState<TradeSession | null>(null)
  const [isCreator, setIsCreator] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [timeRemaining, setTimeRemaining] = useState('')

  // Proposals
  const [proposals, setProposals] = useState<TradeProposal[]>([])
  const [proposalLoading, setProposalLoading] = useState(false)

  // Trade builder
  const [showBuilder, setShowBuilder] = useState(false)
  const [myItems, setMyItems] = useState<TradeLineItem[]>([])
  const [theirItems, setTheirItems] = useState<TradeLineItem[]>([])
  const [proposalMessage, setProposalMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── data fetching ──
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/trades/session/${resolvedParams.id}`)
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.message || d.error || 'Failed to fetch session')
      }
      const d = await res.json()
      setSession(d.session)
      setIsCreator(d.isCreator)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [resolvedParams.id])

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch(`/api/trades/proposals?sessionId=${resolvedParams.id}`)
      if (res.ok) {
        const d = await res.json()
        if (d.success) setProposals(d.proposals || [])
      }
    } catch {}
  }, [resolvedParams.id])

  useEffect(() => {
    fetchSession()
    fetchProposals()
    const iv = setInterval(() => { fetchSession(); fetchProposals() }, 5000)
    return () => clearInterval(iv)
  }, [fetchSession, fetchProposals])

  // QR + timer
  useEffect(() => {
    if (!session) return
    const qrData = `${window.location.origin}/trade?join=${session.qrCode}`
    QRCode.toDataURL(qrData, { width: 300, margin: 2 }).then(setQrCodeDataUrl)

    const tick = () => {
      const diff = new Date(session.expiresAt).getTime() - Date.now()
      if (diff <= 0) { setTimeRemaining('Expired'); return }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeRemaining(`${m}:${s.toString().padStart(2, '0')}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [session])

  // ── actions ──
  const cancelSession = async () => {
    if (!confirm('Cancel this session?')) return
    try {
      const res = await fetch(`/api/trades/session/${resolvedParams.id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      router.push('/trade')
    } catch (err) { setError(err instanceof Error ? err.message : 'Error') }
  }

  const respondToProposal = async (id: string, action: 'accept' | 'reject', reason?: string) => {
    setProposalLoading(true)
    try {
      const res = await fetch(`/api/trades/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason: reason }),
      })
      const d = await res.json()
      if (d.success) { fetchProposals(); fetchSession() }
      else alert(d.error || 'Failed')
    } catch { alert('Error responding') }
    finally { setProposalLoading(false) }
  }

  // ── submit proposal ──
  const submitProposal = async () => {
    if (myItems.length === 0 && theirItems.length === 0) {
      alert('Add at least one card to either side')
      return
    }
    setSubmitting(true)
    try {
      // Resolve scryfall IDs → local item IDs
      const resolve = async (items: TradeLineItem[]) => {
        const out: TradeItem[] = []
        for (const li of items) {
          let itemId = li.localItemId
          if (!itemId) {
            const r = await fetch(`/api/items/resolve?id=${encodeURIComponent(li.scryfallId)}`)
            const d = await r.json()
            itemId = d.id
          }
          if (!itemId) throw new Error(`Could not resolve card: ${li.name}`)
          out.push({
            itemId,
            quantity: li.quantity,
            condition: li.condition,
            finish: li.finish,
            language: 'en',
            name: li.name,
            set: li.set,
            currentPrice: lineTotal(li),
          })
        }
        return out
      }

      const proposerItems = await resolve(myItems)
      const recipientItems = await resolve(theirItems)

      const res = await fetch('/api/trades/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: resolvedParams.id,
          proposerItems,
          recipientItems,
          message: proposalMessage || undefined,
        }),
      })
      const d = await res.json()
      if (d.success) {
        setShowBuilder(false)
        setMyItems([])
        setTheirItems([])
        setProposalMessage('')
        fetchProposals()
      } else {
        alert(d.error || 'Failed to create proposal')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error submitting proposal')
    } finally {
      setSubmitting(false)
    }
  }

  // ── render helpers ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading session…</p>
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
              <p className="text-red-800">{error || 'Session not found'}</p>
            </div>
            <button onClick={() => router.push('/trade')} className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Back to Trade
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isExpired = new Date(session.expiresAt) < new Date()
  const isWaiting = session.status === 'waiting'
  const isConnected = session.status === 'connected'
  const isCompleted = session.status === 'completed'
  const pendingProposals = proposals.filter(p => p.status === 'pending')
  const completedProposals = proposals.filter(p => p.status !== 'pending')
  const myTotal = sideTotal(myItems)
  const theirTotal = sideTotal(theirItems)
  const diff = Math.round((theirTotal - myTotal) * 100) / 100

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-5 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Trade Session</h1>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  session.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                  session.status === 'connected' ? 'bg-green-100 text-green-800' :
                  session.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                </span>
                {isWaiting && !isExpired && (
                  <span className="text-sm text-gray-500">Expires in <span className="font-mono font-semibold">{timeRemaining}</span></span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {isCreator && isWaiting && (
                <button onClick={cancelSession} className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm">Cancel</button>
              )}
              <button onClick={() => router.push('/trade')} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm">Back</button>
            </div>
          </div>
        </div>

        {/* Waiting / QR */}
        {isWaiting && !isExpired && isCreator && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-4 text-center">
            <h2 className="text-lg font-semibold mb-3">Share this code to start trading</h2>
            {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="QR" className="w-56 h-56 mx-auto border-4 border-gray-200 rounded-lg" />}
            <div className="mt-3 inline-block px-4 py-2 bg-gray-100 rounded-md font-mono text-xl tracking-widest">{session.qrCode}</div>
            <p className="text-gray-500 text-sm mt-2">The other player enters this code on the Trade page</p>
          </div>
        )}

        {isWaiting && !isCreator && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-blue-900">
            Waiting for the session creator to be ready…
          </div>
        )}

        {isExpired && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-800">
            This session has expired. <button onClick={() => router.push('/trade')} className="underline">Create a new one</button>.
          </div>
        )}

        {isConnected && !showBuilder && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex justify-between items-center">
            <span className="text-green-900 font-medium">✓ Connected — both players are in the session</span>
            <button onClick={() => setShowBuilder(true)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">
              Build a Trade
            </button>
          </div>
        )}

        {isCompleted && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 text-gray-800">
            ✓ Trade completed.
          </div>
        )}

        {/* ── Trade Builder ── */}
        {showBuilder && isConnected && (
          <div className="bg-white rounded-lg shadow-md p-5 mb-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-900">Trade Builder</h2>
              <button onClick={() => setShowBuilder(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* My side */}
              <TradeSide
                label="You're giving"
                items={myItems}
                setItems={setMyItems}
                total={myTotal}
                accentColor="blue"
              />
              {/* Their side */}
              <TradeSide
                label="You're getting"
                items={theirItems}
                setItems={setTheirItems}
                total={theirTotal}
                accentColor="green"
              />
            </div>

            {/* Summary bar */}
            <div className="mt-5 p-4 rounded-lg bg-gray-50 border border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex gap-6 text-sm">
                <span>Giving: <span className="font-semibold">${myTotal.toFixed(2)}</span></span>
                <span>Getting: <span className="font-semibold">${theirTotal.toFixed(2)}</span></span>
                <span className={`font-semibold ${Math.abs(diff) < 1 ? 'text-green-600' : diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {diff >= 0 ? '+' : ''}{diff.toFixed(2)} in your favor
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Optional message…"
                  value={proposalMessage}
                  onChange={e => setProposalMessage(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm w-48"
                />
                <button
                  onClick={submitProposal}
                  disabled={submitting || (myItems.length === 0 && theirItems.length === 0)}
                  className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                >
                  {submitting ? 'Sending…' : 'Send Proposal'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Proposals list ── */}
        {(isConnected || isCompleted) && proposals.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Proposals</h2>

            {pendingProposals.length > 0 && (
              <div className="mb-4 space-y-3">
                {pendingProposals.map(p => (
                  <ProposalCard key={p.id} proposal={p} onRespond={respondToProposal} loading={proposalLoading} />
                ))}
              </div>
            )}

            {completedProposals.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">History</h3>
                {completedProposals.map(p => (
                  <ProposalCard key={p.id} proposal={p} onRespond={respondToProposal} loading={false} readonly />
                ))}
              </div>
            )}
          </div>
        )}

        {(isConnected || isCompleted) && proposals.length === 0 && !showBuilder && (
          <div className="text-center py-10 text-gray-400">No proposals yet</div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Trade Side — search + item list for one side of the trade
// ────────────────────────────────────────────────────────────────────────────
function TradeSide({
  label, items, setItems, total, accentColor,
}: {
  label: string
  items: TradeLineItem[]
  setItems: React.Dispatch<React.SetStateAction<TradeLineItem[]>>
  total: number
  accentColor: 'blue' | 'green'
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ScryfallCard[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null)

  const search = (q: string) => {
    setQuery(q)
    if (debounceRef[0]) clearTimeout(debounceRef[0])
    if (q.trim().length < 2) { setResults([]); return }
    debounceRef[0] = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/scryfall?q=${encodeURIComponent(q)}&unique=cards`)
        const d = await res.json()
        setResults((d.data || []).slice(0, 8))
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 350)
  }

  const addCard = (card: ScryfallCard) => {
    const hasFoil = !!card.prices?.usd_foil
    const finish: 'normal' | 'foil' = (!card.prices?.usd && hasFoil) ? 'foil' : 'normal'
    const price = cardPrice(card, finish)
    setItems(prev => [
      ...prev,
      {
        scryfallId: card.id,
        name: card.name,
        set: card.set_name,
        imageUrl: cardImage(card),
        quantity: 1,
        condition: 'NM',
        finish,
        price,
      },
    ])
    setQuery('')
    setResults([])
  }

  const removeCard = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))

  const updateCard = (idx: number, patch: Partial<TradeLineItem>) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item))

  const borderColor = accentColor === 'blue' ? 'border-blue-300' : 'border-green-300'
  const bgColor = accentColor === 'blue' ? 'bg-blue-50' : 'bg-green-50'

  return (
    <div className={`border-2 ${borderColor} rounded-lg p-4`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-900">{label}</h3>
        <span className="text-sm font-mono font-semibold">${total.toFixed(2)}</span>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <input
          type="text"
          value={query}
          onChange={e => search(e.target.value)}
          placeholder="Search cards…"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
        />
        {searching && <div className="absolute right-3 top-2.5 text-xs text-gray-400">searching…</div>}

        {/* Dropdown results */}
        {results.length > 0 && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-72 overflow-y-auto">
            {results.map(card => (
              <button
                key={card.id}
                onClick={() => addCard(card)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
              >
                {cardImage(card) && (
                  <img src={cardImage(card)} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{card.name}</div>
                  <div className="text-xs text-gray-500">{card.set_name} · {card.collector_number}</div>
                  <div className="text-xs text-gray-600 font-mono">
                    {card.prices?.usd ? `$${card.prices.usd}` : ''}
                    {card.prices?.usd_foil ? ` / Foil $${card.prices.usd_foil}` : ''}
                    {!card.prices?.usd && !card.prices?.usd_foil ? 'No price' : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Item list */}
      {items.length === 0 && (
        <div className={`text-center py-6 ${bgColor} rounded-md text-sm text-gray-500`}>
          Search and add cards above
        </div>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded-md">
            {item.imageUrl && <img src={item.imageUrl} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{item.name}</div>
              <div className="text-xs text-gray-500 truncate">{item.set}</div>
              <div className="flex gap-2 mt-1 flex-wrap">
                <select
                  value={item.condition}
                  onChange={e => updateCard(idx, { condition: e.target.value as TradeLineItem['condition'] })}
                  className="text-xs border border-gray-300 rounded px-1 py-0.5"
                  aria-label="Condition"
                >
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={item.finish}
                  onChange={e => updateCard(idx, { finish: e.target.value as 'normal' | 'foil' })}
                  className="text-xs border border-gray-300 rounded px-1 py-0.5"
                  aria-label="Finish"
                >
                  <option value="normal">Normal</option>
                  <option value="foil">Foil</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={item.quantity}
                  onChange={e => updateCard(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="text-xs border border-gray-300 rounded px-1 py-0.5 w-12 text-center"
                  aria-label="Quantity"
                />
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-mono font-semibold">${lineTotal(item).toFixed(2)}</div>
              <button onClick={() => removeCard(idx)} className="text-red-400 hover:text-red-600 text-xs mt-1" aria-label="Remove card">✕ remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Proposal Card
// ────────────────────────────────────────────────────────────────────────────
function ProposalCard({
  proposal, onRespond, loading, readonly = false,
}: {
  proposal: TradeProposal
  onRespond: (id: string, action: 'accept' | 'reject', reason?: string) => void
  loading: boolean
  readonly?: boolean
}) {
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const isExpired = new Date(proposal.expiresAt) < new Date()
  const canRespond = proposal.status === 'pending' && !isExpired && !readonly

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            proposal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
            proposal.status === 'accepted' ? 'bg-green-100 text-green-800' :
            proposal.status === 'rejected' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
          </span>
          {isExpired && proposal.status === 'pending' && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Expired</span>
          )}
        </div>
        <div className={`text-lg font-semibold ${
          Math.abs(proposal.fairnessPercentage) <= 5 ? 'text-green-600' :
          Math.abs(proposal.fairnessPercentage) <= 10 ? 'text-yellow-600' : 'text-red-600'
        }`}>
          {proposal.fairnessPercentage > 0 ? '+' : ''}{proposal.fairnessPercentage}%
        </div>
      </div>

      {proposal.message && (
        <div className="mb-3 p-2 bg-gray-50 rounded text-sm text-gray-700">{proposal.message}</div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-3">
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Giving (${proposal.proposerTotalValue.toFixed(2)})</h4>
          {proposal.proposerItems.length > 0 ? proposal.proposerItems.map((item, i) => (
            <div key={i} className="text-sm text-gray-700">{item.quantity}x {item.name || item.itemId} <span className="text-gray-400">({item.condition}, {item.finish})</span></div>
          )) : <p className="text-sm text-gray-400 italic">None</p>}
        </div>
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Getting (${proposal.recipientTotalValue.toFixed(2)})</h4>
          {proposal.recipientItems.length > 0 ? proposal.recipientItems.map((item, i) => (
            <div key={i} className="text-sm text-gray-700">{item.quantity}x {item.name || item.itemId} <span className="text-gray-400">({item.condition}, {item.finish})</span></div>
          )) : <p className="text-sm text-gray-400 italic">None</p>}
        </div>
      </div>

      {proposal.rejectionReason && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          Rejection reason: {proposal.rejectionReason}
        </div>
      )}

      {showReject && (
        <div className="mb-3">
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            rows={2}
            placeholder="Reason (optional)"
          />
        </div>
      )}

      {canRespond && (
        <div className="flex gap-2">
          <button onClick={() => onRespond(proposal.id, 'accept')} disabled={loading}
            className="px-4 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm">
            Accept
          </button>
          <button onClick={() => {
            if (showReject) { onRespond(proposal.id, 'reject', reason); setShowReject(false); setReason('') }
            else setShowReject(true)
          }} disabled={loading}
            className="px-4 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm">
            {showReject ? 'Confirm Reject' : 'Reject'}
          </button>
          {showReject && (
            <button onClick={() => { setShowReject(false); setReason('') }}
              className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm">
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}
