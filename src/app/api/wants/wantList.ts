import { createClient } from '@/lib/supabase/server'

export async function getWantList(userId: string) {
  const supa = await createClient()

  const { data, error } = await (supa as any)
    .from('wants')
    .select(`
      id,
      item_id,
      quantity,
      priority,
      min_condition,
      language_ok,
      finish_ok,
      items (
        id,
        scryfall_id,
        name,
        set_code,
        collector_number,
        image_url
      )
    `)
    .eq('user_id', userId)
    .order('priority', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    itemId: String(row.item_id),
    itemName: row.items?.name ?? '',
    itemSet: row.items?.set_code ?? '',
    itemCollectorNumber: row.items?.collector_number ?? '',
    itemImageUrl: row.items?.image_url ?? null,
    quantity: row.quantity,
    minCondition: row.min_condition,
    languageOk: row.language_ok ?? [],
    finishOk: row.finish_ok ?? [],
    priority: row.priority,
  }))
}
