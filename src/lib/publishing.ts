import { createAdminClient } from '@/lib/supabase/admin';
import { SupabaseClient } from '@supabase/supabase-js';
import { PlatformId, MediaAttachment } from '@/types';
import { postTweet, refreshAccessToken, uploadMedia } from '@/lib/social/x';
import { postToFacebookPage, postToInstagram } from '@/lib/social/meta';

// Define DB types locally to strictly type the admin query results

interface DbPostPlatform {
    platform: PlatformId;
    custom_content: string | null;
}

interface DbConnection {
    id: string;
    platform: PlatformId;
    access_token: string;
    refresh_token: string;
    token_expires_at: string | null;
    platform_user_id: string; // page ID for FB
}

export async function publishScheduledPosts() {
    const supabase = createAdminClient();
    const results = {
        processed: 0,
        published: 0,
        failed: 0,
        errors: [] as string[],
    };

    try {
        // 1. Get due scheduled posts
        const now = new Date().toISOString();
        const { data: posts, error: postsError } = await supabase
            .from('posts')
            .select(`
                id, 
                user_id, 
                content, 
                media, 
                scheduled_at,
                post_platforms (platform, custom_content)
            `)
            .eq('status', 'scheduled')
            .lte('scheduled_at', now)
            .limit(50); // Batch size

        if (postsError) throw new Error(`Failed to fetch posts: ${postsError.message}`);
        if (!posts || posts.length === 0) return results;

        results.processed = posts.length;

        // 2. Process each post
        for (const post of posts) {
            try {
                // Get user's connections
                const { data: connections, error: connError } = await supabase
                    .from('connected_accounts')
                    .select('*')
                    .eq('user_id', post.user_id);

                if (connError) throw new Error(`Failed to fetch connections for user ${post.user_id}`);

                const platforms = post.post_platforms as DbPostPlatform[];
                const platformResults: string[] = [];
                let hasFailures = false;

                // 3. Publish to each platform
                for (const platformData of platforms) {
                    const platformId = platformData.platform;
                    const connection = connections.find(c => c.platform === platformId);

                    if (!connection) {
                        platformResults.push(`${platformId}: Not connected`);
                        hasFailures = true;
                        continue;
                    }

                    try {
                        const content = platformData.custom_content || post.content;

                        if (platformId === 'twitter') {
                            await publishToTwitter(supabase, connection, content, post.media);
                        } else if (platformId === 'facebook') {
                            await publishToFacebook(connection, content, post.media);
                        } else if (platformId === 'instagram') {
                            await publishToInstagram(connection, content, post.media);
                        } else {
                            // Other platforms or mapping not implemented
                            console.warn(`Platform ${platformId} implementation pending`);
                        }

                        platformResults.push(platformId);
                    } catch (err) {
                        console.error(`Failed to publish to ${platformId}:`, err);
                        platformResults.push(`${platformId}: ${(err as Error).message}`);
                        hasFailures = true;
                    }
                }

                // 4. Update post status
                // If at least one succeeded, mark as published (logic similar to client-side)
                // If ALL failed, mark as failed.
                const allFailed = platforms.length > 0 && hasFailures && platformResults.every(r => r.includes(':'));
                const newStatus = allFailed ? 'failed' : 'published';

                await supabase
                    .from('posts')
                    .update({
                        status: newStatus,
                        published_at: allFailed ? null : new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', post.id);

                // Log activity
                await supabase.from('activities').insert({
                    user_id: post.user_id,
                    type: 'published',
                    post_id: post.id,
                    message: allFailed
                        ? `Failed to publish scheduled post: ${platformResults.join(', ')}`
                        : `Published scheduled post to ${platformResults.filter(r => !r.includes(':')).join(', ')}`,
                });

                if (allFailed) results.failed++;
                else results.published++;

            } catch (postErr) {
                console.error(`Error processing post ${post.id}:`, postErr);
                results.errors.push(`Post ${post.id}: ${(postErr as Error).message}`);
                results.failed++;

                // Mark as failed so we don't loop forever
                await supabase.from('posts').update({ status: 'failed' }).eq('id', post.id);
            }
        }

    } catch (err) {
        console.error('Cron job error:', err);
        results.errors.push((err as Error).message);
    }

    return results;
}

// Helper: Publish to Twitter with token refresh
async function publishToTwitter(supabase: SupabaseClient, connection: DbConnection, content: string, media: MediaAttachment[] = []) {
    let accessToken = connection.access_token;

    // Refresh if needed
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
        const newTokens = await refreshAccessToken(connection.refresh_token);
        accessToken = newTokens.accessToken;

        // Update DB
        await supabase
            .from('connected_accounts')
            .update({
                access_token: newTokens.accessToken,
                refresh_token: newTokens.refreshToken,
                token_expires_at: newTokens.expiresAt.toISOString(),
            })
            .eq('id', connection.id);
    }

    const mediaIds: string[] = [];
    if (media && media.length > 0) {
        // Limit to 4 images (Twitter limit)
        // TODO: Support video for Twitter? Currently logic uploads as images via uploadMedia? 
        // uploadMedia in x.ts uses media/upload. If type is video, we need different logic often.
        // For now, filter for images to prevent breaking, or just pass URLs and hope x.ts handles it.
        // Assuming current x.ts uploadMedia handles images.
        const attachments = media.filter(m => m.type === 'image').slice(0, 4);

        // Upload in parallel
        const uploadedIds = await Promise.all(attachments.map(async (m) => {
            const res = await fetch(m.url);
            if (!res.ok) throw new Error(`Failed to fetch image: ${m.url}`);
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            // Derive mime type from url or response header, default to image/jpeg if unknown
            const contentType = res.headers.get('content-type') || 'image/jpeg';
            return uploadMedia(accessToken, buffer, contentType);
        }));
        mediaIds.push(...uploadedIds);
    }

    await postTweet(accessToken, content, mediaIds);
}

// Helper: Publish to Facebook
async function publishToFacebook(connection: DbConnection, content: string, media: MediaAttachment[]) {
    // Current Facebook implementation supports Photo URLs.
    // Filter for images.
    const imageUrls = media.filter(m => m.type === 'image').map(m => m.url);
    await postToFacebookPage(connection.platform_user_id, connection.access_token, content, imageUrls);
}

// Helper: Publish to Instagram
async function publishToInstagram(connection: DbConnection, content: string, media: MediaAttachment[]) {
    // Pass full media objects to support new Video/Carousel logic
    await postToInstagram(
        connection.platform_user_id,
        connection.access_token,
        content,
        media.map(m => ({ type: m.type, url: m.url }))
    );
}
