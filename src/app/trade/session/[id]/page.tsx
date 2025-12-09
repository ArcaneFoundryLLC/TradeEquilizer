'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { TradeSession } from '@/types'

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [session, setSession] = useState<TradeSession | null>(null)
  const [isCreator, setIsCreator] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [timeRemaining, setTimeRemaining] = useState<string>('')

  useEffect(() => {
    fetchSession()
    const interval = setInterval(fetchSession, 5000) // Poll every 5 seconds
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
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

          <div className="grid md:grid-cols-2 gap-6">
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

          <div className="mt-6 flex gap-4">
            <button
              onClick={() => router.push('/trade')}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Back to Trade
            </button>
            {isConnected && (
              <button
                onClick={() => alert('Trade proposal feature coming soon!')}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Propose Trade
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
