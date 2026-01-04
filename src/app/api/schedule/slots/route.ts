import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: slots, error } = await supabase
        .from('weekly_slots')
        .select('*, content_libraries(name, color, platforms)')
        .eq('user_id', user.id)
        .order('day_of_week')
        .order('time_of_day');

    if (error) {
        console.error('Error fetching weekly_slots:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(slots);
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { library_id, day_of_week, time_of_day, platform_ids } = body;

        if (!library_id || day_of_week === undefined || !time_of_day || !platform_ids) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('weekly_slots')
            .insert({
                user_id: user.id,
                library_id,
                day_of_week,
                time_of_day,
                platform_ids
            })
            .select('*, content_libraries(name, color, platforms)')
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { id, library_id, day_of_week, time_of_day, platform_ids } = body;

        if (!id || !library_id || day_of_week === undefined || !time_of_day || !platform_ids) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('weekly_slots')
            .update({
                library_id,
                day_of_week,
                time_of_day,
                platform_ids
            })
            .eq('id', id)
            .eq('user_id', user.id)
            .select('*, content_libraries(name, color, platforms)')
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get ID from URL query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { error } = await supabase
        .from('weekly_slots')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
