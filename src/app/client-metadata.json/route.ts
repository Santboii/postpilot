
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    return NextResponse.json({
        client_id: `${baseUrl}/client-metadata.json`,
        client_name: 'SocialsGenie',
        client_uri: baseUrl,
        logo_uri: `${baseUrl}/icon.png`, // Ensure you have an icon or use a placeholder
        redirect_uris: [`${baseUrl}/api/auth/bluesky/callback`],
        scope: 'atproto transition:generic',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none', // Public client (no secret required)
        application_type: 'web',
        dpop_bound_access_tokens: true,
    });
}
