import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { postVideo, refreshAccessToken } from '@/lib/social/tiktok';

import { MediaAttachment } from '@/types';

export async function POST(request: Request) {
    try {
        const { content, media } = await request.json();

        // 1. Authenticate check
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Validate Media
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.log('[TikTok API] Received payload:', { content, mediaCount: media?.length, mediaTypes: media?.map((m: any) => m.type) });

        const videoMedia = media?.find((m: MediaAttachment) => m.type === 'video');
        const imageMedia = media?.filter((m: MediaAttachment) => m.type === 'image');

        // Mixed media check (Backend enforcement)
        if (videoMedia && imageMedia?.length > 0) {
            return NextResponse.json({ error: 'TikTok does not support mixed known media types (Video + Image)' }, { status: 400 });
        }

        if (!videoMedia && (!imageMedia || imageMedia.length === 0)) {
            return NextResponse.json({ error: 'Media (Video or Image) is required for TikTok' }, { status: 400 });
        }

        // 3. Get Access Token
        const { data: connection, error: connError } = await supabase
            .from('connected_accounts')
            .select('access_token, refresh_token, token_expires_at')
            .eq('user_id', user.id)
            .eq('platform', 'tiktok')
            .single();

        if (connError || !connection) {
            return NextResponse.json({ error: 'TikTok not connected' }, { status: 400 });
        }

        let accessToken = connection.access_token;

        // 4. Check Token Expiry & Refresh if needed
        const expiresAt = new Date(connection.token_expires_at);
        if (expiresAt < new Date()) {
            console.log('Refreshing TikTok token...');
            try {
                const tokens = await refreshAccessToken(connection.refresh_token);
                accessToken = tokens.accessToken;

                // Update DB
                await supabase
                    .from('connected_accounts')
                    .update({
                        access_token: tokens.accessToken,
                        refresh_token: tokens.refreshToken,
                        token_expires_at: tokens.expiresAt.toISOString(),
                    })
                    .eq('user_id', user.id)
                    .eq('platform', 'tiktok');
            } catch (refreshError) {
                console.error('Token refresh failed', refreshError);
                return NextResponse.json({ error: 'TikTok session expired. Please reconnect.' }, { status: 401 });
            }
        }

        // 5. Publish Content
        if (videoMedia) {
            // --- VIDEO UPLOAD FLOW ---
            const videoResponse = await fetch(videoMedia.url);
            if (!videoResponse.ok) {
                return NextResponse.json({ error: 'Failed to download video file' }, { status: 500 });
            }
            const videoArrayBuffer = await videoResponse.arrayBuffer();
            const videoBuffer = Buffer.from(videoArrayBuffer);

            await postVideo(accessToken, videoBuffer, content || '');
        } else {
            // --- PHOTO MODE FLOW ---
            // Import dynamically or ensure it is exported from lib
            const { postPhotos } = await import('@/lib/social/tiktok'); // Dynamic import to ensure latest version
            const imageUrls = imageMedia.map((m: MediaAttachment) => m.url);

            await postPhotos(accessToken, imageUrls, content || '');
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('TikTok publish error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to publish to TikTok' },
            { status: 500 }
        );
    }
}
