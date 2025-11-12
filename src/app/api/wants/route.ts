import { NextRequest, NextResponse } from 'next/server'
import { wantSummary } from '@/types/want'
import { Database } from '@/types/supabase'
import { createClient } from '@/lib/supabase/server'


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

    // Fetch wants for the authenticated user
    const { data: rows, error: selectError } = await client
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
    

    const newWant: wantSummary = body as wantSummary;
    return NextResponse.json(newWant, {status: 201});
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

    const wantId = body.id;
    const { error: deleteError } = await client
        .from('wants')
        .delete()
        .eq('id', wantId)
        .eq('user_id', userData.user.id);

    if (deleteError) {
        console.error('Supabase delete error:', deleteError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({message: 'Want deleted'}, {status: 200});
}