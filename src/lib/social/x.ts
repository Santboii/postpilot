/**
 * X (Twitter) API Client
 * 
 * Handles OAuth 2.0 PKCE flow and posting to X
 * API Docs: https://developer.x.com/en/docs/twitter-api
 */

import crypto from 'crypto';

// OAuth 2.0 URLs
const AUTH_URL = 'https://x.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const API_BASE = 'https://api.x.com/2';

// Required scopes for posting
const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'media.write'];

export interface XTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    userId?: string;
    username?: string;
}

export interface XUser {
    id: string;
    name: string;
    username: string;
}

// ============================================
// PKCE Helpers
// ============================================

/**
 * Generate a cryptographically random code verifier
 */
export function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
}

/**
 * Create code challenge from verifier using SHA256
 */
export function generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Generate a random state parameter for CSRF protection
 */
export function generateState(): string {
    return crypto.randomBytes(16).toString('hex');
}

// ============================================
// OAuth 2.0 Flow
// ============================================

/**
 * Generate the X OAuth 2.0 authorization URL with PKCE
 */
export function getXAuthUrl(
    redirectUri: string,
    state: string,
    codeChallenge: string
): string {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.X_CLIENT_ID!,
        redirect_uri: redirectUri,
        scope: SCOPES.join(' '),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
    });

    return `${AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string
): Promise<XTokens> {
    const clientId = process.env.X_CLIENT_ID!;
    const clientSecret = process.env.X_CLIENT_SECRET!;

    // Basic auth header with client credentials
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('X token exchange error:', error);
        throw new Error(`Failed to exchange code: ${response.status}`);
    }

    const data = await response.json();

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<XTokens> {
    const clientId = process.env.X_CLIENT_ID!;
    const clientSecret = process.env.X_CLIENT_SECRET!;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('X token refresh error:', error);
        throw new Error(`Failed to refresh token: ${response.status}`);
    }

    const data = await response.json();

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
}

// ============================================
// API Calls
// ============================================

/**
 * Get authenticated user info
 */
export async function getXUserInfo(accessToken: string): Promise<XUser> {
    const response = await fetch(`${API_BASE}/users/me`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('X user info error:', error);
        throw new Error(`Failed to get user info: ${response.status}`);
    }

    const data = await response.json();
    return data.data as XUser;
}

/**
 * Upload media to X (Twitter) v2 API
 * For images: Simple single JSON request with base64 media
 * For videos: Chunked upload via initialize/append/finalize
 */
export async function uploadMedia(
    accessToken: string,
    fileBuffer: Buffer,
    mimeType: string
): Promise<string> {
    const isVideo = mimeType.startsWith('video/');

    console.log('[X] Starting v2 media upload...', { mimeType, size: fileBuffer.length, isVideo });

    if (isVideo) {
        // Use chunked upload for videos
        return uploadMediaChunked(accessToken, fileBuffer, mimeType);
    }

    // Simple upload for images - single JSON request
    const UPLOAD_URL = 'https://api.x.com/2/media/upload';

    // Determine media category
    const category = mimeType === 'image/gif' ? 'tweet_gif' : 'tweet_image';

    // Convert to base64
    const base64Media = fileBuffer.toString('base64');

    console.log('[X] Sending simple JSON upload, base64 length:', base64Media.length);

    const response = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            media: base64Media,
            media_category: category,
            media_type: mimeType,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[X] Simple upload error:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
        });
        throw new Error(`Failed to upload X media: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[X] Simple upload success:', data);

    const mediaId = data.data?.id || data.media_id || data.id;
    if (!mediaId) {
        console.error('[X] Upload response missing media ID:', data);
        throw new Error('X media upload did not return a media ID');
    }

    return mediaId;
}

/**
 * Chunked upload for videos (INIT → APPEND → FINALIZE → STATUS polling)
 */
