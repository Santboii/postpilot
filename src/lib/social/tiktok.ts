/**
 * TikTok API Client
 * 
 * Handles OAuth 2.0 flow and posting videos to TikTok
 * API Docs: https://developers.tiktok.com/doc/overview/
 */

import crypto from 'crypto';

// OAuth 2.0 URLs
const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const API_BASE = 'https://open.tiktokapis.com/v2';

// Required scopes
// Temporarily reduced for debugging 'client_key' error
const SCOPES = ['user.info.basic']; //, 'video.upload', 'video.publish'];

export interface TikTokTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    openId: string;
    scope: string;
}

export interface TikTokUser {
    open_id: string;
    union_id?: string;
    avatar_url: string;
    display_name: string;
}

/**
 * Generate a random state parameter for CSRF protection
 */
export function generateState(): string {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate PKCE Code Verifier
 */
export function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate PKCE Code Challenge (S256)
 * Note: TikTok uses non-standard HEX encoding for S256, not Base64URL
 */
export function generateCodeChallenge(verifier: string): string {
    return crypto
        .createHash('sha256')
        .update(verifier)
        .digest('hex');
}

/**
 * Generate the TikTok OAuth 2.0 authorization URL
 */
export function getTikTokAuthUrl(
    redirectUri: string,
    state: string
): string {
    // Try both standard and NEXT_PUBLIC variants to be safe
    const clientKey = (process.env.TIKTOK_CLIENT_KEY || process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY)?.trim();

    // Detailed Debug Logging
    console.log('[TikTok Auth Debug] Environment Check:');
    console.log('- TIKTOK_CLIENT_KEY exists:', !!process.env.TIKTOK_CLIENT_KEY);
    console.log('- NEXT_PUBLIC_TIKTOK_CLIENT_KEY exists:', !!process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY);
    console.log('- Resolved Client Key:', clientKey ? `${clientKey.substring(0, 3)}...${clientKey.slice(-3)}` : 'MISSING');
    console.log('- Redirect URI:', redirectUri);

    if (!clientKey) {
        console.error('[TikTok Auth Error] Missing TIKTOK_CLIENT_KEY or NEXT_PUBLIC_TIKTOK_CLIENT_KEY');
    }

    const params = new URLSearchParams({
        client_key: clientKey!,
        response_type: 'code',
        scope: SCOPES.join(','),
        redirect_uri: redirectUri,
        state,
    });

    const authUrl = `${AUTH_URL}?${params.toString()}`;

    // Log safe version of URL for debugging
    const debugUrl = new URL(authUrl);
    debugUrl.searchParams.set('client_key', 'REDACTED');
    console.log('[TikTok Auth Debug] Full Redirect URL:', debugUrl.toString());

    return authUrl;
}

/**
 * Exchange authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    codeVerifier?: string
): Promise<TikTokTokens> {
    const clientKey = (process.env.TIKTOK_CLIENT_KEY || process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY)?.trim();
    const clientSecret = (process.env.TIKTOK_CLIENT_SECRET || process.env.NEXT_PUBLIC_TIKTOK_CLIENT_SECRET)?.trim();

    if (!clientKey || !clientSecret) {
        throw new Error('TikTok credentials missing');
    }

    const params = new URLSearchParams();
    params.append('client_key', clientKey);
    params.append('client_secret', clientSecret);
    params.append('code', code);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', redirectUri);
    // TikTok requires 'code_verifier' for PKCE flow (if challenge was sent in auth request)
    if (codeVerifier) {
        params.append('code_verifier', codeVerifier);
    }

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('TikTok token exchange error:', error);
        throw new Error(`Failed to exchange code: ${response.status}`);
    }

    const data = await response.json();

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        // TikTok tokens typically expire in 24 hours (86400 seconds)
        expiresAt: new Date(Date.now() + (data.expires_in || 86400) * 1000),
        openId: data.open_id,
        scope: data.scope,
    };
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<TikTokTokens> {
    const clientKey = (process.env.TIKTOK_CLIENT_KEY || process.env.NEXT_PUBLIC_TIKTOK_CLIENT_KEY)?.trim();
    const clientSecret = (process.env.TIKTOK_CLIENT_SECRET || process.env.NEXT_PUBLIC_TIKTOK_CLIENT_SECRET)?.trim();

    if (!clientKey || !clientSecret) {
        throw new Error('TikTok credentials missing');
    }

    const params = new URLSearchParams();
    params.append('client_key', clientKey);
    params.append('client_secret', clientSecret);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('TikTok token refresh error:', error);
        throw new Error(`Failed to refresh token: ${response.status}`);
    }

    const data = await response.json();

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token, // Returns a new refresh token
        expiresAt: new Date(Date.now() + (data.expires_in || 86400) * 1000),
        openId: data.open_id,
        scope: data.scope,
    };
}

/**
 * Get authenticated user info
 */
export async function getTikTokUserInfo(accessToken: string): Promise<TikTokUser> {
    const response = await fetch(`${API_BASE}/user/info/?fields=open_id,union_id,avatar_url,display_name`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('TikTok user info error:', error);
        throw new Error(`Failed to get user info: ${response.status}`);
    }

    const data = await response.json();
    return data.data.user as TikTokUser;
}

/**
 * Initialize Video Upload
 */
interface InitUploadResponse {
    upload_url: string;
    upload_id: string;
}

interface PostInfo {
    post_info: {
        title: string;
        privacy_level: string;
        disable_duet: boolean;
        disable_comment: boolean;
        disable_stitch: boolean;
        video_cover_timestamp_ms: number;
    };
    source_info: {
        source: string;
        video_size: number;
        chunk_size: number;
        total_chunk_count: number;
    };
}

async function initVideoUpload(accessToken: string, postInfo: PostInfo): Promise<InitUploadResponse> {
    const response = await fetch(`${API_BASE}/post/publish/video/init/`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(postInfo),
    });

    if (!response.ok) {
        const error = await response.text();
        console.error('TikTok init upload error:', error);
        throw new Error(`Failed to init upload: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.data as InitUploadResponse;
}

/**
 * Post a video to TikTok
 * Note: This implements the "Direct Post" flow which requires the video file buffer
 */
export async function postVideo(
    accessToken: string,
    fileBuffer: Buffer,
    title: string,
    privacyLevel: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY' = 'PUBLIC_TO_EVERYONE',
    mimeType: string = 'video/mp4'
): Promise<{ publish_id: string }> {

    // 0. Validate Video
    validateVideo(fileBuffer, mimeType);

    // 1. Initialize Upload
    const postInfo = {
        post_info: {
            title: title,
            privacy_level: privacyLevel,
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 0
        },
        source_info: {
            source: 'FILE_UPLOAD',
            video_size: fileBuffer.length,
            chunk_size: fileBuffer.length, // Uploading in single chunk for simplicity if small enough
            total_chunk_count: 1
        }
    };

    const { upload_url } = await initVideoUpload(accessToken, postInfo);
    console.log('[TikTok] Upload initialized, URL:', upload_url);

    // 2. Upload Video
    // The upload_url typically requires a PUT request with the video binary
    const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        headers: {
            'Content-Type': mimeType,
            'Content-Length': fileBuffer.length.toString(),
            'Content-Range': `bytes 0-${fileBuffer.length - 1}/${fileBuffer.length}`
        },
        body: fileBuffer as unknown as BodyInit
    });

    if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        console.error('TikTok video upload error:', error);
        throw new Error(`Failed to upload video: ${uploadResponse.status} - ${error}`);
    }

    console.log('[TikTok] Video uploaded successfully');

    // With TikTok V2 API, the INIT + Upload is usually sufficient for "FILE_UPLOAD" source key
    // The server processes it asynchronously.
    // There isn't always a separate "FINALIZE" step for single-chunk uploads in some v2 endpoints,
    // but confirm documentation. For `post/publish/video/init/`, the upload triggers processing.

    return { publish_id: 'pending_processing' };
}
