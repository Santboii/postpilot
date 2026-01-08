import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { stripe } from './client';
// Note: In a real app, generate types with: npx supabase gen types typescript --project-id ... > types_db.ts

// Use a Service Role client for admin tasks (bypassing RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const upsertProductRecord = async (product: Stripe.Product) => {
    const productData = {
        id: product.id,
        active: product.active,
        name: product.name,
        description: product.description ?? undefined,
        image: product.images?.[0] ?? null,
        metadata: product.metadata
    };

    const { error } = await supabaseAdmin.from('products').upsert([productData]);
    if (error) throw error;
    console.log(`Product inserted/updated: ${product.id}`);
};

const upsertPriceRecord = async (price: Stripe.Price) => {
    const priceData = {
        id: price.id,
        product_id: typeof price.product === 'string' ? price.product : '',
        active: price.active,
        currency: price.currency,
        description: price.nickname ?? undefined,
        type: price.type,
        unit_amount: price.unit_amount ?? undefined,
        interval: price.recurring?.interval,
        interval_count: price.recurring?.interval_count,
        trial_period_days: price.recurring?.trial_period_days,
        metadata: price.metadata
    };

    const { error } = await supabaseAdmin.from('prices').upsert([priceData]);
    if (error) throw error;
    console.log(`Price inserted/updated: ${price.id}`);
};

const createOrRetrieveCustomer = async ({
    email,
    uuid
}: {
    email: string;
    uuid: string;
}) => {
    const { data, error } = await supabaseAdmin
        .from('customers')
        .select('stripe_customer_id')
        .eq('id', uuid)
        .single<{ stripe_customer_id: string }>();

    if (error || !data?.stripe_customer_id) {
        // No customer record found, let's create one in Stripe
        const customerData: { metadata: { supabaseUUID: string }; email?: string } =
        {
            metadata: {
                supabaseUUID: uuid
            }
        };
        if (email) customerData.email = email;

        const customer = await stripe.customers.create(customerData);

        // Insert into Supabase
        const { error: supabaseError } = await supabaseAdmin
            .from('customers')
            .insert([{ id: uuid, stripe_customer_id: customer.id }]);

        if (supabaseError) throw supabaseError;
        console.log(`New Customer created and mapped: ${uuid} <-> ${customer.id}`);
        return customer.id;
    }

    if (data?.stripe_customer_id) {
        // Double check if customer still exists in Stripe (resilience for dev environments)
        try {
            const customer = await stripe.customers.retrieve(data.stripe_customer_id);
            if (!customer || customer.deleted) {
                throw new Error('Customer deleted in Stripe');
            }
            return data.stripe_customer_id;
        } catch {
            console.warn(`Customer ${data.stripe_customer_id} missing/deleted in Stripe. Re-creating...`);

            const customerData: { metadata: { supabaseUUID: string }; email?: string } = {
                metadata: {
                    supabaseUUID: uuid
                }
            };
            if (email) customerData.email = email;

            const newCustomer = await stripe.customers.create(customerData);

            // Update Supabase with new ID
            const { error: updateError } = await supabaseAdmin
                .from('customers')
                .update({ stripe_customer_id: newCustomer.id })
                .eq('id', uuid);

            if (updateError) throw updateError;
            console.log(`Re-created Stripe Customer: ${uuid} <-> ${newCustomer.id}`);
            return newCustomer.id;
        }
    }

    // Default Creation Path (No Data Found)
    // ... duplicate of above logic, let's refactor slightly to avoid duplication if possible, 
    // but for now, just pasting the creation logic is safer than a big refactor.

    // No customer record found, let's create one in Stripe
    const customerData: { metadata: { supabaseUUID: string }; email?: string } =
    {
        metadata: {
            supabaseUUID: uuid
        }
    };
    if (email) customerData.email = email;

    const customer = await stripe.customers.create(customerData);

    // Insert into Supabase
    const { error: supabaseError } = await supabaseAdmin
        .from('customers')
        .insert([{ id: uuid, stripe_customer_id: customer.id }]);

    if (supabaseError) throw supabaseError;
    console.log(`New Customer created and mapped: ${uuid} <-> ${customer.id}`);
    return customer.id;
};

const copyBillingDetailsToCustomer = async (
    uuid: string,
    payment_method: Stripe.PaymentMethod
) => {
    //Todo: copy billing details to customer object if needed
    const customer = payment_method.customer as string;
    const { name, phone, address } = payment_method.billing_details;
    if (!name || !address) return;
    // @ts-expect-error -- Stripe types are strict
    await stripe.customers.update(customer, { name, phone, address });
    const { error } = await supabaseAdmin
        .from('users') // or whatever user profile table you have
        .update({
            billing_address: { ...address },
            payment_method: { ...payment_method[payment_method.type] }
        })
        .eq('id', uuid);
    if (error) console.error('Error copying billing details', error);
};

const manageSubscriptionStatusChange = async (
    subscriptionId: string,
    customerId: string,
    createAction = false
) => {
    // Get customer's UUID from mapping table.
    const { data: customerData, error: noCustomerError } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

    if (noCustomerError) {
        console.error(`Error finding customer for ${customerId}`, noCustomerError);
        return;
    }

    const { id: uuid } = customerData!;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['default_payment_method']
    }) as unknown as Stripe.Subscription;

    // Upsert the latest status of the subscription object.
    const subscriptionData = {
        id: subscription.id,
        user_id: uuid,
        metadata: subscription.metadata,
        status: subscription.status,
        price_id: subscription.items.data[0].price.id,
        // @ts-expect-error -- Quantity is sometimes missing in types but present in object
        quantity: subscription.quantity,
        cancel_at_period_end: subscription.cancel_at_period_end,
        cancel_at: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        // @ts-expect-error -- Standard Stripe fields missing in some type versions
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        // @ts-expect-error -- Standard Stripe fields missing in some type versions
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        created: new Date(subscription.created * 1000).toISOString(),
        ended_at: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : null,
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null
    };

    const { error } = await supabaseAdmin
        .from('subscriptions')
        .upsert([subscriptionData]);

    if (error) {
        console.error(`Error inserting subscription [${subscription.id}]:`, error);
        throw error;
    }
    console.log(`Inserted/updated subscription [${subscription.id}] for user [${uuid}]`);

    // For a new subscription copy the billing details to the customer object.
    // NOTE: This is a cost-optimisation (avoids looking up customer again)
    if (createAction && subscription.default_payment_method && uuid) {
        await copyBillingDetailsToCustomer(uuid, subscription.default_payment_method as Stripe.PaymentMethod);
    }
};

export {
    upsertProductRecord,
    upsertPriceRecord,
    createOrRetrieveCustomer,
    manageSubscriptionStatusChange
};
