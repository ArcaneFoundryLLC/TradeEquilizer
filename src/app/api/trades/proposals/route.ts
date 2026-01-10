import { NextRequest, NextResponse } from 'next/server'
import { TradeProposalService } from '@/lib/services/tradeProposal'
import { CreateProposalRequest } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body: CreateProposalRequest = await request.json()
    
    // Validate required fields
    if (!body.sessionId || !body.proposerItems || !body.recipientItems) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate items arrays
    if (!Array.isArray(body.proposerItems) || !Array.isArray(body.recipientItems)) {
      return NextResponse.json(
        { success: false, error: 'Items must be arrays' },
        { status: 400 }
      )
    }

    // At least one side must have items
    if (body.proposerItems.length === 0 && body.recipientItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one side must have items' },
        { status: 400 }
      )
    }

    // Validate item structure
    const validateItems = (items: any[]) => {
      return items.every(item => 
        item.itemId && 
        typeof item.quantity === 'number' && 
        item.quantity > 0 &&
        ['NM', 'LP', 'MP', 'HP'].includes(item.condition) &&
        ['normal', 'foil', 'etched', 'showcase'].includes(item.finish) &&
        typeof item.language === 'string'
      )
    }

    if (!validateItems(body.proposerItems) || !validateItems(body.recipientItems)) {
      return NextResponse.json(
        { success: false, error: 'Invalid item structure' },
        { status: 400 }
      )
    }

    const result = await TradeProposalService.createProposal(body)
    
    if (!result.success) {
      const statusCode = result.error?.includes('Authentication') ? 401 :
                        result.error?.includes('not found') ? 404 :
                        result.error?.includes('not available') ? 409 : 400
      
      return NextResponse.json(result, { status: statusCode })
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/trades/proposals:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (sessionId) {
      // Get proposals for a specific session
      const proposals = await TradeProposalService.getSessionProposals(sessionId)
      return NextResponse.json({ success: true, proposals })
    } else {
      // Get proposals for current user
      const proposals = await TradeProposalService.getUserProposals()
      return NextResponse.json({ success: true, proposals })
    }
  } catch (error) {
    console.error('Error in GET /api/trades/proposals:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}