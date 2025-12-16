import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { postToInstagram } from '@/lib/social/meta';

export async function POST(request: NextRequest) {
    try {
        const { postId, content, imageUrl } = await request.json();

        if (!content) {
            return NextResponse.json(
                { error: 'Content is required' },
                { status: 400 }
            );
        }

        if (!imageUrl) {
            return NextResponse.json(
                { error: 'Instagram requires an image URL. Text-only posts are not supported.' },
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

        // Get Instagram connection
        const { data: connection } = await supabase
            .from('connected_accounts')
            .select('*')
            .eq('user_id', user.id)
            .eq('platform', 'instagram')
            .single();

        if (!connection) {
            return NextResponse.json(
                { error: 'Instagram not connected. Please connect your account in Settings.' },
                { status: 400 }
            );
        }

        // Get metadata with page access token
        const metadata = connection.metadata as { pageId?: string; pageName?: string };

        if (!connection.platform_user_id || !connection.access_token) {
            return NextResponse.json(
                { error: 'Instagram connection is incomplete. Please reconnect.' },
                { status: 400 }
            );
        }

        // Post to Instagram
        const result = await postToInstagram(
            connection.platform_user_id,
            connection.access_token,
            content,
            imageUrl
        );

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
                message: `Published to Instagram: ${metadata?.pageName || 'Business Account'}`,
                post_id: postId,
            });
        }

        return NextResponse.json({
            success: true,
            platformPostId: result.id,
        });
    } catch (error) {
        console.error('Instagram publish error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to publish' },
            { status: 500 }
        );
    }
}
