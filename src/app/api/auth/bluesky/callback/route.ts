
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
    exchangeCodeForTokens,
    getBlueskyProfile,
} from '@/lib/social/bluesky';

/**
 * Handles Bluesky OAuth 2.0 callback
 * GET /api/auth/bluesky/callback
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/auth/bluesky/callback`;

    // Handle authorization errors
    if (error) {
        console.error('Bluesky OAuth error:', error);
        return NextResponse.redirect(
            `${baseUrl}/settings?error=${encodeURIComponent(`Bluesky authorization failed: ${error}`)}`
        );
    }

    if (!code || !state) {
        return NextResponse.redirect(
            `${baseUrl}/settings?error=${encodeURIComponent('Missing authorization code or state')}`
        );
    }

    try {
        // Get stored PKCE values from cookies
        const cookieStore = await cookies();
        const storedState = cookieStore.get('bluesky_oauth_state')?.value;
        const codeVerifier = cookieStore.get('bluesky_code_verifier')?.value;

        // Validate state to prevent CSRF
        if (state !== storedState) {
            return NextResponse.redirect(
                `${baseUrl}/settings?error=${encodeURIComponent('Invalid state parameter')}`
            );
        }

        if (!codeVerifier) {
            return NextResponse.redirect(
                `${baseUrl}/settings?error=${encodeURIComponent('Missing code verifier')}`
            );
        }

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri);

        // Get user info (Handle, Avatar, etc.)
        const profile = await getBlueskyProfile(tokens.accessToken, tokens.did);

        // Get authenticated Supabase user
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.redirect(
                `${baseUrl}/settings?error=${encodeURIComponent('Not authenticated')}`
            );
        }

        // Store connection in database (upsert to handle reconnection)
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
