#!/usr/bin/env node

// Generate a minimal SQL seed file for the `items` table from Scryfall results.
// This does NOT write to the database directly; apply the SQL via Supabase SQL editor
// or CLI. Useful for local testing when you don't have a service role key available.

import fs from 'node:fs'
import path from 'node:path'

const OUTPUT_PATH = path.resolve(process.cwd(), 'supabase', 'seed_items.sql')

// Curated queries: popular MTG staples/creatures for testing
const QUERIES = [
  // Popular staples
  'q=order:edhrec+unique:cards+t:artifact+game:paper',
  'q=order:edhrec+unique:cards+t:instant+game:paper',
  'q=order:edhrec+unique:cards+t:sorcery+game:paper',
  // Low-CMC creatures for quick UI checks
  'q=t:creature+cmc<=3+order:edhrec+unique:cards+game:paper'
]

async function fetchScryfall(query) {
  const url = `https://api.scryfall.com/cards/search?${query}`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'TradeEqualizer/seed-script'
    }
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Scryfall error: ${res.status} ${text}`)
  }
  return await res.json()
}

function escapeSql(str) {
  return str.replace(/'/g, "''")
}

function buildInsertRows(cards) {
  // Map Scryfall card objects into fields used by items
  // Use English prints, prefer normal image if available
  return cards
    .filter((c) => c?.lang === 'en' && c?.set && c?.collector_number && c?.id)
    .map((c) => {
      const name = escapeSql(c.name)
      const setCode = escapeSql(c.set)
      const collector = escapeSql(String(c.collector_number))
      const scryfallId = c.id // UUID string
      const imageUrl = c.image_uris?.small || c.image_uris?.normal || null
      const image = imageUrl ? `'${escapeSql(imageUrl)}'` : 'NULL'
      return `('${name}','${setCode}','${collector}','mtg','${scryfallId}',${image})`
    })
}

async function main() {
  const allRows = []
  for (const q of QUERIES) {
    // Small delay to be polite to Scryfall
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 120))
    // eslint-disable-next-line no-await-in-loop
    const data = await fetchScryfall(q)
    const cards = Array.isArray(data?.data) ? data.data : []
    const rows = buildInsertRows(cards)
    allRows.push(...rows)
  }

  // De-duplicate on scryfall_id by building a map
  const unique = new Map()
  for (const row of allRows) {
    // Row format: ('name','set','collector','mtg','<uuid>',NULL|'image')
    const match = row.match(/,'([0-9a-fA-F-]{36})',/)
    if (match) unique.set(match[1], row)
  }
  const deduped = Array.from(unique.values())

  const header = `-- Seed a minimal subset of MTG items from Scryfall\n-- Apply this in Supabase SQL editor or CLI.\n-- Safe to run multiple times due to ON CONFLICT on scryfall_id.\n\n`;
  const sql = `${header}INSERT INTO items (name, set_code, collector_number, game, scryfall_id, image_url)\nVALUES\n${deduped.join(',\n')}\nON CONFLICT (scryfall_id) DO NOTHING;\n`

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, sql, 'utf8')
  // eslint-disable-next-line no-console
  console.log(`Wrote ${deduped.length} rows to ${OUTPUT_PATH}`)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})


