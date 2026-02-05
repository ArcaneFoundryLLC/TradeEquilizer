// Core types for TradeEqualizer P0 MVP

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  subscriptionTier: 'free' | 'pro' | 'lgs';
  subscriptionExpiresAt?: Date;
}

export interface Item {
  id: string;
  game: 'mtg'; // P0 scope: MTG only
  name: string;
  set: string;
  collectorNumber: string;
  language: string;
  finish: 'normal' | 'foil' | 'etched' | 'showcase';
  scryfallId?: string;
  tcgplayerId?: string;
  imageUrl?: string;
}

export interface Inventory {
  id: string;
  userId: string;
  itemId: string;
  quantity: number;
  condition: 'NM' | 'LP' | 'MP' | 'HP';
  language: string;
  finish: 'normal' | 'foil' | 'etched' | 'showcase';
  tradable: boolean;
  acquiredAt: Date;
}

export interface Want {
  id: string;
  userId: string;
  itemId: string;
  quantity: number;
  minCondition: 'NM' | 'LP' | 'MP' | 'HP';
  languageOk: string[];
  finishOk: ('normal' | 'foil' | 'etched' | 'showcase')[];
  priority: 1 | 2 | 3; // 1 = Must have, 2 = Want, 3 = Nice to have
  createdAt: Date;
}

export interface TradeSession {
  id: string;
  qrCode: string;
  userAId: string;
  userBId?: string;
  game: 'mtg'; // P0 scope: MTG only
  priceSource: 'tcgplayer_market'; // P0 scope: Market only
  fairnessThreshold: number;
  currency: 'USD'; // P0 scope: USD only
  status: 'waiting' | 'connected' | 'proposing' | 'completed' | 'cancelled';
  eventId?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionRequest {
  game?: 'mtg';
  priceSource?: 'tcgplayer_market';
  fairnessThreshold?: number;
  eventId?: string;
}

export interface JoinSessionRequest {
  qrCode: string;
}

export interface SessionResponse {
  session: TradeSession;
  isCreator: boolean;
}

// Trade Proposal Types
export interface TradeProposal {
  id: string
  sessionId: string
  proposerId: string
  recipientId: string
  proposerItems: TradeItem[]
  recipientItems: TradeItem[]
  proposerTotalValue: number
  recipientTotalValue: number
  fairnessPercentage: number
  priceVersion: string
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled'
  message?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
  expiresAt: string
  respondedAt?: string
}

export interface TradeItem {
  itemId: string
  quantity: number
  condition: 'NM' | 'LP' | 'MP' | 'HP'
  language: string
  finish: 'normal' | 'foil' | 'etched' | 'showcase'
  // Populated from items table
  name?: string
  set?: string
  imageUrl?: string
  currentPrice?: number
}

export interface ItemReservation {
  id: string
  userId: string
  itemId: string
  quantity: number
  condition: 'NM' | 'LP' | 'MP' | 'HP'
  language: string
  finish: 'normal' | 'foil' | 'etched' | 'showcase'
  proposalId?: string
  sessionId: string
  reservedAt: string
  expiresAt: string
}

// Trade Proposal API Types
export interface CreateProposalRequest {
  sessionId: string
  recipientId: string
  proposerItems: TradeItem[]
  recipientItems: TradeItem[]
  message?: string
}

export interface CreateProposalResponse {
  success: boolean
  proposal?: TradeProposal
  error?: string
}

export interface RespondToProposalRequest {
  action: 'accept' | 'reject'
  rejectionReason?: string
}

export interface RespondToProposalResponse {
  success: boolean
  proposal?: TradeProposal
  error?: string
}

export interface ProposalListResponse {
  success: boolean
  proposals?: TradeProposal[]
  error?: string
}
// PDF Receipt Generation Types
export interface TradeSnapshot {
  id: string
  tradeId: string
  sessionId: string
  
  // Participants
  proposerId: string
  recipientId: string
  proposerName: string
  recipientName: string
  
  // Trade Items
  proposerItems: TradeItem[]
  recipientItems: TradeItem[]
  
  // Pricing Information
  proposerTotalValue: number
  recipientTotalValue: number
  fairnessPercentage: number
  priceVersion: string
  priceTimestamp: string
  priceSource: 'tcgplayer_market' | 'buylist'
  
  // Manual Overrides
  manualOverrides: ManualOverride[]
  fairnessAdjustments: FairnessAdjustment[]
  
  // Metadata
  completedAt: string
  snapshotHash: string
  integrityVerified: boolean
  
  // Audit Trail
  createdAt: string
  createdBy: string
}

export interface ManualOverride {
  id: string
  itemId: string
  originalPrice: number
  overridePrice: number
  reason: string
  appliedBy: string
  appliedAt: string
}

export interface FairnessAdjustment {
  id: string
  originalFairness: number
  adjustedFairness: number
  reason: string
  appliedBy: string
  appliedAt: string
}

export interface Receipt {
  id: string
  tradeSnapshotId: string
  userId: string
  
  // PDF Details
  pdfUrl: string
  pdfSize: number
  generatedAt: string
  
  // Email Details
  emailSent: boolean
  emailSentAt?: string
  emailRetries: number
  
  // Status
  status: 'generating' | 'ready' | 'failed' | 'queued'
  errorMessage?: string
  
  // Metadata
  createdAt: string
  expiresAt: string
}

export interface ReceiptQueue {
  id: string
  tradeId: string
  userId: string
  priority: 'normal' | 'high'
  
  // Queue Status
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  maxAttempts: number
  
  // Timing
  scheduledAt: string
  processedAt?: string
  nextRetryAt?: string
  
  // Error Handling
  lastError?: string
  errorCount: number
  
  // Metadata
  createdAt: string
  expiresAt: string
}

// Receipt API Types
export interface GenerateReceiptRequest {
  tradeId: string
  emailDelivery?: boolean
}

export interface GenerateReceiptResponse {
  success: boolean
  receipt?: Receipt
  error?: string
}

export interface ReceiptListResponse {
  success: boolean
  receipts?: Receipt[]
  error?: string
}

export interface ReceiptData {
  tradeSnapshot: TradeSnapshot
  participants: {
    proposer: User
    recipient: User
  }
  items: {
    proposer: (TradeItem & Item)[]
    recipient: (TradeItem & Item)[]
  }
  pricing: {
    proposerTotal: number
    recipientTotal: number
    fairness: number
    priceVersion: string
    timestamp: string
  }
  metadata: {
    tradeId: string
    sessionId: string
    completedAt: string
    generatedAt: string
  }
}