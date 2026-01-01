
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { postBlueskyRecord, refreshAccessToken } from '@/lib/social/bluesky';
import { SocialLogger } from '@/lib/social/logger';
import crypto from 'crypto';

/**
 * Publish a post to Bluesky
 * POST /api/publish/bluesky
 * Body: { postId: string } or { content: string, media?: { url: string, alt?: string }[] }
 */
export async function POST(request: NextRequest) {
    const requestId = crypto.randomUUID();
    const context = { platform: 'bluesky' as const, action: 'publish_api', requestId };
    SocialLogger.info(context, 'Publish request started');

    try {
        // Authenticate user
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            SocialLogger.warn(context, 'Unauthorized request');
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
                .select('*')
                .eq('id', postId)
                .eq('user_id', user.id)
                .single();

            if (postError || !post) {
                SocialLogger.warn(context, 'Post not found', { postId });
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }
            postContent = post.content;
            postMedia = post.media as any;
        } else if (content) {
            postContent = content;
            postMedia = media;
        } else {
            SocialLogger.warn(context, 'Missing content');
            return NextResponse.json({ error: 'Missing postId or content' }, { status: 400 });
        }

        // Get Bluesky connection
        const { data: connection, error: connError } = await supabase
            .from('connected_accounts')
            .select('*')
            .eq('user_id', user.id)
            .eq('platform', 'bluesky')
            .single();

        if (connError || !connection) {
            SocialLogger.error(context, 'No connection found', { userId: user.id });
            return NextResponse.json({ error: 'Bluesky account not connected' }, { status: 400 });
        }

        SocialLogger.info(context, 'Connection found', { username: connection.platform_username });

        let accessToken = connection.access_token;
        const did = connection.platform_user_id;

        // Retrieve DPoP keys if available
        let dpopKey;
        if (connection.credentials &&
            (connection.credentials as any).dpop_private_key &&
            (connection.credentials as any).dpop_public_key
        ) {
            const creds = connection.credentials as any;
            // Import JWKs back to Keys to create the DpopKeyPair object
            const { importFromJSON } = await import('@/lib/social/bluesky');
            const privateKey = await importFromJSON(creds.dpop_private_key);
            const publicKey = await importFromJSON(creds.dpop_public_key);

            dpopKey = {
                privateKey,
                publicKey
            };
            SocialLogger.info(context, 'DPoP keys retrieved');
        } else {
            SocialLogger.warn(context, 'No DPoP keys use, falling back to Bearer (public client mode?)');
        }

        // Check Token Expiry (Safety margin of 5 mins)
        // Bluesky tokens often expire short term, so we check carefully.
        const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
        const isExpired = expiresAt && expiresAt < new Date(Date.now() + 5 * 60 * 1000);

        if (isExpired) {
            try {
                if (!connection.refresh_token) {
                    SocialLogger.warn(context, 'Token expired, no refresh token');
                    return NextResponse.json(
                        { error: 'Bluesky token expired and no refresh token available. Reconnect.' },
                        { status: 401 }
                    );
                }

                const newTokens = await refreshAccessToken(connection.refresh_token);
                accessToken = newTokens.accessToken;

                // Update stored tokens
                await supabase
                    .from('connected_accounts')
                    .update({
                        access_token: newTokens.accessToken,
                        refresh_token: newTokens.refreshToken, // Refresh token also rotates
                        token_expires_at: newTokens.expiresIn ? new Date(Date.now() + newTokens.expiresIn * 1000).toISOString() : null,
                    })
                    .eq('user_id', user.id)
                    .eq('platform', 'bluesky');

                SocialLogger.info(context, 'Token refreshed');
            } catch (refreshError) {
                SocialLogger.error(context, 'Failed to refresh token', refreshError);
                return NextResponse.json(
                    { error: 'Bluesky session expired. Please reconnect your account.' },
                    { status: 401 }
                );
            }
        }

        // Fetch images (Max 4 for Bluesky)
        const imageBuffers: { buffer: Buffer, alt?: string }[] = [];

        if (postMedia && postMedia.length > 0) {
            // Bluesky limit is 4 images
            const mediaToUpload = postMedia.slice(0, 4);

            for (const item of mediaToUpload) {
                try {
                    const imgRes = await fetch(item.url);
                    if (!imgRes.ok) throw new Error(`Failed to download image: ${item.url}`);
                    const arrayBuffer = await imgRes.arrayBuffer();
                    imageBuffers.push({
                        buffer: Buffer.from(arrayBuffer),
                        alt: item.alt
                    });
                } catch (err) {
                    SocialLogger.error(context, 'Image fetch failed', err);
                    return NextResponse.json({ error: 'Failed to process image attachment' }, { status: 500 });
                }
            }
        }

        // Post to Bluesky
        SocialLogger.info(context, 'Calling postBlueskyRecord...');
        const result = await postBlueskyRecord(accessToken, did, postContent, imageBuffers, dpopKey);
        SocialLogger.info(context, 'Post success', { uri: result.uri });

        return NextResponse.json({
            success: true,
            platformId: result.uri, // URI is the unique identifier
            postId: result.id
        });

    } catch (error) {
        SocialLogger.error(context, 'Publish Error', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to publish to Bluesky' },
            { status: 500 }
        );
    }
}
