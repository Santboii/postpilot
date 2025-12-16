import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { postToFacebookPage } from '@/lib/social/meta';

export async function POST(request: NextRequest) {
    try {
        const { postId, content } = await request.json();

        if (!content) {
            return NextResponse.json(
                { error: 'Content is required' },
                { status: 400 }
            );
        }

        // Get current user
        const supabase = getSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        // Get Facebook connection
        const { data: connection } = await supabase
            .from('connected_accounts')
            .select('*')
            .eq('user_id', user.id)
            .eq('platform', 'facebook')
            .single();

        if (!connection) {
            return NextResponse.json(
                { error: 'Facebook not connected. Please connect your account in Settings.' },
                { status: 400 }
            );
        }

        // Get pages from metadata
        const metadata = connection.metadata as { pages?: Array<{ id: string; accessToken: string; name: string }> };
        const pages = metadata?.pages || [];

        if (pages.length === 0) {
            return NextResponse.json(
                { error: 'No Facebook pages found. Make sure you have a page connected.' },
                { status: 400 }
            );
        }

        // Post to first page (in future, let user choose)
        const page = pages[0];
        const result = await postToFacebookPage(page.id, page.accessToken, content);

        // Update post status if postId provided
        if (postId) {
            await supabase
                .from('posts')
                .update({
                    status: 'published',
                    published_at: new Date().toISOString(),
                })
                .eq('id', postId);

            // Log activity
            await supabase.from('activities').insert({
                user_id: user.id,
                type: 'published',
                message: `Published to Facebook: ${page.name}`,
                post_id: postId,
            });
        }

        return NextResponse.json({
            success: true,
            platformPostId: result.id,
            page: page.name,
        });
    } catch (error) {
        console.error('Facebook publish error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to publish' },
            { status: 500 }
        );
    }
}
