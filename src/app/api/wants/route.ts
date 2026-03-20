import { NextRequest, NextResponse } from 'next/server'
import { wantSummary } from '@/types/want'
import { createClient } from '@/lib/supabase/server';
import { getWantList } from './wantList'


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
        try {
            const wants = await getWantList(userId)
            return NextResponse.json({ data: wants }, { status: 200 })
        } catch (e) {
            console.error('Error fetching wants for user:', e)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }
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

            // Insert a minimal items row. Authenticated users can insert
            // items via RLS policy (008_fix_rls_items_users.sql).
            let newItem: any = null
            try {
                const { data, error: insertItemError } = await supa
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
                    console.error('Failed to insert item from Scryfall:', insertItemError)
                    return NextResponse.json({ error: 'Database error', details: (insertItemError as any)?.message ?? insertItemError }, { status: 500 })
                }

                newItem = data
            } catch (e) {
                console.error('Error inserting item:', e)
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
        // Ensure there is an application `users` row for this auth user.
        // RLS policy (008_fix_rls_items_users.sql) allows users to insert their own row.
        try {
            const { data: existingUser } = await supa.from('users').select('id').eq('id', userData.user.id).maybeSingle();
            if (!existingUser) {
                const { error: insertUserErr } = await supa.from('users').insert({
                    id: userData.user.id,
                    email: userData.user.email,
                    name: (userData.user.user_metadata as any)?.full_name ?? userData.user.user_metadata?.name ?? null,
                })
                if (insertUserErr) {
                    console.error('Failed to insert users row:', insertUserErr)
                    return NextResponse.json({ error: 'Database error', details: (insertUserErr as any)?.message ?? insertUserErr }, { status: 500 })
                }
            }
        } catch (e) {
            console.error('Error checking/creating users row:', e)
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

        // Fetch item metadata to return the same enriched shape as GET/getWantList
        try {
            const { data: itemRow } = await supa.from('items').select('id, scryfall_id, name, set_code, collector_number, image_url').eq('id', created.item_id).maybeSingle()

            const responseObj = {
                id: String(created.id),
                itemId: String(created.item_id),
                itemName: itemRow?.name ?? '',
                itemSet: itemRow?.set_code ?? '',
                itemCollectorNumber: itemRow?.collector_number ?? '',
                itemImageUrl: itemRow?.image_url ?? null,
                quantity: created.quantity,
                minCondition: created.min_condition,
                languageOk: created.language_ok ?? [],
                finishOk: created.finish_ok ?? [],
                priority: created.priority,
            }

            return NextResponse.json(responseObj, { status: 201 })
        } catch (e) {
            console.error('Error fetching item metadata for new want:', e)
            return NextResponse.json(created ?? newWant, { status: 201 })
        }
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
    const updates: any = body;
    delete updates.id; 
        const supa: any = client
        const { data: updated, error: updateError } = await supa
            .from('wants')
            .update(updates)
            .eq('id', wantId)
            .eq('user_id', userData.user.id)
            .select();
    if (updateError) {
        console.error('Supabase update error:', updateError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!updated || updated.length === 0) {
        // If no rows were updated, check if the want exists at all
        try {
            const { data: existingWant } = await supa
                .from('wants')
                .select('id, user_id')
                .eq('id', wantId)
                .maybeSingle()

            if (existingWant) {
                if (existingWant.user_id === userData.user.id) {
                    console.warn('PUT update failed unexpectedly', { wantId, authUserId: userData.user.id })
                    return NextResponse.json({ error: 'Failed to update want' }, { status: 500 })
                }
                console.warn('PUT denied: user mismatch', { wantId, authUserId: userData.user.id, ownerId: existingWant.user_id })
                return NextResponse.json(
                    { error: 'Forbidden: cannot modify this want' },
                    { status: 403 }
                )
            }
        } catch (e) {
            console.error('Error checking want existence:', e)
        }

        return NextResponse.json({ error: 'Want not found' }, { status: 404 });
    }

        const updatedRow = Array.isArray(updated) ? updated[0] : updated;

        try {
            const { data: itemRow } = await supa.from('items').select('id, scryfall_id, name, set_code, collector_number, image_url').eq('id', updatedRow.item_id).maybeSingle()

            const responseObj = {
                id: String(updatedRow.id),
                itemId: String(updatedRow.item_id),
                itemName: itemRow?.name ?? '',
                itemSet: itemRow?.set_code ?? '',
                itemCollectorNumber: itemRow?.collector_number ?? '',
                itemImageUrl: itemRow?.image_url ?? null,
                quantity: updatedRow.quantity,
                minCondition: updatedRow.min_condition,
                languageOk: updatedRow.language_ok ?? [],
                finishOk: updatedRow.finish_ok ?? [],
                priority: updatedRow.priority,
            }

            return NextResponse.json(responseObj, { status: 200 })
        } catch (e) {
            console.error('Error fetching item metadata for updated want:', e)
            return NextResponse.json({message: 'Want updated'}, {status: 200});
        }
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