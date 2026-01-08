import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { postTweet, refreshAccessToken, uploadMedia } from '@/lib/social/x';
import { MediaAttachment } from '@/types';

/**
 * Publish a tweet to X
 * POST /api/publish/x
 * Body: { postId: string } or { content: string }
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
        const { postId, content } = body;

        // Get content from post or use direct content
        let tweetText: string;

        if (postId) {
            const { data: post, error: postError } = await supabase
                .from('posts')
                .select('content')
                .eq('id', postId)
                .eq('user_id', user.id)
                .single();

            if (postError || !post) {
                return NextResponse.json({ error: 'Post not found' }, { status: 404 });
            }
            tweetText = post.content;
        } else if (content) {
            tweetText = content;
        } else {
            return NextResponse.json({ error: 'Missing postId or content' }, { status: 400 });
        }

        // Get X connection
        const { data: connection, error: connError } = await supabase
            .from('connected_accounts')
            .select('*')
            .eq('user_id', user.id)
            .eq('platform', 'twitter')
            .single();

        if (connError || !connection) {
            return NextResponse.json({ error: 'X account not connected' }, { status: 400 });
        }

        let accessToken = connection.access_token;

        // Refresh token if expired
        if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
            try {
                const newTokens = await refreshAccessToken(connection.refresh_token);
                accessToken = newTokens.accessToken;

                // Update stored tokens
                await supabase
                    .from('connected_accounts')
                    .update({
                        access_token: newTokens.accessToken,
                        refresh_token: newTokens.refreshToken,
                        token_expires_at: newTokens.expiresAt.toISOString(),
                    })
                    .eq('user_id', user.id)
                    .eq('platform', 'twitter');
            } catch (refreshError) {
                console.error('Failed to refresh X token:', refreshError);
                return NextResponse.json(
                    { error: 'X token expired. Please reconnect your account.' },
                    { status: 401 }
                );
            }
        }

        // Handle Media Attachments
        const mediaIds: string[] = [];
        if (postId) {
            // Query post AND its platform-specific data
            const { data: post, error: mediaQueryError } = await supabase
                .from('posts')
                .select('content, media, post_platforms!inner(platform, metadata)')
                .eq('id', postId)
                .eq('post_platforms.platform', 'twitter')
                .single();

            console.log('[X] ====== MEDIA DEBUG START ======');
            console.log('[X] Post ID:', postId);
            console.log('[X] Post data:', post ? {
                hasSharedMedia: !!post.media,
                sharedMediaLength: post.media?.length,
                sharedMedia: JSON.stringify(post.media),
                platformData: JSON.stringify(post.post_platforms)
            } : 'null');
            console.log('[X] Query error:', mediaQueryError);

            // Determine which media to use:
            // 1. Platform-specific media from post_platforms.metadata.media (priority)
            // 2. Fallback to shared media from posts.media
            type PlatformRecord = { platform: string; metadata?: { media?: MediaAttachment[] } };
            const twitterPlatform = (post?.post_platforms as PlatformRecord[] | undefined)?.find(
                (p: PlatformRecord) => p.platform === 'twitter'
            );
            const platformMedia = twitterPlatform?.metadata?.media as MediaAttachment[] | undefined;
            const sharedMedia = post?.media as MediaAttachment[] | undefined;

            // Use platform-specific media if available, otherwise shared
            const mediaToUpload = (platformMedia && platformMedia.length > 0)
                ? platformMedia
                : (sharedMedia || []);

            console.log('[X] Platform-specific media:', platformMedia?.length || 0);
            console.log('[X] Shared media:', sharedMedia?.length || 0);
            console.log('[X] Using media:', mediaToUpload.length);

            if (mediaToUpload.length > 0) {
                // X allows up to 4 photos
                const attachments = mediaToUpload.slice(0, 4);
                console.log('[X] Processing', attachments.length, 'attachments');

                // Upload in parallel
                // Fail-fast: If any image fails, the whole post fails.
                const uploadedIds = await Promise.all(attachments.map(async (media: MediaAttachment, index: number) => {
                    console.log(`[X] Attachment ${index}:`, { url: media.url, type: media.type });

                    // Fetch image buffer
                    const fileRes = await fetch(media.url);
                    if (!fileRes.ok) {
                        console.error(`[X] Failed to fetch attachment ${index}:`, fileRes.status, fileRes.statusText);
                        throw new Error(`Failed to fetch image: ${media.url}`);
                    }
                    const arrayBuffer = await fileRes.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);

                    // Infer MIME type from URL extension or content-type header
                    let mimeType = fileRes.headers.get('content-type') || '';
                    if (!mimeType || mimeType === 'application/octet-stream') {
                        // Fallback: infer from URL extension
                        const url = media.url.toLowerCase();
                        if (url.includes('.png')) mimeType = 'image/png';
                        else if (url.includes('.gif')) mimeType = 'image/gif';
                        else if (url.includes('.webp')) mimeType = 'image/webp';
                        else if (url.includes('.mp4')) mimeType = 'video/mp4';
                        else if (url.includes('.mov')) mimeType = 'video/quicktime';
                        else if (media.type === 'video') mimeType = 'video/mp4';
                        else mimeType = 'image/jpeg'; // Default for images
                    }

                    console.log(`[X] Uploading attachment ${index}:`, { mimeType, size: buffer.length });

                    // Upload to X
                    const mediaId = await uploadMedia(accessToken, buffer, mimeType);
                    console.log(`[X] Upload success for attachment ${index}:`, mediaId);
                    return mediaId;
                }));

                mediaIds.push(...uploadedIds);
                console.log('[X] All uploads complete, mediaIds:', mediaIds);
            } else {
                console.log('[X] No media to upload');
            }
            console.log('[X] ====== MEDIA DEBUG END ======');
        }

        // Post the tweet
        console.log('[X] Creating tweet with mediaIds:', mediaIds);
        const tweet = await postTweet(accessToken, tweetText, mediaIds);
        console.log('[X] Tweet created:', tweet);

        return NextResponse.json({
            success: true,
            tweetId: tweet.id,
            tweetText: tweet.text,
            mediaIdsCount: mediaIds.length
        });

    } catch (error) {
        console.error('X publish error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to publish to X' },
            { status: 500 }
        );
    }
}
