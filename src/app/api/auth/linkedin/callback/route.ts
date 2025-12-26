import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import {
    exchangeCodeForTokens,
    getLinkedInUserInfo,
} from '@/lib/social/linkedin';

/**
 * Handles LinkedIn OAuth 2.0 callback
 * GET /api/auth/linkedin/callback
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUri = `${baseUrl}/api/auth/linkedin/callback`;

    // Handle authorization errors from LinkedIn
    if (error) {
        console.error('LinkedIn OAuth error:', error);
        return NextResponse.redirect(
            `${baseUrl}/settings?error=${encodeURIComponent(`LinkedIn authorization failed: ${error}`)}`
        );
    }

    if (!code || !state) {
        return NextResponse.redirect(
            `${baseUrl}/settings?error=${encodeURIComponent('Missing authorization code or state')}`
        );
    }

    try {
        // Get stored state from cookies
        const cookieStore = await cookies();
        const storedState = cookieStore.get('linkedin_oauth_state')?.value;

        // Validate state to prevent CSRF
        if (state !== storedState) {
            return NextResponse.redirect(
                `${baseUrl}/settings?error=${encodeURIComponent('Invalid state parameter')}`
            );
        }

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code, redirectUri);

        // Get user info
        const userInfo = await getLinkedInUserInfo(tokens.accessToken);

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
                    platform: 'linkedin',
                    access_token: tokens.accessToken,
                    refresh_token: tokens.refreshToken,
                    token_expires_at: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString() : null,
                    platform_user_id: userInfo.id,
                    platform_username: userInfo.name, // LinkedIn doesn't give a "username" like Twitter, use Name
                    connected_at: new Date().toISOString(),
                },
                {
                    onConflict: 'user_id,platform',
                }
            );

        if (dbError) {
            console.error('Failed to save LinkedIn connection:', dbError);
            return NextResponse.redirect(
                `${baseUrl}/settings?error=${encodeURIComponent('Failed to save LinkedIn connection details')}`
            );
        }

        // Clear state cookie
        cookieStore.delete('linkedin_oauth_state');

        // Redirect to settings with success message
        return NextResponse.redirect(
            `${baseUrl}/settings?success=${encodeURIComponent(`Connected to LinkedIn as ${userInfo.name}`)}`
        );

    } catch (err) {
        console.error('LinkedIn callback error:', err);
        return NextResponse.redirect(
            `${baseUrl}/settings?error=${encodeURIComponent('Failed to complete LinkedIn authorization')}`
        );
    }
}
