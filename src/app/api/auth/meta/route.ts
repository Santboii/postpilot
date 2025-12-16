import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getMetaAuthUrl } from '@/lib/social/meta';

export async function GET() {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`;

    // Generate a random state for CSRF protection
    const state = crypto.randomUUID();

    // Store state in cookie for verification
    const cookieStore = await cookies();
    cookieStore.set('meta_oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 10, // 10 minutes
        sameSite: 'lax',
    });

    const authUrl = getMetaAuthUrl(redirectUri, state);

    return NextResponse.redirect(authUrl);
}
