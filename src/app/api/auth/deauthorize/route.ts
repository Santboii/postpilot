import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Parse and verify the signed request from Facebook
function parseSignedRequest(signedRequest: string, appSecret: string): { user_id: string } | null {
    try {
        const [encodedSig, payload] = signedRequest.split('.');

        if (!encodedSig || !payload) {
            return null;
        }

        // Decode the signature
        const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

        // Decode the payload
        const data = JSON.parse(
            Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
        );

        // Verify the signature
        const expectedSig = crypto
            .createHmac('sha256', appSecret)
            .update(payload)
            .digest();

        if (!crypto.timingSafeEqual(sig, expectedSig)) {
            console.error('Invalid signature in signed request');
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error parsing signed request:', error);
        return null;
    }
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const signedRequest = formData.get('signed_request') as string;

        if (!signedRequest) {
            return NextResponse.json(
                { error: 'Missing signed_request' },
                { status: 400 }
            );
        }

        const appSecret = process.env.INSTAGRAM_APP_SECRET;
        if (!appSecret) {
            console.error('INSTAGRAM_APP_SECRET not configured');
            return NextResponse.json(
                { error: 'Server configuration error' },
                { status: 500 }
            );
        }

        const data = parseSignedRequest(signedRequest, appSecret);
        if (!data || !data.user_id) {
            return NextResponse.json(
                { error: 'Invalid signed request' },
                { status: 400 }
            );
        }

        const facebookUserId = data.user_id;

        // Create admin Supabase client to remove the connection
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SECRET_KEY!
        );

        // Remove the Facebook/Instagram connection for this user
        const { error: deleteError } = await supabaseAdmin
            .from('connected_accounts')
            .delete()
            .or(`platform.eq.facebook,platform.eq.instagram`)
            .eq('platform_user_id', facebookUserId);

        if (deleteError) {
            console.error('Error removing connected account:', deleteError);
        }

        console.log(`Deauthorized Facebook user: ${facebookUserId}`);

        // Facebook expects a 200 response
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Deauthorize callback error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
