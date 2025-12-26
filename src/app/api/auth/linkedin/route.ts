import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getLinkedInAuthUrl, generateState } from '@/lib/social/linkedin';

/**
 * Initiates LinkedIn OAuth 2.0 authorization flow
 * GET /api/auth/linkedin
 */
export async function GET() {
    try {
        // Generate state for security
        const state = generateState();

        // Build redirect URI
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const redirectUri = `${baseUrl}/api/auth/linkedin/callback`;

        // Store state in secure cookies (needed for callback)
        const cookieStore = await cookies();

        cookieStore.set('linkedin_oauth_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 10, // 10 minutes
            path: '/',
        });

        // Generate authorization URL and redirect
        const authUrl = getLinkedInAuthUrl(redirectUri, state);

        return NextResponse.redirect(authUrl);
    } catch (error) {
        console.error('LinkedIn OAuth initiation error:', error);
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings?error=Failed to start LinkedIn authorization`
        );
    }
}
