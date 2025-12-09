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