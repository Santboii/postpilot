
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
    exchangeCodeForTokens,
    // getBlueskyProfile, // We'll fetch manually to support DPoP
    generateDpopKeyPair,
    exportToJSON,
    dpopFetch,
} from '@/lib/social/bluesky';

/**
 * Handles Bluesky OAuth 2.0 callback
 * GET /api/auth/bluesky/callback
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    console.log('--- Bluesky Callback Debug ---');
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    console.log('Callback Base URL:', baseUrl);
    const redirectUri = `${baseUrl}/api/auth/bluesky/callback`;

    // Handle authorization errors
    if (error) {
        console.error('Bluesky OAuth error:', error);
        return NextResponse.redirect(
            `${baseUrl}/settings?error=${encodeURIComponent(`Bluesky authorization failed: ${error}`)}`
        );
    }

    if (!code || !state) {
        console.error('Missing code or state');
        return NextResponse.redirect(
            `${baseUrl}/settings?error=${encodeURIComponent('Missing authorization code or state')}`
        );
    }

    try {
        // Get stored PKCE values from cookies
        const cookieStore = await cookies();
        const storedState = cookieStore.get('bluesky_oauth_state')?.value;
        const codeVerifier = cookieStore.get('bluesky_code_verifier')?.value;

        console.log('Stored State:', storedState ? 'Found' : 'Missing');
        console.log('Code Verifier:', codeVerifier ? 'Found' : 'Missing');

        // Validate state to prevent CSRF
        if (state !== storedState) {
            console.error('Invalid state parameter');
            return NextResponse.redirect(
                `${baseUrl}/settings?error=${encodeURIComponent('Invalid state parameter')}`
            );
        }

        if (!codeVerifier) {
            console.error('Missing code verifier');
            return NextResponse.redirect(
                `${baseUrl}/settings?error=${encodeURIComponent('Missing code verifier')}`
            );
        }

        // 1. Generate DPoP Key Pair for this new session
        const dpopKey = await generateDpopKeyPair();
        console.log('Generated DPoP Key Pair');

        // 2. Exchange code for tokens (Access Token will be DPoP-bound)
        const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri, dpopKey);
        console.log('Tokens exchanged successfully (DPoP Bound)');

        // 3. Get user info (Handle)
        // We use 'com.atproto.repo.describeRepo' because it's a PDS-native method
        // that accepts the PDS-scoped OAuth token. 'getProfile' is an AppView method
        // which often fails with token scope errors.
        const profileRes = await dpopFetch(
            `https://bsky.social/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(tokens.did)}`,
            'GET',
            dpopKey.privateKey,
            dpopKey.publicKey,
            null,
            {
                'Authorization': `DPoP ${tokens.accessToken}`
            }
        );

        if (!profileRes.ok) {
            const txt = await profileRes.text();
            console.error('Failed to fetch profile:', txt);
            throw new Error(`Failed to fetch Bluesky profile: ${txt}`);
        }

        const profile = await profileRes.json();
        console.log('Profile fetched:', profile.handle);

        // Get authenticated Supabase user
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        console.log('Supabase User:', user?.id || 'None');
        if (authError) console.error('Supabase Auth Error:', authError);

        if (authError || !user) {
            return NextResponse.redirect(
                `${baseUrl}/settings?error=${encodeURIComponent('Not authenticated')}`
            );
        }

        // 4. Store connection AND DPoP keys
        const privateKeyJwk = await exportToJSON(dpopKey.privateKey);
        const publicKeyJwk = await exportToJSON(dpopKey.publicKey);

        const { error: dbError } = await supabase
            .from('connected_accounts')
            .upsert(
                {
                    user_id: user.id,
                    platform: 'bluesky',
                    access_token: tokens.accessToken,
                    refresh_token: tokens.refreshToken,
                    token_expires_at: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString() : null,
                    platform_user_id: tokens.did,
                    platform_username: profile.handle,
                    connected_at: new Date().toISOString(),
                    credentials: {
                        dpop_private_key: privateKeyJwk,
                        dpop_public_key: publicKeyJwk
                    }
                },
                {
                    onConflict: 'user_id,platform',
                }
            );

        if (dbError) {
            console.error('Failed to save Bluesky connection:', dbError);
            return NextResponse.redirect(
                `${baseUrl}/settings?error=${encodeURIComponent('Failed to save connection')}`
            );
        }

        // Clear PKCE cookies
        cookieStore.delete('bluesky_oauth_state');
        cookieStore.delete('bluesky_code_verifier');

        // Redirect to settings with success message
        return NextResponse.redirect(
            `${baseUrl}/settings?success=${encodeURIComponent(`Connected to Bluesky as @${profile.handle}`)}`
        );

    } catch (err: any) {
        console.error('Bluesky callback error:', err);
        return NextResponse.redirect(
            `${baseUrl}/settings?error=${encodeURIComponent(`Failed to complete Bluesky authorization: ${err.message}`)}`
        );
    }
}
