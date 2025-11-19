import { NextRequest, NextResponse } from 'next/server'
import { wantSummary } from '@/types/want'
import { Database } from '@/types/supabase'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import next from 'next';


export async function GET(){
    // Authenticate user
    const client =  await createClient();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) {
        return NextResponse.json(
            {error: 'Unauthorized'},
            {status: 401}
        )
    }

    const userId = userData.user.id
    const supa: any = client;

    // Fetch wants for the authenticated user
    const { data: rows, error: selectError } = await supa
        .from('wants')
        .select('id, item_id, quantity, priority')
        .eq('user_id', userId)
        .order('priority', { ascending: true })

    // Handle potential database errors
    if (selectError) {
        console.error('Supabase select error:', selectError)
        return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Map database rows to wantSummary objects
   const wants = (rows ?? []).map((r: any) => ({
    id: String(r.id),
    itemId: String(r.item_id),
    quantity: r.quantity,
    priority: r.priority,
    }));

    return NextResponse.json(wants, {status: 200});
}


export async function POST(request: NextRequest) {
    const body = await request.json();
    if (!body) {
        return NextResponse.json(
            {error: 'Missing request body'},
            {status: 400}
        )
    }
    const client = await createClient();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) {
        return NextResponse.json(
            {error: 'Unauthorized'},
            {status: 401}
        )
    }
    const newWant: wantSummary = body as wantSummary;

    if (!newWant.itemId || typeof newWant.itemId !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid itemId' }, { status: 400 });
    }
    if (typeof newWant.quantity !== 'number' || newWant.quantity <= 0) {
        return NextResponse.json({ error: 'Missing or invalid quantity' }, { status: 400 });
    }

    // Resolve the item_id: incoming itemId may be either an items.id (UUID)
    // or a Scryfall card id (scryfall_id). We must ensure an items row
    // exists so the FK constraint doesn't fail.
    const supa: any = client;

    // Try to find the item by primary id first
    let resolvedItemId: string | null = null;
    try {
        // 1) Find by items.id
        const { data: byId } = await supa.from('items').select('id').eq('id', newWant.itemId).maybeSingle();
        if (byId && byId.id) {
            resolvedItemId = byId.id;
        } else {
            // 2) Find by scryfall_id
            const { data: byScry } = await supa.from('items').select('id').eq('scryfall_id', newWant.itemId).maybeSingle();
            if (byScry && byScry.id) {
                resolvedItemId = byScry.id;
            }
        }
    } catch (e) {
        console.error('Error resolving item:', e);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // If we still don't have an items row, attempt to fetch from Scryfall and insert a minimal items row.
    if (!resolvedItemId) {
        try {
            const sfRes = await fetch(`https://api.scryfall.com/cards/${encodeURIComponent(newWant.itemId)}`, {
                headers: { 'Accept': 'application/json', 'User-Agent': 'TradeEqualizer/0.1' },
                cache: 'no-store',
            });
            if (!sfRes.ok) {
                const text = await sfRes.text().catch(() => '');
                console.error('Scryfall fetch failed:', sfRes.status, text);
                return NextResponse.json({ error: 'Unable to resolve card id' }, { status: 400 });
            }

            const card = await sfRes.json();

                        // Insert a minimal items row required by the schema. Use the
                        // service role client to bypass row level security for items.
                        let newItem: any = null
                                    try {
                                        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
                                            console.error('SUPABASE_SERVICE_ROLE_KEY is not set in server environment')
                                            return NextResponse.json({ error: 'Server configuration error', details: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
                                        }
                                        const service = await createServiceClient()
                            const { data, error: insertItemError } = await (service as any)
                                .from('items')
                                .insert({
                                    scryfall_id: card.id,
                                    name: card.name ?? 'Unknown',
                                    set_code: (card.set as string) ?? 'unknown',
                                    collector_number: card.collector_number ?? '0',
                                    image_url: card.image_uris?.normal ?? null,
                                })
                                .select()
                                .maybeSingle()

                            if (insertItemError) {
                                console.error('Failed to insert item from Scryfall (service):', insertItemError)
                                return NextResponse.json({ error: 'Database error', details: (insertItemError as any)?.message ?? insertItemError }, { status: 500 })
                            }

                            newItem = data
                        } catch (e) {
                            console.error('Error inserting item with service client:', e)
                            return NextResponse.json({ error: 'Database error', details: String(e) }, { status: 500 })
                        }

                        resolvedItemId = newItem?.id ?? null;
            if (!resolvedItemId) {
                return NextResponse.json({ error: 'Failed to create item record' }, { status: 500 });
            }
        } catch (e) {
            console.error('Error fetching/inserting Scryfall item:', e);
            return NextResponse.json({ error: 'Unable to resolve card id' }, { status: 400 });
        }
    }

    // Now insert the want using the resolved items.id
        // Ensure there is an application `users` row for this auth user. The
        // `users` table has RLS policies so we use the service client to upsert
        // a minimal record if it doesn't exist.
        try {
            const { data: existingUser } = await supa.from('users').select('id').eq('id', userData.user.id).maybeSingle();
            if (!existingUser) {
                if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
                    console.error('SUPABASE_SERVICE_ROLE_KEY is not set; cannot create users row')
                    return NextResponse.json({ error: 'Server configuration error', details: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
                }
                try {
                    const svc = await createServiceClient()
                    const upsertPayload = {
                        id: userData.user.id,
                        email: userData.user.email,
                        name: (userData.user.user_metadata as any)?.full_name ?? userData.user.user_metadata?.name ?? null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }
                    const { error: upsertErr } = await (svc as any).from('users').upsert(upsertPayload)
                    if (upsertErr) {
                        console.error('Failed to upsert users row via service client:', upsertErr)
                        return NextResponse.json({ error: 'Database error', details: (upsertErr as any)?.message ?? upsertErr }, { status: 500 })
                    }
                } catch (e) {
                    console.error('Error creating users row via service client:', e)
                    return NextResponse.json({ error: 'Database error', details: String(e) }, { status: 500 })
                }
            }
        } catch (e) {
            console.error('Error checking users row:', e)
            return NextResponse.json({ error: 'Database error', details: String(e) }, { status: 500 })
        }

    const { data: inserted, error: insertError } = await supa
        .from('wants')
        .insert({
            user_id: userData.user.id,
            item_id: resolvedItemId,
            quantity: newWant.quantity,
            priority: newWant.priority ?? 1,
            min_condition: 'NM',
        language_ok: (newWant as any).language_ok ?? [],
        })
        .select();

    if (insertError) {
        console.error('Supabase insert error:', insertError);
        // Return insert error details to help debug during development.
        const details = (insertError as any)?.message ?? insertError;
        return NextResponse.json({ error: 'Database error', details }, { status: 500 });
    }

    const created = Array.isArray(inserted) ? inserted[0] : inserted;
    return NextResponse.json(created ?? newWant, { status: 201 });
}

export async function PUT(request: NextRequest) {
    const client = await createClient();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) {
        return NextResponse.json(
            {error: 'Unauthorized'},
            {status: 401}
        )
    }
    let body = await request.json();
    if (!body || !body.id) {
        return NextResponse.json(
            {error: 'Missing want id in request body'},
            {status: 400}
        )
    }
    const wantId = body.id;
    const updates: Partial<Database['public']['Tables']['wants']['Update']> = body;
    delete updates.id; 
        const supa: any = client
        const { data: updated, error: updateError } = await supa
            .from('wants')
            .update(updates)
            .eq('id', wantId)
            .eq('user_id', userData.user.id);
    if (updateError) {
        console.error('Supabase update error:', updateError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
        return NextResponse.json({ error: 'Want not found' }, { status: 404 });
    }

    return NextResponse.json({message: 'Want updated'}, {status: 200});
}

export async function DELETE(request: NextRequest) {
    const client = await createClient();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) {
        return NextResponse.json(
            {error: 'Unauthorized'},
            {status: 401}
        )
    }
    
    let body = await request.json();
    if (!body || !body.id) {
        return NextResponse.json(
            {error: 'Missing want id in request body'},
            {status: 400}
        )
    }

    const supa: any = client;
    const wantId = body.id;
    const { data: deleted, error: deleteError } = await supa
        .from('wants')
        .delete()
        .eq('id', wantId)
        .eq('user_id', userData.user.id)
        .select();

    if (deleteError) {
        console.error('Supabase delete error:', deleteError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (deleteError || deleted.length == 0) {
        return NextResponse.json({error: 'Want not found'}, {status: 404});
    }

    return NextResponse.json({message: 'Want deleted'}, {status: 200});
}