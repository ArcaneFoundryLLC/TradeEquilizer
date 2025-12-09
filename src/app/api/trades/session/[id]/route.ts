import { NextRequest, NextResponse } from 'next/server'
import { QRSessionService } from '@/lib/services/qrSession'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate session ID
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      )
    }

    // Get session
    const session = await QRSessionService.getSession(id, user.id)

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      session,
      isCreator: session.userAId === user.id
    })
  } catch (error) {
    console.error('Get session API error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (errorMessage.includes('Unauthorized')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch session',
        message: errorMessage
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validate session ID
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Invalid session ID' },
        { status: 400 }
      )
    }

    // Cancel session
    await QRSessionService.cancelSession(id, user.id)

    return NextResponse.json({
      success: true,
      message: 'Session cancelled successfully'
    })
  } catch (error) {
    console.error('Cancel session API error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (errorMessage.includes('not found')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 404 }
      )
    }
    
    if (errorMessage.includes('Only the session creator')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 403 }
      )
    }
    
    if (errorMessage.includes('Cannot cancel')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to cancel session',
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
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
