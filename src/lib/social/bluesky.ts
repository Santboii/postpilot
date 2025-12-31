import { AtpAgent } from '@atproto/api';
import crypto from 'crypto';
import * as jose from 'jose';
import sharp from 'sharp';
// We need to use the OAuthClient to generate DPoP proofs correctly, 
// OR simpler: manually generate the JWT if we want to avoid heavy deps,
// but @atproto/oauth-client-node is the official way.
// For now, let's implement a manual DPoP generator using 'jose' or 'crypto' to keep it lightweight if possible,
// BUT since we are seeing "invalid_dpop_proof", the server EXPECTS it.
// The easiest path forward is to disable DPoP enforcement in our client metadata for now,
// as DPoP implementation is complex to do manually.
//
// Plan: Update client-metadata.json to dpop_bound_access_tokens: false
// This is compliant with OAuth public clients if we don't strictly need DPoP (sender constraining).
//
// However, if we MUST use DPoP, we need to generate a keypair, sign a JWT with specific claims (htm, htu, ath).
//
// LET'S TRY DISABLING DPOP FIRST as it's the path of least resistance for an MVP.

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
    dpopKey?: any; // JWK
}

export interface DpopKeyPair {
    privateKey: any;
    publicKey: any;
}

// Generate DPoP Key Pair (ES256)
export async function generateDpopKeyPair(): Promise<DpopKeyPair> {
    const { privateKey, publicKey } = await jose.generateKeyPair('ES256', { extractable: true });
    return { privateKey, publicKey };
}

// Create DPoP Proof
export async function createDpopProof(
    url: string,
    method: string,
    privateKey: any,
    publicKey: any,
    nonce?: string
): Promise<string> {
    const jwk = await jose.exportJWK(publicKey);

    return new jose.SignJWT({
        htm: method,
        htu: url,
        nonce: nonce,
    })
        .setProtectedHeader({ alg: 'ES256', typ: 'dpop+jwt', jwk: jwk })
        .setIssuedAt()
        .setJti(crypto.randomUUID())
        .sign(privateKey);
}

// Export/Import Helpers
export async function exportToJSON(key: any): Promise<any> {
    return jose.exportJWK(key);
}

export async function importFromJSON(jwk: any): Promise<any> {
    return jose.importJWK(jwk, 'ES256');
}

// ============================================
// DPoP Fetch Helper (Nonce Handling)
// ============================================

export async function dpopFetch(
    url: string,
    method: string,
    privateKey: any,
    publicKey: any,
    body: any,
    extraHeaders: Record<string, string> = {}
): Promise<Response> {
    const makeRequest = async (nonce?: string) => {
        const proof = await createDpopProof(url, method, privateKey, publicKey, nonce);
        return fetch(url, {
            method,
            headers: {
                ...extraHeaders,
                'DPoP': proof,
            },
            body: body,
        });
    };

    // 1. Try without nonce (or cached nonce if we implemented cache)
    let response = await makeRequest();

    // 2. If 401 and requests nonce, retry
    if (response.status === 401) {
        const authHeader = response.headers.get('www-authenticate');
        const nonceHeader = response.headers.get('dpop-nonce');

        // The server might send the nonce in 'DPoP-Nonce' header even on error
        if (nonceHeader) {
            console.log('Retrying DPoP request with new nonce');
            response = await makeRequest(nonceHeader);
        }
    }

    return response;
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
    redirectUri: string,
    dpopKey?: DpopKeyPair
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

    const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };

    let response: Response;

    if (dpopKey) {
        const proof = await createDpopProof(BSKY_TOKEN_URL, 'POST', dpopKey.privateKey, dpopKey.publicKey);
        headers['DPoP'] = proof;
    }

    if (dpopKey) {
        response = await dpopFetch(
            BSKY_TOKEN_URL,
            'POST',
            dpopKey.privateKey,
            dpopKey.publicKey,
            new URLSearchParams(bodyParams),
            headers
        );
    } else {
        response = await fetch(BSKY_TOKEN_URL, {
            method: 'POST',
            headers: headers,
            body: new URLSearchParams(bodyParams),
        });
    }

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
        dpopKey: dpopKey ? await exportToJSON(dpopKey.privateKey) : undefined,
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
    images: { buffer: Buffer, alt?: string }[] = [],
    dpopKey?: DpopKeyPair
) {
    // 1. Upload Images
    const uploadedImages = [];
    for (const img of images) {
        const { buffer, mimeType } = await processImageForBluesky(img.buffer);

        // Upload Blob
        // Note: Blob upload might not require DPoP? Spec says "all authorized requests".
        // Better to sign it.
        let uploadRes: Response;

        if (dpopKey) {
            uploadRes = await dpopFetch(
                'https://bsky.social/xrpc/com.atproto.repo.uploadBlob',
                'POST',
                dpopKey.privateKey,
                dpopKey.publicKey,
                buffer,
                {
                    'Authorization': `DPoP ${accessToken}`,
                    'Content-Type': mimeType,
                }
            );
        } else {
            uploadRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': mimeType,
                },
                body: buffer as any
            });
        }

        if (!uploadRes.ok) {
            const txt = await uploadRes.text();
            throw new Error(`Failed to upload blob: ${txt}`);
        }

        const data = await uploadRes.json();
        uploadedImages.push({
            alt: img.alt || '',
            image: data.blob,
            aspectRatio: { width: 1000, height: 1000 } // Should calculate if possible, defaulting for now
        });
    }

    // 2. Create Post Record
    const postRecord = {
        text: text,
        createdAt: new Date().toISOString(),
        embed: uploadedImages.length > 0 ? {
            $type: 'app.bsky.embed.images',
            images: uploadedImages
        } : undefined,
    };

    const recordBody = {
        repo: did,
        collection: 'app.bsky.feed.post',
        record: postRecord,
    };

    let postRes: Response;

    if (dpopKey) {
        postRes = await dpopFetch(
            'https://bsky.social/xrpc/com.atproto.repo.createRecord',
            'POST',
            dpopKey.privateKey,
            dpopKey.publicKey,
            JSON.stringify(recordBody),
            {
                'Authorization': `DPoP ${accessToken}`,
                'Content-Type': 'application/json',
            }
        );
    } else {
        postRes = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(recordBody)
        });
    }

    if (!postRes.ok) {
        const txt = await postRes.text();
        throw new Error(`Failed to create post: ${txt}`);
    }

    const res = await postRes.json();
    return {
        uri: res.uri,
        cid: res.cid,
        id: res.uri.split('/').pop()
    };
}
