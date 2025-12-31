
import { AtpAgent } from '@atproto/api';
import { NodeOAuthClient } from '@atproto/oauth-client-node'; // Keeping for type ref if needed, or remove if unused
import sharp from 'sharp';
import crypto from 'crypto';

// ============================================
// Constants
// ============================================

// For the MVP, we default to the main Bluesky PDS. 
// A full federation implementation would need handle resolution first.
const BSKY_AUTH_URL = 'https://bsky.social/oauth/authorize';
const BSKY_TOKEN_URL = 'https://bsky.social/oauth/token';

const CLIENT_ID = process.env.BLUESKY_CLIENT_ID;
// NOTE: Bluesky OAuth Client IDs are often URLs (e.g. https://app.com/client-metadata.json).
// Ensure this env var is set correctly.

// ============================================
// Types
// ============================================

export interface BlueskyTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    scope: string;
    did: string;
}

// ============================================
// PKCE Helpers
// ============================================

export function generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function generateState(): string {
    return crypto.randomBytes(16).toString('hex');
}

// ============================================
// OAuth Flow
// ============================================

export function getBlueskyAuthUrl(
    redirectUri: string,
    state: string,
    codeChallenge: string
): string {
    if (!CLIENT_ID) throw new Error('Missing BLUESKY_CLIENT_ID');

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: redirectUri,
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        scope: 'atproto transition:generic', // Standard transition scope
    });

    return `${BSKY_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string
): Promise<BlueskyTokens> {
    if (!CLIENT_ID) throw new Error('Missing BLUESKY_CLIENT_ID');

    // Basic Auth or Client Secret Post? 
    // Bluesky OAuth usually uses client_secret_post if confidential, or none if public.
    // We'll assume client_secret_post if SECRET is present, else public (unlikely for server app).

    // Actually, simply sending client_id and grant_type in body is standard for public clients 
    // or confidential clients using "client_secret_post" auth method.

    const bodyParams: any = {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier,
    };

    if (process.env.BLUESKY_CLIENT_SECRET) {
        bodyParams.client_secret = process.env.BLUESKY_CLIENT_SECRET;
    }

    const response = await fetch(BSKY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(bodyParams),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Bluesky token exchange failed: ${text}`);
    }

    const data = await response.json();

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        scope: data.scope,
        did: data.sub, // 'sub' in ID Token or response usually contains the DID
    };
}

export async function refreshAccessToken(refreshToken: string): Promise<BlueskyTokens> {
    if (!CLIENT_ID) throw new Error('Missing BLUESKY_CLIENT_ID');

    const bodyParams: any = {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
    };

    if (process.env.BLUESKY_CLIENT_SECRET) {
        bodyParams.client_secret = process.env.BLUESKY_CLIENT_SECRET;
    }

    const response = await fetch(BSKY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(bodyParams),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Bluesky token refresh failed: ${text}`);
    }

    const data = await response.json();

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        scope: data.scope,
        did: data.sub || data.did, // Verify where DID comes back
    };
}

// ============================================
// Image Processing
// ============================================

export async function processImageForBluesky(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
    const MAX_SIZE = 975 * 1024; // 975KB

    let processed = await sharp(buffer)
        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

    if (processed.info.size > MAX_SIZE) {
        processed = await sharp(buffer)
            .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toBuffer({ resolveWithObject: true });
    }

    return {
        buffer: processed.data,
        mimeType: 'image/jpeg'
    };
}


// ============================================
// Profile Helper
// ============================================

export async function getBlueskyProfile(accessToken: string, did: string) {
    const agent = new AtpAgent({ service: 'https://bsky.social' });

    await agent.resumeSession({
        accessJwt: accessToken,
        did: did,
        handle: 'placeholder',
        email: 'placeholder',
        refreshJwt: 'placeholder',
        active: true
    });

    const response = await agent.getProfile({ actor: did });
    if (!response.success) {
        throw new Error('Failed to fetch Bluesky profile');
    }
    return response.data;
}

// ============================================
// Publishing / API
// ============================================

export async function postBlueskyRecord(
    accessToken: string,
    did: string,
    text: string,
    images: { buffer: Buffer, alt?: string }[] = []
) {
    // We use the Agent from @atproto/api for convenience in making XRPC calls.
    // We can just set the session directly.
    const agent = new AtpAgent({ service: 'https://bsky.social' });

    // Resume session
    await agent.resumeSession({
        accessJwt: accessToken,
        did: did,
        handle: 'placeholder',
        email: 'placeholder',
        refreshJwt: 'placeholder',
        active: true
    });

    // 1. Upload Images
    const uploadedImages = [];
    for (const img of images) {
        const { buffer, mimeType } = await processImageForBluesky(img.buffer);

        const response = await agent.uploadBlob(buffer, { encoding: mimeType });
        if (!response.success) {
            throw new Error('Failed to upload blob to Bluesky');
        }

        uploadedImages.push({
            alt: img.alt || '',
            image: response.data.blob,
            aspectRatio: { width: 1000, height: 1000 } // Should ideally calculate real ratio
        });
    }

    // 2. Create Post
    const postRecord = {
        text: text,
        createdAt: new Date().toISOString(),
        embed: uploadedImages.length > 0 ? {
            $type: 'app.bsky.embed.images',
            images: uploadedImages
        } : undefined,
    };

    const res = await agent.post(postRecord);
    return {
        uri: res.uri,
        cid: res.cid,
        id: res.uri.split('/').pop() // Extract ID from AT URI
    };
}
