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

// Start with basic scopes - add more after App Review approval
// Instagram scopes require enabling Instagram API in the dashboard first
const REQUIRED_SCOPES = [
    'public_profile',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    // TODO: Add these after enabling Instagram API in Meta Dashboard:
    // 'instagram_basic',
    // 'instagram_content_publish',
    // 'business_management',
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
 * Instagram posting is a 2-step process:
 * 1. Create a media container
 * 2. Publish the container
 */
export async function postToInstagram(
    instagramAccountId: string,
    pageAccessToken: string,
    caption: string,
    imageUrl?: string
): Promise<{ id: string }> {
    // For text-only posts, we need an image URL
    // Instagram requires media for all posts
    if (!imageUrl) {
        throw new Error('Instagram requires an image for posts');
    }

    // Step 1: Create media container
    const containerResponse = await fetch(
        `${GRAPH_API_BASE}/${instagramAccountId}/media`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_url: imageUrl,
                caption,
                access_token: pageAccessToken,
            }),
        }
    );

    if (!containerResponse.ok) {
        const error = await containerResponse.json();
        throw new Error(error.error?.message || 'Failed to create Instagram media container');
    }

    const container = await containerResponse.json();

    // Step 2: Publish the container
    const publishResponse = await fetch(
        `${GRAPH_API_BASE}/${instagramAccountId}/media_publish`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creation_id: container.id,
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
