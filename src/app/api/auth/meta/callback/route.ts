import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForToken, getUserPages } from '@/lib/social/meta';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle errors from Meta
    if (error) {
        const errorDescription = searchParams.get('error_description') || 'Unknown error';
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=${encodeURIComponent(errorDescription)}`
        );
    }

    if (!code || !state) {
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=Missing authorization code`
        );
    }

    // Verify state for CSRF protection
    const cookieStore = await cookies();
    const storedState = cookieStore.get('meta_oauth_state')?.value;

    if (state !== storedState) {
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=Invalid state parameter`
        );
    }

    // Clear the state cookie
    cookieStore.delete('meta_oauth_state');

    try {
        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback`;

        // Exchange code for tokens
        const tokens = await exchangeCodeForToken(code, redirectUri);

        // Get user's pages (with Instagram business accounts)
        const pages = await getUserPages(tokens.accessToken);

        // Create server-side Supabase client with cookies
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.log('No user found in session');
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=Not logged in. Please log in first.`
            );
        }

        console.log('Saving connection for user:', user.id);

        // Store connection for each platform
        // Facebook connection (for pages)
        await supabase.from('connected_accounts').upsert({
            user_id: user.id,
            platform: 'facebook',
            access_token: tokens.accessToken,
            token_expires_at: tokens.expiresAt.toISOString(),
            platform_user_id: tokens.userId,
            platform_username: tokens.userName,
            connected_at: new Date().toISOString(),
            // Store pages as JSON for now
            metadata: JSON.stringify({ pages }),
        }, {
            onConflict: 'user_id,platform',
        });

        // If there's an Instagram business account, store that too
        const instagramPage = pages.find(p => p.instagramBusinessAccountId);
        if (instagramPage) {
            await supabase.from('connected_accounts').upsert({
                user_id: user.id,
                platform: 'instagram',
                access_token: instagramPage.accessToken,
                platform_user_id: instagramPage.instagramBusinessAccountId,
                platform_username: instagramPage.name,
                connected_at: new Date().toISOString(),
                metadata: JSON.stringify({
                    pageId: instagramPage.id,
                    pageName: instagramPage.name,
                }),
            }, {
                onConflict: 'user_id,platform',
            });
        }

        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=Connected to Meta successfully`
        );
    } catch (err) {
        console.error('Meta OAuth callback error:', err);
        const message = err instanceof Error ? err.message : 'Failed to connect';
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/settings?error=${encodeURIComponent(message)}`
        );
    }
}
