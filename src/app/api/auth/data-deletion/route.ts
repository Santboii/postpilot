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

// Generate a unique confirmation code
function generateConfirmationCode(): string {
    return `DEL-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
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
        const confirmationCode = generateConfirmationCode();

        // Create admin Supabase client
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SECRET_KEY!
        );

        // Find the user associated with this Facebook account
        const { data: connection } = await supabaseAdmin
            .from('connected_accounts')
            .select('user_id')
            .or(`platform.eq.facebook,platform.eq.instagram`)
            .eq('platform_user_id', facebookUserId)
            .single();

        if (connection) {
            const userId = connection.user_id;

            // Delete all user data
            // 1. Delete connected accounts
            await supabaseAdmin
                .from('connected_accounts')
                .delete()
                .eq('user_id', userId);

            // 2. Delete posts
            await supabaseAdmin
                .from('posts')
                .delete()
                .eq('user_id', userId);

            // 3. Delete activities
            await supabaseAdmin
                .from('activities')
                .delete()
                .eq('user_id', userId);

            // 4. Delete brand settings if exists
            await supabaseAdmin
                .from('brand_settings')
                .delete()
                .eq('user_id', userId);

            // Log the deletion request
            console.log(`Data deletion completed for Facebook user: ${facebookUserId}, confirmation: ${confirmationCode}`);
        }

        // Store the deletion request for status checking (table may not exist)
        try {
            await supabaseAdmin
                .from('data_deletion_requests')
                .insert({
                    platform_user_id: facebookUserId,
                    confirmation_code: confirmationCode,
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                });
        } catch {
            // Table might not exist, that's okay
            console.log('Note: data_deletion_requests table not found, skipping logging');
        }

        // Return the response Facebook expects
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://socialsgenie.com';

        return NextResponse.json({
            url: `${baseUrl}/data-deletion-status?code=${confirmationCode}`,
            confirmation_code: confirmationCode,
        });
    } catch (error) {
        console.error('Data deletion callback error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
