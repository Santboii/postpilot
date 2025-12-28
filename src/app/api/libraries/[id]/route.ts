import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch the library
    const { data: library, error: libError } = await supabase
        .from('content_libraries')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

    if (libError || !library) {
        return NextResponse.json({ error: 'Library not found' }, { status: 404 });
    }

    // Fetch posts in this library with their platform assignments
    const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select(`
            *,
            post_platforms (
                platform
            )
        `)
        .eq('library_id', id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (postsError) {
        console.error('Error fetching posts:', postsError);
    }

    return NextResponse.json({
        library,
        posts: posts || []
    });
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Fields allowed to update
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.topic_prompt !== undefined) updates.topic_prompt = body.topic_prompt;
    if (body.is_paused !== undefined) updates.is_paused = body.is_paused;
    if (body.ai_settings !== undefined) updates.ai_settings = body.ai_settings;
    if (body.platforms !== undefined) updates.platforms = body.platforms;

    const { error } = await supabase
        .from('content_libraries')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error updating library:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Delete the library
    // Note: This relies on cascading deletes for related posts/schedules if configured in DB
    // Otherwise we might need to delete related items manually first
    const { error } = await supabase
        .from('content_libraries')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error deleting library:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