async function uploadMediaChunked(
    accessToken: string,
    fileBuffer: Buffer,
    mimeType: string
): Promise<string> {
    const INIT_URL = 'https://api.x.com/2/media/upload/initialize';

    // Determine media category for video
    const category = 'tweet_video';

    console.log('[X] Starting chunked video upload...');

    // 1. INITIALIZE
    const initResponse = await fetch(INIT_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            media_category: category,
            media_type: mimeType,
            total_bytes: fileBuffer.length,
        }),
    });

    if (!initResponse.ok) {
        const errorText = await initResponse.text();
        console.error('[X] Video INIT error:', errorText);
        throw new Error(`Failed to initialize X video upload: ${initResponse.status} - ${errorText}`);
    }

    const initData = await initResponse.json();
    const mediaId = initData.data?.id || initData.media_id;
    if (!mediaId) {
        throw new Error('Video upload INIT did not return a media ID');
    }
    console.log('[X] Video INIT success:', mediaId);

    // 2. APPEND - send chunks
    const APPEND_URL = `https://api.x.com/2/media/upload/${mediaId}/append`;
    const base64Chunk = fileBuffer.toString('base64');

    const appendResponse = await fetch(APPEND_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            media: base64Chunk,
            segment_index: 0,
        }),
    });

    if (!appendResponse.ok) {
        const errorText = await appendResponse.text();
        console.error('[X] Video APPEND error:', errorText);
        throw new Error(`Failed to append X video chunk: ${appendResponse.status} - ${errorText}`);
    }
    console.log('[X] Video APPEND success');

    // 3. FINALIZE
    const FINALIZE_URL = 'https://api.x.com/2/media/upload/finalize';
    const finalizeResponse = await fetch(FINALIZE_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            media_id: mediaId,
        }),
    });

    if (!finalizeResponse.ok) {
        const errorText = await finalizeResponse.text();
        console.error('[X] Video FINALIZE error:', errorText);
        throw new Error(`Failed to finalize X video upload: ${finalizeResponse.status} - ${errorText}`);
    }

    const finalizeData = await finalizeResponse.json();
    console.log('[X] Video FINALIZE success:', finalizeData);

    // 4. Poll STATUS if processing
    const processingInfo = finalizeData.data?.processing_info;
    if (processingInfo && processingInfo.state !== 'succeeded') {
        console.log('[X] Video processing in progress, polling status...');
        await pollMediaStatus(accessToken, mediaId);
    }

    return mediaId;
}

/**
 * Poll media processing status for videos
 * Videos require async processing and we must wait until state is 'succeeded'
 */
async function pollMediaStatus(
    accessToken: string,
    mediaId: string,
    maxAttempts = 60
): Promise<void> {
    const UPLOAD_URL = 'https://api.x.com/2/media/upload';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const statusUrl = `${UPLOAD_URL}?command=STATUS&media_id=${mediaId}`;

        const statusRes = await fetch(statusUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!statusRes.ok) {
            const errorText = await statusRes.text();
            console.error('[X] Media STATUS check error:', errorText);
            throw new Error(`Failed to check media status: ${statusRes.status}`);
        }

        const statusData = await statusRes.json();
        const state = statusData.data?.processing_info?.state;
        console.log(`[X] Media STATUS check ${attempt + 1}: ${state}`);

        if (state === 'succeeded') {
            return;
        }

        if (state === 'failed') {
            const error = statusData.data?.processing_info?.error;
            throw new Error(`X media processing failed: ${error?.message || 'Unknown error'}`);
        }

        // Wait before next poll (use check_after_secs if provided, default 2s)
        const waitSecs = statusData.data?.processing_info?.check_after_secs || 2;
        await new Promise(resolve => setTimeout(resolve, waitSecs * 1000));
    }

    throw new Error('X media processing timed out');
}

/**
 * Post a tweet
 */
export async function postTweet(
    accessToken: string,
    text: string,
    mediaIds: string[] = []
): Promise<{ id: string; text: string }> {
    const body: Record<string, unknown> = { text };

    if (mediaIds.length > 0) {
        body.media = { media_ids: mediaIds };
    }

    console.log('[X] Posting tweet:', {
        textLength: text.length,
        mediaIds,
        body: JSON.stringify(body)
    });

    const response = await fetch(`${API_BASE}/tweets`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('X post tweet error:', error);
        throw new Error(`Failed to post tweet: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data;
}
