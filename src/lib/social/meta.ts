/**
 * Meta (Facebook + Instagram) API Client
 * 
 * Handles OAuth token management and posting to Facebook/Instagram
 */

// Meta Graph API version
const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// OAuth URLs
const FACEBOOK_OAUTH_URL = 'https://www.facebook.com/v21.0/dialog/oauth';
const FACEBOOK_TOKEN_URL = `${GRAPH_API_BASE}/oauth/access_token`;

// OAuth scopes for Facebook and Instagram
const REQUIRED_SCOPES = [
    'public_profile',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    // Instagram scopes
    'instagram_basic',
    'instagram_content_publish',
    'business_management',
].join(',');

export interface MetaTokens {
    accessToken: string;
    expiresAt: Date;
    userId: string;
    userName?: string;
}

export interface MetaPage {
    id: string;
    name: string;
    accessToken: string;
    instagramBusinessAccountId?: string;
}

/**
 * Generate the Facebook OAuth authorization URL
 */
export function getMetaAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
        client_id: process.env.META_APP_ID!,
        redirect_uri: redirectUri,
        scope: REQUIRED_SCOPES,
        response_type: 'code',
        state,
    });

    return `${FACEBOOK_OAUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
    code: string,
    redirectUri: string
): Promise<MetaTokens> {
    const params = new URLSearchParams({
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        redirect_uri: redirectUri,
        code,
    });

    const response = await fetch(`${FACEBOOK_TOKEN_URL}?${params.toString()}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to exchange code for token');
    }

    const data = await response.json();

    // Get long-lived token (60 days)
    const longLivedToken = await exchangeForLongLivedToken(data.access_token);

    // Get user info
    const userInfo = await getMetaUserInfo(longLivedToken.access_token);

    // Default to 60 days if expires_in not provided
    const expiresInSeconds = longLivedToken.expires_in || (60 * 24 * 60 * 60);

    return {
        accessToken: longLivedToken.access_token,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
        userId: userInfo.id,
        userName: userInfo.name,
    };
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 */
async function exchangeForLongLivedToken(
    shortLivedToken: string
): Promise<{ access_token: string; expires_in: number }> {
    const params = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID!,
        client_secret: process.env.META_APP_SECRET!,
        fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(`${FACEBOOK_TOKEN_URL}?${params.toString()}`);

    if (!response.ok) {
        throw new Error('Failed to get long-lived token');
    }

    return response.json();
}

/**
 * Get user info from access token
 */
async function getMetaUserInfo(
    accessToken: string
): Promise<{ id: string; name: string }> {
    const response = await fetch(
        `${GRAPH_API_BASE}/me?fields=id,name&access_token=${accessToken}`
    );

    if (!response.ok) {
        throw new Error('Failed to get user info');
    }

    return response.json();
}

/**
 * Get pages the user manages (with their access tokens)
 */
export async function getUserPages(accessToken: string): Promise<MetaPage[]> {
    const response = await fetch(
        `${GRAPH_API_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`
    );

    if (!response.ok) {
        throw new Error('Failed to get user pages');
    }

    const data = await response.json();

    return data.data.map((page: {
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: { id: string };
    }) => ({
        id: page.id,
        name: page.name,
        accessToken: page.access_token,
        instagramBusinessAccountId: page.instagram_business_account?.id,
    }));
}

/**
 * Post to a Facebook Page
 */
export async function postToFacebookPage(
    pageId: string,
    pageAccessToken: string,
    message: string,
    mediaUrls: string[] = []
): Promise<{ id: string }> {
    // Case 1: Multiple images - upload each then attach to feed post
    if (mediaUrls.length > 1) {
        // Upload all photos as unpublished
        const mediaIds = await Promise.all(mediaUrls.map(async (url) => {
            const response = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    published: false,
                    access_token: pageAccessToken,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to upload photo for multi-image post');
            }

            const data = await response.json();
            return data.id as string;
        }));

        // Publish feed post with attached media
        const response = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                attached_media: mediaIds.map(id => ({ media_fbid: id })),
                access_token: pageAccessToken,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to publish multi-photo post');
        }

        return response.json();
    }

    // Case 2: Single image - post directly to photos endpoint
    if (mediaUrls.length === 1) {
        const response = await fetch(`${GRAPH_API_BASE}/${pageId}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: mediaUrls[0],
                caption: message,
                access_token: pageAccessToken,
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to post photo');
        }

        const result = await response.json();
        return { id: result.post_id || result.id };
    }

    // Case 3: Text only - post to feed
    const response = await fetch(`${GRAPH_API_BASE}/${pageId}/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message,
            access_token: pageAccessToken,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to post to Facebook');
    }

    return response.json();
}

