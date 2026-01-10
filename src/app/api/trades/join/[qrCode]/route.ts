import { NextRequest, NextResponse } from 'next/server'
import { QRSessionService } from '@/lib/services/qrSession'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ qrCode: string }> }
) {
  try {
    const { qrCode } = await params

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate QR code parameter
    if (!qrCode || typeof qrCode !== 'string') {
      return NextResponse.json(
        { error: 'Invalid QR code' },
        { status: 400 }
      )
    }

    // Join session
    const result = await QRSessionService.joinSession(user.id, qrCode)

    return NextResponse.json({
      success: true,
      ...result
    })
  } catch (error) {
    console.error('Join session API error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Handle specific errors
    if (errorMessage.includes('Invalid QR code')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 404 }
      )
    }
    
    if (errorMessage.includes('expired')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 410 } // Gone
      )
    }
    
    if (errorMessage.includes('no longer available') || 
        errorMessage.includes('already has two participants')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 409 } // Conflict
      )
    }
    
    if (errorMessage.includes('cannot join your own')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to join session',
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
