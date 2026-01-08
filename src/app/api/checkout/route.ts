import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createOrRetrieveCustomer } from '@/lib/stripe/admin';
import { stripe } from '@/lib/stripe/client';
import { getURL } from '@/lib/utils'; // Try to find or implement getURL

export async function POST(req: NextRequest) {
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

        // 2. Get Price ID from body
        const { price, quantity = 1, metadata = {} } = await req.json();

        if (!price) {
            return NextResponse.json({ error: 'Missing price ID' }, { status: 400 });
        }

        // 2.5 Check for existing subscription
        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('status')
            .eq('user_id', user.id)
            .in('status', ['trialing', 'active'])
            .maybeSingle();

        if (subscription) {
            return NextResponse.json(
                { error: 'User already has an active subscription.', redirect: '/settings' },
                { status: 400 }
            );
        }

        // 3. Get/Create Customer
        const customer = await createOrRetrieveCustomer({
            uuid: user.id || '',
            email: user.email || ''
        });

        // 4. Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            billing_address_collection: 'required',
            customer,
            line_items: [
                {
                    price: price.id,
                    quantity
                }
            ],
            mode: 'subscription',
            allow_promotion_codes: true,
            subscription_data: {
                trial_period_days: 14, // Optional: default trial
                metadata
            },
            // Uses localhost:3000 by default in dev, or VERCEL_URL in prod
            success_url: `${getURL()}/settings?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${getURL()}/pricing`
        });

        console.log(`Checkout Session created: ${session.id} for customer ${customer}`);
        return NextResponse.json({ url: session.url });
    } catch (err: unknown) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json(
            { error: 'Error creating checkout session', details: errorMessage },
            { status: 500 }
        );
    }
}