/**
 * Post to Instagram (via linked Facebook Page)
 * 
 * Instagram posting is a multi-step process:
 * 1. Create a media container (Image, Reel, or Carousel)
 * 2. Publish the container
 */
export async function postToInstagram(
    instagramAccountId: string,
    pageAccessToken: string,
    caption: string,
    mediaItems: { type: 'image' | 'video'; url: string }[]
): Promise<{ id: string }> {
    if (!mediaItems || mediaItems.length === 0) {
        throw new Error('Instagram requires media for posts');
    }

    let creationId: string;

    // CASE 1: Single Image
    if (mediaItems.length === 1 && mediaItems[0].type === 'image') {
        const response = await fetch(`${GRAPH_API_BASE}/${instagramAccountId}/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_url: mediaItems[0].url,
                caption,
                access_token: pageAccessToken,
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Failed to create Instagram image container');
        creationId = data.id;
    }
    // CASE 2: Single Video (Reel)
    else if (mediaItems.length === 1 && mediaItems[0].type === 'video') {
        const response = await fetch(`${GRAPH_API_BASE}/${instagramAccountId}/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                media_type: 'REELS',
                video_url: mediaItems[0].url,
                caption,
                access_token: pageAccessToken,
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Failed to create Instagram video container');
        creationId = data.id;

        // Video containers need time to process before they can be published
        // We need to poll the status
        await waitForMediaProcessing(creationId, pageAccessToken);
    }
    // CASE 3: Carousel (Mixed Media)
    else {
        // Step 3.1: Create item containers for each media (without caption)
        const childIds = await Promise.all(mediaItems.map(async (item) => {
            const body: Record<string, string | boolean | number> = {
                is_carousel_item: true,
                access_token: pageAccessToken,
            };

            if (item.type === 'video') {
                body.media_type = 'VIDEO'; // 'VIDEO' is used for carousel items, 'REELS' for single video posts
                body.video_url = item.url;
            } else {
                body.image_url = item.url;
            }

            const response = await fetch(`${GRAPH_API_BASE}/${instagramAccountId}/media`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || `Failed to create carousel item (${item.type})`);

            // Wait for videos in carousel to process too
            if (item.type === 'video') {
                await waitForMediaProcessing(data.id, pageAccessToken);
            }

            return data.id;
        }));

        // Step 3.2: Create carousel container
        const response = await fetch(`${GRAPH_API_BASE}/${instagramAccountId}/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                media_type: 'CAROUSEL',
                children: childIds,
                caption,
                access_token: pageAccessToken,
            }),
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Failed to create carousel container');
        creationId = data.id;
    }

    // Step 4: Publish the container
    const publishResponse = await fetch(
        `${GRAPH_API_BASE}/${instagramAccountId}/media_publish`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creation_id: creationId,
                access_token: pageAccessToken,
            }),
        }
    );

    if (!publishResponse.ok) {
        const error = await publishResponse.json();
        throw new Error(error.error?.message || 'Failed to publish to Instagram');
    }

    return publishResponse.json();
}

/**
 * Polls the status of a media container until it is ready to be published.
 * Required for Videos and Carousel items.
 */
async function waitForMediaProcessing(mediaId: string, accessToken: string, maxAttempts = 20): Promise<void> {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < maxAttempts; i++) {
        const response = await fetch(
            `${GRAPH_API_BASE}/${mediaId}?fields=status_code&access_token=${accessToken}`
        );
        const data = await response.json();

        if (data.status_code === 'FINISHED') {
            return;
        }

        if (data.status_code === 'ERROR') {
            throw new Error('Instagram media processing failed');
        }

        // Wait 2 seconds before next check
        await delay(2000);
    }

    throw new Error('Instagram media processing timed out');
}
