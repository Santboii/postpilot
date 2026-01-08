'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Subscription } from '@/types/db';
import Spinner from './Spinner';

export default function SubscriptionStatus() {
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(true);
    const [portalLoading, setPortalLoading] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        const getSubscription = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('subscriptions')
                    .select('*, prices(*, products(*))')
                    .in('status', ['trialing', 'active'])
                    .eq('user_id', user.id)
                    .single();
                setSubscription(data);
            }
            setLoading(false);
        };
        getSubscription();
    }, [supabase]);

    const redirectToPortal = async () => {
        setPortalLoading(true);
        try {
            const { data: { url } } = await (await fetch('/api/portal', { method: 'POST' })).json();
            router.push(url);
        } catch (error) {
            console.error(error);
            alert('Failed to load billing portal.');
            setPortalLoading(false);
        }
    };

    if (loading) return <Spinner />;

    if (!subscription) {
        return (
            <div className="p-4 border rounded-lg bg-gray-50 flex justify-between items-center">
                <div>
                    <h3 className="font-semibold text-gray-900">Free Plan</h3>
                    <p className="text-sm text-gray-500">Upgrade to unlock more features.</p>
                </div>
                <button
                    onClick={() => router.push('/pricing')}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                    Upgrade
                </button>
            </div>
        );
    }

    const price = subscription.prices;
    const product = price?.products;
    const priceString = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: price?.currency || 'usd',
        minimumFractionDigits: 0
    }).format((price?.unit_amount || 0) / 100);

    return (
        <div className="p-4 border rounded-lg bg-white shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                        {product?.name || 'Subscription'}
                    </h3>
                    <div className="text-sm text-gray-500 mt-1">
                        {subscription.status === 'active' ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                {subscription.status}
                            </span>
                        )}
                        <span className="ml-2">
                            {priceString}/{price?.interval}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={redirectToPortal}
                    disabled={portalLoading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    {portalLoading ? <Spinner size="sm" inline /> : 'Manage Billing'}
                </button>
                <button
                    onClick={() => router.push('/pricing')}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-500"
                >
                    View Plans
                </button>
            </div>

            {subscription.cancel_at_period_end && (
                <p className="mt-3 text-xs text-red-600">
                    Your subscription will end on {new Date(subscription.current_period_end).toLocaleDateString()}.
                </p>
            )}
        </div>
    );
}
