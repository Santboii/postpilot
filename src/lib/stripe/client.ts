import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    // https://github.com/stripe/stripe-node#configuration
    // @ts-expect-error -- Using latest API version
    apiVersion: '2024-12-18.acacia',
    appInfo: {
        name: 'SocialsGenie Subscriptions',
        version: '0.1.0'
    }
});
