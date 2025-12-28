import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: libraries, error } = await supabase
        .from('content_libraries')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching content_libraries:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also get counts
    // This is a bit expensive, maybe optimize later with a view or separate query
    const librariesWithCounts = await Promise.all(libraries.map(async (lib) => {
        const { count } = await supabase
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('library_id', lib.id);
        return { ...lib, post_count: count || 0 };
    }));

    return NextResponse.json(librariesWithCounts);
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, color, is_paused, auto_remix, generate_images, topic_prompt, template_type } = body;

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('content_libraries')
            .insert({
                user_id: user.id,
                name,
                color: color || '#6366f1',
                is_paused: is_paused || false,
                auto_remix: auto_remix || false,
                generate_images: generate_images || false,
                topic_prompt: topic_prompt || null,
                template_type: template_type || 'custom'
            })
            .select()
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
        const { id, name, color, is_paused, auto_remix, generate_images } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('content_libraries')
            .update({
                name,
                color,
                is_paused,
                auto_remix,
                generate_images
            })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
