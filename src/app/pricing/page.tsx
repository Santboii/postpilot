'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import styles from './pricing.module.css';
import { Price, Product, Subscription } from '@/types/db';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import Spinner from '@/components/ui/Spinner';

type BillboardPlan = Product & { prices: Price[] };

const PLAN_FEATURES: Record<string, string[]> = {
    'free plan': ['1 Social Account', '5 AI Posts / Day', 'Basic Post Scheduling', '3-Day History'],
    'basic': ['5 Social Accounts', 'Unlimited AI Content', 'HD ImageGen (50/mo)', 'Unlimited Scheduling'],
    'pro': ['Unlimited Accounts', 'Unlimited AI Generation', '4K ImageGen (Unlimited)', 'Priority Support']
};

export default function PricingPage() {
    const [isAnnual, setIsAnnual] = useState(false);
    const [products, setProducts] = useState<BillboardPlan[]>([]);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(true);
    const [billingLoading, setBillingLoading] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const fetchLinkData = async () => {
            // 1. Get User Subscription
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: sub } = await supabase
                    .from('subscriptions')
                    .select('*, prices(*, products(*))')
                    .in('status', ['trialing', 'active'])
                    .eq('user_id', user.id)
                    .single();
                setSubscription(sub);
            }

            // 2. Get Products & Prices
            const { data: productsData } = await supabase
                .from('products')
                .select('*, prices(*)')
                .eq('active', true)
                .eq('prices.active', true)
                .order('metadata->index'); // Ensure you add sorting metadata in Stripe or handle sorting manually

            if (productsData) {
                // Determine tiers locally if not set by metadata
                const sorted = (productsData as BillboardPlan[]).sort((a, b) => {
                    const priceA = a.prices?.find(p => p.interval === 'month')?.unit_amount || 0;
                    const priceB = b.prices?.find(p => p.interval === 'month')?.unit_amount || 0;
                    return priceA - priceB;
                });
                setProducts(sorted);
            }
            setLoading(false);
        };

        fetchLinkData();
    }, [supabase]);

    const searchParams = useSearchParams();

    const handleCheckout = useCallback(async (price: Price) => {
        setBillingLoading(price.id);
        if (!price) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return router.push(`/login?price_id=${price.id}`);
            }

            // If already subscribed to this plan (or higher?), maybe show portal?
            // For now, strict checkout flow.

            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    price,
                    quantity: 1,
                    metadata: {
                        from_url: window.location.href
                    }
                })
            });

            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error(data.error || 'Failed to create session');
            }

        } catch (error) {
            console.error(error);
            alert('Checkout failed. Please try again.');
        } finally {
            setBillingLoading(null);
        }
    }, [router, supabase.auth]);

    // Auto-checkout effect
    useEffect(() => {
        const action = searchParams.get('action');
        const priceId = searchParams.get('price_id');

        if (action === 'checkout' && priceId && !loading && products.length > 0) {
            // Find the price object
            let foundPrice: Price | undefined;
            for (const prod of products) {
                const p = prod.prices?.find(pr => pr.id === priceId);
                if (p) { foundPrice = p; break; }
            }

            if (foundPrice) {
                // Remove params to prevent loop/re-trigger
                router.replace('/pricing', { scroll: false });
                handleCheckout(foundPrice);
            }
        }
    }, [loading, products, searchParams, handleCheckout, router]); // Dependencies ensure it runs once data is ready

    if (loading) return <Spinner fullScreen />;

    // Helper to find specific plan types if mapped manually, 
    // OR we just iterate the products array dynamically.
    // For the UI to look exactly like the mockup, we might want to map 
    // specific named products to specific slots (Starter, Creator, Pro).

    // Fallback static structure if DB is empty (for dev preview) or map DB items.
    // Strategy: Map by name similarity or metadata.

    const getPrice = (product: BillboardPlan) => {
        const prices = product.prices;
        const price = prices?.find(p => p.interval === (isAnnual ? 'year' : 'month'));
        return price;
    };

    return (
        <div className={styles.container}>
            <div className={styles.bgEffects}>
                <div className={styles.glowTop} />
                <div className={styles.glowBottom} />
            </div>

            <Navbar />

            <header className={styles.header}>
                <span className={styles.overline}>Simple, Transparent Pricing</span>
                <h1 className={styles.title}>
                    <span className={styles.textGradient}>Select a Plan</span>
                </h1>
                <p className={styles.subtitle}>
                    Start for free, scale when you&apos;re ready.
                </p>

                <div className={styles.toggleContainer} onClick={() => setIsAnnual(!isAnnual)}>
                    <span className={`${styles.toggleLabel} ${!isAnnual ? styles.active : ''}`}>Monthly</span>
                    <div className={`${styles.toggleSwitch} ${isAnnual ? styles.checked : ''}`}>
                        <div className={styles.toggleSlider} />
                    </div>
                    <span className={`${styles.toggleLabel} ${isAnnual ? styles.active : ''}`}>
                        Yearly <span className={styles.saveBadge}>Save 17%</span>
                    </span>
                </div>
            </header>

            <div className={styles.grid}>
                {products.map((product) => {
                    const price = getPrice(product);
                    if (!price) return null;

                    const nameLower = product.name.toLowerCase();
                    const isPopular = nameLower.includes('basic');
                    const currentPlan = subscription?.prices?.products?.name === product.name;
                    const features = PLAN_FEATURES[nameLower] || [];

                    return (
                        <div key={product.id} className={`${styles.card} ${isPopular ? styles.popularCard : ''}`}>
                            {isPopular && <div className={styles.popularBadge}>Most Popular</div>}
                            <div className={styles.planName}>{product.name}</div>
                            <p className={styles.planDesc}>{product.description}</p>
                            <div className={styles.price}>
                                <span className={styles.currency}>$</span>
                                <span className={styles.amount}>{price.unit_amount / 100}</span>
                                <span className={styles.period}>/{price.interval}</span>
                            </div>

                            <button
                                onClick={() => {
                                    if (subscription && ['active', 'trialing'].includes(subscription.status)) {
                                        router.push('/settings');
                                    } else {
                                        handleCheckout(price);
                                    }
                                }}
                                disabled={currentPlan || !!billingLoading}
                                className={`${styles.btn} ${isPopular ? styles.btnPrimary : styles.btnDefault}`}
                            >
                                {billingLoading === price.id ? 'Processing...' : (
                                    currentPlan ? 'Current Plan' : (
                                        subscription && ['active', 'trialing'].includes(subscription.status)
                                            ? 'Manage Subscription'
                                            : (price.unit_amount === 0 ? 'Get Started Free' : 'Get ' + product.name)
                                    )
                                )}
                            </button>

                            <ul className={styles.features}>
                                {features.map((feature, i) => (
                                    <li key={i} className={styles.feature}>
                                        {isPopular && i < 2 ? (
                                            <><span style={{ color: '#ec4899' }}>★</span> <strong>{feature}</strong></>
                                        ) : (
                                            <><CheckIcon /> {feature}</>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>

            <section className={styles.faqSection}>
                <div className={styles.divider} />
                <h2 className={styles.faqTitle}>Frequently Asked Questions</h2>
                <div className={styles.faqGrid}>
                    <FaqItem question="What counts as a 'Social Account'?" answer="A social account is a single connection to a platform." />
                    <FaqItem question="Can I upgrade or downgrade anytime?" answer="Yes! You can switch plans or cancel your subscription at any time." />
                    <FaqItem question="Do I need a credit card for the free plan?" answer="No. The Free plan is completely free forever." />
                </div>
            </section>
            <Footer />
        </div>
    );
}

function CheckIcon() {
    return (
        <svg className={styles.check} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className={styles.faqItem} onClick={() => setIsOpen(!isOpen)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className={styles.question} style={{ margin: 0 }}>{question}</h3>
                <span style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
            </div>
            {isOpen && <p className={styles.answer} style={{ marginTop: '0.5rem' }}>{answer}</p>}
        </div>
    );
}
