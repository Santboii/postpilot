import { stripe } from '@/lib/stripe/client';
import { upsertProductRecord, upsertPriceRecord } from '@/lib/stripe/admin';

async function syncStripeData() {
    const logs: string[] = [];
    logs.push('Syncing Products and Prices from Stripe...');
    try {
        const products = await stripe.products.list({ limit: 100, active: true });
        logs.push(`Found ${products.data.length} products.`);
        for (const product of products.data) {
            await upsertProductRecord(product);
            logs.push(`Product upserted: ${product.id} (${product.name})`);
        }

        const prices = await stripe.prices.list({ limit: 100, active: true });
        logs.push(`Found ${prices.data.length} prices.`);
        for (const price of prices.data) {
            try {
                await upsertPriceRecord(price);
                logs.push(`Price upserted: ${price.id} (Product: ${typeof price.product === 'string' ? price.product : (price.product as any).id})`);
            } catch (error: any) {
                logs.push(`Error upserting price ${price.id}: ${error.message}`);
            }
        }
        logs.push('Sync complete!');
    } catch (error: any) {
        logs.push(`Error syncing Stripe data: ${error.message}`);
        console.error('Error syncing Stripe data:', error);
    }
    return logs;
}

// Self-executing if run directly
if (require.main === module) {
    syncStripeData().then(() => process.exit(0));
}

export { syncStripeData };
