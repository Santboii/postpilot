import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public paths that are accessible in pre-launch mode
const PUBLIC_PATHS = [
    '/landing',
    '/pricing',
    '/privacy',
    '/terms',
    '/api/waitlist',
    '/api/auth', // Allow auth callbacks for OAuth flows
];

// Static asset prefixes to always allow
const STATIC_PREFIXES = [
    '/_next',
    '/favicon',
    '/logo',
    '/icon',
    '/images',
];

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if pre-launch mode is enabled
    const isPrelaunchMode = process.env.NEXT_PUBLIC_PRELAUNCH_MODE === 'true';

    // If not in pre-launch mode, allow all requests
    if (!isPrelaunchMode) {
        return NextResponse.next();
    }

    // Always allow static assets
    if (STATIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
        return NextResponse.next();
    }

    // Always allow public paths
    if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
        return NextResponse.next();
    }

    // Allow file extensions (images, fonts, etc.)
    if (pathname.includes('.')) {
        return NextResponse.next();
    }

    // Redirect all other routes to landing page
    const url = request.nextUrl.clone();
    url.pathname = '/landing';
    return NextResponse.redirect(url);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
