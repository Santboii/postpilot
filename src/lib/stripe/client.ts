import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    // https://github.com/stripe/stripe-node#configuration
    apiVersion: '2024-12-18.acacia' as any,
    appInfo: {
        name: 'SocialsGenie Subscriptions',
        version: '0.1.0'
    }
});
