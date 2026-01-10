import { NextRequest, NextResponse } from 'next/server'
import { TradeProposalService } from '@/lib/services/tradeProposal'
import { RespondToProposalRequest } from '@/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const proposalId = resolvedParams.id
    const body: RespondToProposalRequest = await request.json()
    
    // Validate required fields
    if (!body.action || !['accept', 'reject'].includes(body.action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "accept" or "reject"' },
        { status: 400 }
      )
    }

    // Validate rejection reason if rejecting
    if (body.action === 'reject' && body.rejectionReason && typeof body.rejectionReason !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Rejection reason must be a string' },
        { status: 400 }
      )
    }

    const result = await TradeProposalService.respondToProposal(proposalId, body)
    
    if (!result.success) {
      const statusCode = result.error?.includes('Authentication') ? 401 :
                        result.error?.includes('not found') ? 404 :
                        result.error?.includes('expired') ? 410 :
                        result.error?.includes('no longer pending') ? 409 : 400
      
      return NextResponse.json(result, { status: statusCode })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in PATCH /api/trades/proposals/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const proposalId = resolvedParams.id

    const result = await TradeProposalService.cancelProposal(proposalId)
    
    if (!result.success) {
      const statusCode = result.error?.includes('Authentication') ? 401 :
                        result.error?.includes('not found') ? 404 : 400
      
      return NextResponse.json(result, { status: statusCode })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in DELETE /api/trades/proposals/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}