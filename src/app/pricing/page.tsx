'use client';

import { useState } from 'react';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import styles from './pricing.module.css';

// Reusing Navbar concept? Or needs to be standalone?
// For now, I will build it with a standalone Back Link or try to import the landing navbar if accessible.
// Since previous files showed `Navbar` is likely inside `landing/page.tsx` directly or checking `src/components`, I'll check `src/components/layout/Navbar`.
// Actually, I'll just build a simple absolute header for now or link back to home.
// Wait, `src/app/landing/page.tsx` had the navbar inline. Let's create a reusable simple nav or just a "Back to Home" for MVP.
// Better: Replicate the simple logo header from landing.

export default function PricingPage() {
    const [isAnnual, setIsAnnual] = useState(true);

    return (
        <div className={styles.container}>
            {/* Background Effects */}
            <div className={styles.bgEffects}>
                <div className={styles.glowTop} />
                <div className={styles.glowBottom} />
            </div>

            {/* Navbar */}
            <Navbar />

            {/* Header */}
            <header className={styles.header}>
                <span className={styles.overline}>Simple, Transparent Pricing</span>
                <h1 className={styles.title}>
                    <span className={styles.textGradient}>Select a Plan</span>
                </h1>
                <p className={styles.subtitle}>
                    Start for free, scale when you're ready.
                </p>

                {/* Toggle */}
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

            {/* Pricing Grid */}
            <div className={styles.grid}>

                {/* FREE TIER */}
                <div className={styles.card}>
                    <div className={styles.planName}>Starter</div>
                    <p className={styles.planDesc}>Perfect for testing the waters and growing your first channel.</p>
                    <div className={styles.price}>
                        <span className={styles.currency}>$</span>
                        <span className={styles.amount}>0</span>
                        <span className={styles.period}>/mo</span>
                    </div>
                    <Link href="/login" className={`${styles.btn} ${styles.btnDefault}`}>
                        Get Started Free
                    </Link>
                    <ul className={styles.features}>
                        <li className={styles.feature}>
                            <CheckIcon /> 1 Social Account
                        </li>
                        <li className={styles.feature}>
                            <CheckIcon /> 5 AI Posts / Day
                        </li>
                        <li className={styles.feature}>
                            <CheckIcon /> Basic Post Scheduling
                        </li>
                        <li className={styles.feature}>
                            <CheckIcon /> 3-Day History
                        </li>
                    </ul>
                </div>

                {/* CREATOR TIER (HERO) */}
                <div className={`${styles.card} ${styles.popularCard}`}>
                    <div className={styles.popularBadge}>Most Popular</div>
                    <div className={styles.planName}>Creator</div>
                    <p className={styles.planDesc}>The complete toolkit for solo creators and small businesses.</p>
                    <div className={styles.price}>
                        <span className={styles.currency}>$</span>
                        <span className={styles.amount}>{isAnnual ? '19' : '24'}</span>
                        <span className={styles.period}>/mo</span>
                    </div>
                    <Link href="/login" className={`${styles.btn} ${styles.btnPrimary}`}>
                        Start Free Trial
                    </Link>
                    <ul className={styles.features}>
                        <li className={styles.feature}>
                            <span style={{ color: '#ec4899' }}>★</span> <strong>5 Social Accounts</strong>
                        </li>
                        <li className={styles.feature}>
                            <span style={{ color: '#ec4899' }}>★</span> <strong>Unlimited AI Content</strong>
                        </li>
                        <li className={styles.feature}>
                            <CheckIcon /> HD ImageGen (50/mo)
                        </li>
                        <li className={styles.feature}>
                            <CheckIcon /> Unlimited Scheduling
                        </li>
                        <li className={styles.feature}>
                            <CheckIcon /> Brand Voice DNA
                        </li>
                    </ul>
                </div>

                {/* PRO TIER */}
                <div className={styles.card}>
                    <div className={styles.planName}>Pro</div>
                    <p className={styles.planDesc}>Power for agencies and managing multiple brands.</p>
                    <div className={styles.price}>
                        <span className={styles.currency}>$</span>
                        <span className={styles.amount}>{isAnnual ? '49' : '59'}</span>
                        <span className={styles.period}>/mo</span>
                    </div>
                    <Link href="/login" className={`${styles.btn} ${styles.btnDefault}`}>
                        Get Pro
                    </Link>
                    <ul className={styles.features}>
                        <li className={styles.feature}>
                            <CheckIcon /> <strong>Unlimited Accounts</strong>
                        </li>
                        <li className={styles.feature}>
                            <CheckIcon /> Unlimited AI Generation
                        </li>
                        <li className={styles.feature}>
                            <CheckIcon /> 4K ImageGen (Unlimited)
                        </li>
                        <li className={styles.feature}>
                            <CheckIcon /> Priority Support
                        </li>
                    </ul>
                </div>
            </div>

            {/* FAQ */}
            <section className={styles.faqSection}>
                <div className={styles.divider} />
                <h2 className={styles.faqTitle}>Frequently Asked Questions</h2>
                <div className={styles.faqGrid}>
                    <FaqItem
                        question="What counts as a 'Social Account'?"
                        answer="A social account is a single connection to a platform. For example, connecting one Instagram page and one Twitter profile counts as 2 accounts."
                    />
                    <FaqItem
                        question="Can I upgrade or downgrade anytime?"
                        answer="Yes! You can switch plans or cancel your subscription at any time from your account settings. Changes take effect at the start of the next billing cycle."
                    />
                    <FaqItem
                        question="Do I need a credit card for the free plan?"
                        answer="No. The Free plan is completely free forever. You only need to add payment details when you're ready to upgrade to Creator or Pro."
                    />
                    <FaqItem
                        question="What is 'Brand Voice DNA'?"
                        answer="Brand Voice DNA allows you to upload examples of your writing style. Our AI analyzes it and generates new posts that sound exactly like you, not a robot."
                    />
                </div>
            </section>

            {/* Footer */}
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
