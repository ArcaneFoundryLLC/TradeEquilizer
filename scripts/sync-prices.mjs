#!/usr/bin/env node

/**
 * Daily Price Synchronization Script
 * 
 * This script is designed to run as a daily cron job to sync pricing data
 * from external sources (TCGplayer, Scryfall, etc.) into our database.
 * 
 * For P0 MVP, this runs with mock data but is structured to easily
 * integrate with real pricing APIs when available.
 * 
 * Usage:
 *   node scripts/sync-prices.mjs
 *   npm run sync-prices
 * 
 * Environment variables should be set in .env file or system environment
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey || supabaseKey === 'your_supabase_service_role_key_here') {
  console.error('Missing required environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY (must be the real service role key, not the placeholder)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Configuration
const BATCH_SIZE = 100
const PRICE_SOURCE = process.env.PRICE_SOURCE || 'mock'
const SYNC_VERSION = `sync-${new Date().toISOString().split('T')[0]}`

// Mock price generator (same logic as API)
function generateMockPrice(item) {
  let basePrice = 1.0
  
  if (item.name.includes('Black Lotus')) basePrice = 25000
  else if (item.name.includes('Mox')) basePrice = 5000
  else if (item.name.includes('Dual Land') || item.name.includes('Underground Sea') || item.name.includes('Tropical Island')) basePrice = 400
  else if (item.name.includes('Jace') || item.name.includes('Liliana') || item.name.includes('Tarmogoyf')) basePrice = 50
  else if (item.name.includes('Snapcaster') || item.name.includes('Force of Will')) basePrice = 25
  else if (item.name.includes('Lightning Bolt')) basePrice = 0.5
  else if (item.name.includes('Counterspell') || item.name.includes('Shock')) basePrice = 0.25
  else basePrice = Math.random() * 10 + 0.1

  const market = Math.round(basePrice * 100) / 100
  const low = Math.round(market * 0.8 * 100) / 100
  const high = Math.round(market * 1.2 * 100) / 100

  return {
    item_id: item.id,
    source: 'tcgplayer_market',
    currency: 'USD',
    market,
    low,
    high,
    condition_multipliers: {
      NM: 1.0,
      LP: 0.9,
      MP: 0.75,
      HP: 0.5,
    },
    finish_multipliers: {
      normal: 1.0,
      foil: 1.5,
      etched: 1.3,
      showcase: 1.2,
    },
    version: SYNC_VERSION,
    as_of: new Date().toISOString(),
  }
}

async function syncPrices() {
  console.log(`Starting price sync with source: ${PRICE_SOURCE}`)
  console.log(`Sync version: ${SYNC_VERSION}`)
  
  try {
    // Get all items that need price updates
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, name, set_code, collector_number, tcgplayer_id, scryfall_id')
      .not('tcgplayer_id', 'is', null) // Only sync items with TCGplayer IDs
      .limit(BATCH_SIZE)

    if (itemsError) {
      throw new Error(`Failed to fetch items: ${itemsError.message}`)
    }

    if (!items || items.length === 0) {
      console.log('No items found to sync')
      return
    }

    console.log(`Found ${items.length} items to sync`)

    // Generate price data for each item
    const priceData = items.map(item => generateMockPrice(item))

    // Insert price data into database
    const { error: insertError } = await supabase
      .from('prices')
      .insert(priceData)

    if (insertError) {
      throw new Error(`Failed to insert prices: ${insertError.message}`)
    }

    console.log(`Successfully synced ${priceData.length} price records`)
    console.log(`Sync completed at: ${new Date().toISOString()}`)

  } catch (error) {
    console.error('Price sync failed:', error)
    process.exit(1)
  }
}

// Run the sync
syncPrices()
