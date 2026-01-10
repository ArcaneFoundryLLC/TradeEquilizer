'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TradeSession } from '@/types'

export default function TradePage() {
  const router = useRouter()
  const [session, setSession] = useState<TradeSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qrCodeInput, setQrCodeInput] = useState('')

  const createSession = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/trades/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          game: 'mtg',
          priceSource: 'tcgplayer_market',
          fairnessThreshold: 5.0
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.error || 'Failed to create session')
      }

      const data = await response.json()
      setSession(data.session)
      
      // Redirect to session page
      router.push(`/trade/session/${data.session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const joinSession = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!qrCodeInput.trim()) {
      setError('Please enter a QR code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/trades/join/${encodeURIComponent(qrCodeInput)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || errorData.error || 'Failed to join session')
      }

      const data = await response.json()
      setSession(data.session)
      
      // Redirect to session page
      router.push(`/trade/session/${data.session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Start Trading
          </h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-8">
            {/* Create Session */}
            <div className="border-b border-gray-200 pb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Create a New Trade Session
              </h2>
              <p className="text-gray-600 mb-4">
                Generate a QR code that another player can scan to start trading with you.
                The code expires in 2 minutes.
              </p>
              <button
                onClick={createSession}
                disabled={loading}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Creating Session...' : 'Create Trade Session'}
              </button>
            </div>

            {/* Join Session */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Join an Existing Session
              </h2>
              <p className="text-gray-600 mb-4">
                Enter the QR code from another player's session to join their trade.
              </p>
              <form onSubmit={joinSession} className="space-y-4">
                <div>
                  <label htmlFor="qrCode" className="block text-sm font-medium text-gray-700 mb-2">
                    QR Code
                  </label>
                  <input
                    type="text"
                    id="qrCode"
                    value={qrCodeInput}
                    onChange={(e) => setQrCodeInput(e.target.value)}
                    placeholder="Enter QR code (e.g., ABC123DEF456)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !qrCodeInput.trim()}
                  className="w-full px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {loading ? 'Joining Session...' : 'Join Trade Session'}
                </button>
              </form>
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-md">
            <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>One player creates a trade session and shares the QR code</li>
              <li>The other player scans or enters the code to join</li>
              <li>Both players can propose trades and negotiate</li>
              <li>Once agreed, the trade is completed and a receipt is generated</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
