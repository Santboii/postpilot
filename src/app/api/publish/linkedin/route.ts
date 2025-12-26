import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { postLinkedInShare, refreshLinkedInToken } from '@/lib/social/linkedin';

/**
 * Publish a post to LinkedIn
 * POST /api/publish/linkedin
 * Body: { postId: string } or { content: string, media?: { url: string, alt?: string }[] }
 */
export async function POST(request: NextRequest) {
    try {
        // Authenticate user
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body
        const body = await request.json();
        const { postId, content, media } = body;

        // Get content and/or media
        let postContent: string;
        let postMedia: { url: string, alt?: string }[] | undefined;

        if (postId) {
            const { data: post, error: postError } = await supabase
                .from('posts')
                .select('*') // Get full post for media
                .eq('id', postId)
                .eq('user_id', user.id)
                .single();

            if (postError || !post) {
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }
            postContent = post.content;
            // Assuming post.media is stored as array of objects in DB or helper needed
            // For now, let's assume if it's coming from DB it might need parsing or is JSONB
            // This is a simplification, actual data structure of `posts.media` matters
            postMedia = post.media as any;
        } else if (content) {
            postContent = content;
            postMedia = media;
        } else {
            return NextResponse.json({ error: 'Missing postId or content' }, { status: 400 });
        }

        // Get LinkedIn connection
        const { data: connection, error: connError } = await supabase
            .from('connected_accounts')
            .select('*')
            .eq('user_id', user.id)
            .eq('platform', 'linkedin')
            .single();

        if (connError || !connection) {
            return NextResponse.json({ error: 'LinkedIn account not connected' }, { status: 400 });
        }

        let accessToken = connection.access_token;
        const platformUserId = connection.platform_user_id;

        // Refresh token if expired
        if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
            try {
                // Check if we have a refresh token (LinkedIn sometimes doesn't give them on basic scopes or if expired)
                if (!connection.refresh_token) {
                    return NextResponse.json(
                        { error: 'LinkedIn token expired and no refresh token available. Please reconnect.' },
                        { status: 401 }
                    );
                }

                const newTokens = await refreshLinkedInToken(connection.refresh_token);
                accessToken = newTokens.accessToken;

                // Update stored tokens
                await supabase
                    .from('connected_accounts')
                    .update({
                        access_token: newTokens.accessToken,
                        refresh_token: newTokens.refreshToken ?? connection.refresh_token,
                        token_expires_at: newTokens.expiresIn ? new Date(Date.now() + newTokens.expiresIn * 1000).toISOString() : null,
                    })
                    .eq('user_id', user.id)
                    .eq('platform', 'linkedin');
            } catch (refreshError) {
                console.error('Failed to refresh LinkedIn token:', refreshError);
                return NextResponse.json(
                    { error: 'LinkedIn token expired. Please reconnect your account.' },
                    { status: 401 }
                );
            }
        }

        // Fetch image if present (Handling single image for now as per MVP)
        let imageBuffer: Buffer | undefined;
        let imageAlt: string | undefined;

        if (postMedia && postMedia.length > 0) {
            const mediaItem = postMedia[0];
            try {
                const imgRes = await fetch(mediaItem.url);
                if (!imgRes.ok) throw new Error('Failed to download image');
                const arrayBuffer = await imgRes.arrayBuffer();
                imageBuffer = Buffer.from(arrayBuffer);
                imageAlt = mediaItem.alt;
            } catch (err) {
                console.error('Failed to process image for LinkedIn:', err);
                // Proceed without image or fail? Let's fail for now to be safe
                return NextResponse.json({ error: 'Failed to process image attachment' }, { status: 500 });
            }
        }

        // Post to LinkedIn
        const result = await postLinkedInShare(accessToken, platformUserId, postContent, imageBuffer, imageAlt);

        return NextResponse.json({
            success: true,
            platformId: result.id, // LinkedIn generic URN
        });

    } catch (error) {
        console.error('LinkedIn publish error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to publish to LinkedIn' },
            { status: 500 }
        );
    }
}
