'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { TradeSession, TradeProposal, TradeItem } from '@/types'

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [session, setSession] = useState<TradeSession | null>(null)
  const [isCreator, setIsCreator] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  
  // Proposal state
  const [proposals, setProposals] = useState<TradeProposal[]>([])
  const [showCreateProposal, setShowCreateProposal] = useState(false)
  const [proposalLoading, setProposalLoading] = useState(false)

  useEffect(() => {
    fetchSession()
    fetchProposals()
    const interval = setInterval(() => {
      fetchSession()
      fetchProposals()
    }, 5000) // Poll every 5 seconds
    return () => clearInterval(interval)
  }, [resolvedParams.id])

  useEffect(() => {
    if (session) {
      // Generate QR code
      const qrData = `${window.location.origin}/trade?join=${session.qrCode}`
      QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }).then(setQrCodeDataUrl)

      // Update time remaining
      const updateTimer = () => {
        const now = new Date().getTime()
        const expires = new Date(session.expiresAt).getTime()
        const diff = expires - now

        if (diff <= 0) {
          setTimeRemaining('Expired')
        } else {
          const minutes = Math.floor(diff / 60000)
          const seconds = Math.floor((diff % 60000) / 1000)
          setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`)
        }
      }

      updateTimer()
      const timer = setInterval(updateTimer, 1000)
      return () => clearInterval(timer)
    }
  }, [session])

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/trades/session/${resolvedParams.id}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.error || 'Failed to fetch session')
      }

      const data = await response.json()
      setSession(data.session)
      setIsCreator(data.isCreator)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchProposals = async () => {
    try {
      const response = await fetch(`/api/trades/proposals?sessionId=${resolvedParams.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setProposals(data.proposals || [])
        }
      }
    } catch (err) {
      console.error('Error fetching proposals:', err)
    }
  }

  const cancelSession = async () => {
    if (!confirm('Are you sure you want to cancel this session?')) {
      return
    }

    try {
      const response = await fetch(`/api/trades/session/${resolvedParams.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.error || 'Failed to cancel session')
      }

      router.push('/trade')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const respondToProposal = async (proposalId: string, action: 'accept' | 'reject', rejectionReason?: string) => {
    setProposalLoading(true)
    try {
      const response = await fetch(`/api/trades/proposals/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason })
      })

      const data = await response.json()
      if (data.success) {
        await fetchProposals()
        await fetchSession()
        if (action === 'accept') {
          alert('Trade accepted! The session is now complete.')
        }
      } else {
        alert(data.error || 'Failed to respond to proposal')
      }
    } catch (err) {
      alert('Error responding to proposal')
    } finally {
      setProposalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading session...</p>
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
            <button
              onClick={() => router.push('/trade')}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Trade Session
              </h1>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  session.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                  session.status === 'connected' ? 'bg-green-100 text-green-800' :
                  session.status === 'proposing' ? 'bg-blue-100 text-blue-800' :
                  session.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                </span>
                {isWaiting && !isExpired && (
                  <span className="text-sm text-gray-600">
                    Expires in: <span className="font-mono font-semibold">{timeRemaining}</span>
                  </span>
                )}
              </div>
            </div>
            {isCreator && isWaiting && (
              <button
                onClick={cancelSession}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
              >
                Cancel Session
              </button>
            )}
          </div>

          {isExpired && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 font-medium">This session has expired.</p>
              <p className="text-red-700 text-sm mt-1">Please create a new session to continue trading.</p>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* QR Code Section */}
            {isCreator && isWaiting && !isExpired && (
              <div className="border border-gray-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Share this QR Code
                </h2>
                {qrCodeDataUrl && (
                  <div className="flex flex-col items-center">
                    <img 
                      src={qrCodeDataUrl} 
                      alt="Session QR Code" 
                      className="w-64 h-64 border-4 border-gray-200 rounded-lg"
                    />
                    <div className="mt-4 p-3 bg-gray-50 rounded-md w-full">
                      <p className="text-xs text-gray-600 mb-1">Or share this code:</p>
                      <p className="font-mono text-lg font-bold text-center text-gray-900">
                        {session.qrCode}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Session Info */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Session Details
              </h2>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-600">Game</dt>
                  <dd className="text-sm text-gray-900 mt-1">Magic: The Gathering</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-600">Price Source</dt>
                  <dd className="text-sm text-gray-900 mt-1">TCGplayer Market</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-600">Fairness Threshold</dt>
                  <dd className="text-sm text-gray-900 mt-1">±{session.fairnessThreshold}%</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-600">Currency</dt>
                  <dd className="text-sm text-gray-900 mt-1">USD</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-600">Created</dt>
                  <dd className="text-sm text-gray-900 mt-1">
                    {new Date(session.createdAt).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Status Messages */}
          {isWaiting && !isExpired && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-blue-900 font-medium">
                {isCreator ? 'Waiting for another player to join...' : 'Waiting for session to start...'}
              </p>
              <p className="text-blue-800 text-sm mt-1">
                The session will automatically connect when both players are ready.
              </p>
            </div>
          )}

          {isConnected && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-900 font-medium">
                ✓ Connected! Both players are in the session.
              </p>
              <p className="text-green-800 text-sm mt-1">
                You can now start proposing trades.
              </p>
            </div>
          )}

          {isCompleted && (
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-gray-900 font-medium">
                ✓ Trade completed successfully!
              </p>
              <p className="text-gray-700 text-sm mt-1">
                This session has been completed. Check your trade history for details.
              </p>
            </div>
          )}

          {/* Trade Proposals Section */}
          {(isConnected || isCompleted) && (
            <div className="mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Trade Proposals</h2>
                {isConnected && !showCreateProposal && (
                  <button
                    onClick={() => setShowCreateProposal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Create Proposal
                  </button>
                )}
              </div>

              {/* Create Proposal Form */}
              {showCreateProposal && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-blue-900">Create New Proposal</h3>
                    <button
                      onClick={() => setShowCreateProposal(false)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-blue-800 text-sm mb-4">
                    Proposal creation UI coming soon! This will include:
                  </p>
                  <ul className="text-blue-800 text-sm space-y-1 ml-4">
                    <li>• Card search and selection</li>
                    <li>• Inventory browsing</li>
                    <li>• Real-time value calculation</li>
                    <li>• Fairness validation</li>
                  </ul>
                </div>
              )}

              {/* Pending Proposals */}
              {pendingProposals.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Pending Proposals</h3>
                  <div className="space-y-4">
                    {pendingProposals.map((proposal) => (
                      <ProposalCard 
                        key={proposal.id} 
                        proposal={proposal} 
                        onRespond={respondToProposal}
                        loading={proposalLoading}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Proposals */}
              {completedProposals.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Proposal History</h3>
                  <div className="space-y-4">
                    {completedProposals.map((proposal) => (
                      <ProposalCard 
                        key={proposal.id} 
                        proposal={proposal} 
                        onRespond={respondToProposal}
                        loading={false}
                        readonly
                      />
                    ))}
                  </div>
                </div>
              )}

              {proposals.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No proposals yet. Create the first proposal to start trading!
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex gap-4">
            <button
              onClick={() => router.push('/trade')}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Back to Trade
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Proposal Card Component
function ProposalCard({ 
  proposal, 
  onRespond, 
  loading, 
  readonly = false 
}: { 
  proposal: TradeProposal
  onRespond: (id: string, action: 'accept' | 'reject', reason?: string) => void
  loading: boolean
  readonly?: boolean
}) {
  const [showRejectReason, setShowRejectReason] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  const isExpired = new Date(proposal.expiresAt) < new Date()
  const canRespond = proposal.status === 'pending' && !isExpired && !readonly

  const handleReject = () => {
    if (showRejectReason) {
      onRespond(proposal.id, 'reject', rejectionReason)
      setShowRejectReason(false)
      setRejectionReason('')
    } else {
      setShowRejectReason(true)
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              proposal.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              proposal.status === 'accepted' ? 'bg-green-100 text-green-800' :
              proposal.status === 'rejected' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
            </span>
            {isExpired && proposal.status === 'pending' && (
              <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                Expired
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">
            Created: {new Date(proposal.createdAt).toLocaleString()}
          </p>
          {proposal.expiresAt && proposal.status === 'pending' && (
            <p className="text-sm text-gray-600">
              Expires: {new Date(proposal.expiresAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">Fairness</div>
          <div className={`text-lg font-semibold ${
            Math.abs(proposal.fairnessPercentage) <= 5 ? 'text-green-600' :
            Math.abs(proposal.fairnessPercentage) <= 10 ? 'text-yellow-600' :
            'text-red-600'
          }`}>
            {proposal.fairnessPercentage > 0 ? '+' : ''}{proposal.fairnessPercentage}%
          </div>
        </div>
      </div>

      {proposal.message && (
        <div className="mb-4 p-3 bg-gray-50 rounded-md">
          <p className="text-sm text-gray-700">{proposal.message}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <h4 className="font-medium text-gray-900 mb-2">
            Proposer Items (${proposal.proposerTotalValue.toFixed(2)})
          </h4>
          {proposal.proposerItems.length > 0 ? (
            <div className="space-y-1">
              {proposal.proposerItems.map((item, index) => (
                <div key={index} className="text-sm text-gray-600">
                  {item.quantity}x {item.name || `Item ${item.itemId}`} ({item.condition}, {item.finish})
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No items</p>
          )}
        </div>
        <div>
          <h4 className="font-medium text-gray-900 mb-2">
            Recipient Items (${proposal.recipientTotalValue.toFixed(2)})
          </h4>
          {proposal.recipientItems.length > 0 ? (
            <div className="space-y-1">
              {proposal.recipientItems.map((item, index) => (
                <div key={index} className="text-sm text-gray-600">
                  {item.quantity}x {item.name || `Item ${item.itemId}`} ({item.condition}, {item.finish})
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No items</p>
          )}
        </div>
      </div>

      {proposal.rejectionReason && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">
            <strong>Rejection reason:</strong> {proposal.rejectionReason}
          </p>
        </div>
      )}

      {showRejectReason && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rejection Reason (optional)
          </label>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            rows={3}
            placeholder="Why are you rejecting this proposal?"
          />
        </div>
      )}

      {canRespond && (
        <div className="flex gap-2">
          <button
            onClick={() => onRespond(proposal.id, 'accept')}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            {loading ? 'Processing...' : 'Accept'}
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
          >
            {showRejectReason ? 'Confirm Reject' : 'Reject'}
          </button>
          {showRejectReason && (
            <button
              onClick={() => {
                setShowRejectReason(false)
                setRejectionReason('')
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}
