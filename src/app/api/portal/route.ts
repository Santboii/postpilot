import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createOrRetrieveCustomer } from '@/lib/stripe/admin';
import { stripe } from '@/lib/stripe/client';
import { getURL } from '@/lib/utils';

export async function POST() {
    try {
        // 1. Get User
        const supabase = await createClient();
        const {
            data: { user }
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Could not find user session.' },
                { status: 401 }
            );
        }

        // 2. Get Customer
        const customer = await createOrRetrieveCustomer({
            uuid: user.id || '',
            email: user.email || ''
        });

        if (!customer) {
            return NextResponse.json(
                { error: 'Could not get customer.' },
                { status: 500 }
            );
        }

        // 3. Create Portal Session
        const { url } = await stripe.billingPortal.sessions.create({
            customer,
            return_url: `${getURL()}/settings`
        });

        return NextResponse.json({ url });
    } catch (err: unknown) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Error creating portal session', details: errorMessage },
            { status: 500 }
        );
    }
}
