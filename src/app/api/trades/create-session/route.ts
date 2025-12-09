import { NextRequest, NextResponse } from 'next/server'
import { QRSessionService } from '@/lib/services/qrSession'
import { createClient } from '@/lib/supabase/server'
import { CreateSessionRequest } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get IP address for rate limiting
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     '127.0.0.1'

    // Parse request body
    const body: CreateSessionRequest = await request.json().catch(() => ({}))

    // Validate request
    if (body.game && body.game !== 'mtg') {
      return NextResponse.json(
        { error: 'Invalid game. Only MTG is supported in P0.' },
        { status: 400 }
      )
    }

    if (body.priceSource && body.priceSource !== 'tcgplayer_market') {
      return NextResponse.json(
        { error: 'Invalid price source. Only tcgplayer_market is supported in P0.' },
        { status: 400 }
      )
    }

    if (body.fairnessThreshold !== undefined) {
      if (body.fairnessThreshold < 2 || body.fairnessThreshold > 10) {
        return NextResponse.json(
          { error: 'Fairness threshold must be between 2% and 10%' },
          { status: 400 }
        )
      }
    }

    // Create session
    const result = await QRSessionService.createSession(user.id, ipAddress, body)

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Create session API error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Handle rate limiting
    if (errorMessage.includes('Rate limit')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 429 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create session',
        message: errorMessage
      },
      { status: 500 }
    )
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
