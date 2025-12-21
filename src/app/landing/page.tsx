'use client';

import Link from 'next/link';
import styles from './landing.module.css';

export default function LandingPage() {
    return (
        <div className={styles.landing}>
            {/* Animated Background */}
            <div className={styles.bgOrbs}>
                <div className={styles.orb1}></div>
                <div className={styles.orb2}></div>
                <div className={styles.orb3}></div>
            </div>

            {/* Navigation */}
            <nav className={styles.nav}>
                <div className={styles.navContent}>
                    <div className={styles.logo}>
                        <span className={styles.logoIcon}>🚀</span>
                        <span className={styles.logoText}>SocialsGenie</span>
                    </div>
                    <div className={styles.navLinks}>
                        <Link href="#features">Features</Link>
                        <Link href="#how-it-works">How It Works</Link>
                        <Link href="/login" className={styles.navCta}>Get Started</Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className={styles.hero}>
                <div className={styles.heroContent}>
                    <div className={styles.badge}>
                        <span>✨</span> AI-Powered Social Media Management
                    </div>
                    <h1 className={styles.heroTitle}>
                        Create <span className="text-gradient">Viral Content</span>
                        <br />in Seconds, Not Hours
                    </h1>
                    <p className={styles.heroSubtitle}>
                        Let AI craft platform-perfect posts while you focus on what matters.
                        Schedule, publish, and grow your audience across all social platforms with one powerful tool.
                    </p>
                    <div className={styles.heroCtas}>
                        <Link href="/login" className={styles.ctaPrimary}>
                            <span>Start Creating Free</span>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </Link>
                        <Link href="#features" className={styles.ctaSecondary}>
                            See How It Works
                        </Link>
                    </div>
                    <div className={styles.heroStats}>
                        <div className={styles.stat}>
                            <span className={styles.statNumber}>10k+</span>
                            <span className={styles.statLabel}>Posts Generated</span>
                        </div>
                        <div className={styles.statDivider}></div>
                        <div className={styles.stat}>
                            <span className={styles.statNumber}>5</span>
                            <span className={styles.statLabel}>Platforms</span>
                        </div>
                        <div className={styles.statDivider}></div>
                        <div className={styles.stat}>
                            <span className={styles.statNumber}>99%</span>
                            <span className={styles.statLabel}>Time Saved</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className={styles.features}>
                <div className={styles.sectionHeader}>
                    <h2>Everything You Need to <span className="text-gradient">Dominate Social</span></h2>
                    <p>Powerful features that transform how you create and share content</p>
                </div>
                <div className={styles.featureGrid}>
                    <div className={styles.featureCard}>
                        <div className={styles.featureIcon}>🤖</div>
                        <h3>AI Content Generation</h3>
                        <p>Generate scroll-stopping posts optimized for each platform. Just describe your topic — AI handles the rest.</p>
                    </div>
                    <div className={styles.featureCard}>
                        <div className={styles.featureIcon}>📅</div>
                        <h3>Smart Scheduling</h3>
                        <p>Plan your content calendar weeks in advance. Queue posts and publish at the perfect time for maximum engagement.</p>
                    </div>
                    <div className={styles.featureCard}>
                        <div className={styles.featureIcon}>🌐</div>
                        <h3>Multi-Platform Publishing</h3>
                        <p>Publish to Facebook, Instagram, and more — all from one dashboard. Reach your audience everywhere they are.</p>
                    </div>
                    <div className={styles.featureCard}>
                        <div className={styles.featureIcon}>🎨</div>
                        <h3>Brand Voice</h3>
                        <p>Train AI on your unique voice and style. Every post sounds authentically you, not robotic.</p>
                    </div>
                    <div className={styles.featureCard}>
                        <div className={styles.featureIcon}>🖼️</div>
                        <h3>AI Image Generation</h3>
                        <p>Create stunning visuals with AI. Generate eye-catching images that complement your posts perfectly.</p>
                    </div>
                    <div className={styles.featureCard}>
                        <div className={styles.featureIcon}>📊</div>
                        <h3>Content Calendar</h3>
                        <p>Visualize your entire content strategy. Drag, drop, and organize posts with an intuitive calendar view.</p>
                    </div>
                </div>
            </section>

            {/* Brand DNA Section */}
            <section className={styles.brandDna}>
                <div className={styles.brandDnaContent}>
                    <div className={styles.brandDnaText}>
                        <div className={styles.badge}>
                            <span>🧬</span> Brand DNA Technology
                        </div>
                        <h2>AI That <span className="text-gradient">Learns Your Voice</span></h2>
                        <p className={styles.brandDnaDescription}>
                            Unlike generic AI tools, SocialsGenie adapts to <strong>your</strong> unique brand.
                            Define your tone, style, key messages, and target audience — and watch as every
                            generated post perfectly captures your brand&apos;s personality.
                        </p>
                        <ul className={styles.brandDnaFeatures}>
                            <li>
                                <span className={styles.checkIcon}>✓</span>
                                <div>
                                    <strong>Personalized Training</strong>
                                    <p>Feed your brand guidelines, past content, and preferences to fine-tune the AI</p>
                                </div>
                            </li>
                            <li>
                                <span className={styles.checkIcon}>✓</span>
                                <div>
                                    <strong>Consistent Voice</strong>
                                    <p>Every post maintains your tone — whether playful, professional, or bold</p>
                                </div>
                            </li>
                            <li>
                                <span className={styles.checkIcon}>✓</span>
                                <div>
                                    <strong>Smart Context</strong>
                                    <p>AI remembers your products, hashtags, and messaging pillars</p>
                                </div>
                            </li>
                        </ul>
                    </div>
                    <div className={styles.brandDnaVisual}>
                        <div className={styles.dnaCard}>
                            <div className={styles.dnaCardHeader}>
                                <span>🎯</span> Your Brand Profile
                            </div>
                            <div className={styles.dnaCardContent}>
                                <div className={styles.dnaItem}>
                                    <span className={styles.dnaLabel}>Tone</span>
                                    <span className={styles.dnaValue}>Friendly & Professional</span>
                                </div>
                                <div className={styles.dnaItem}>
                                    <span className={styles.dnaLabel}>Industry</span>
                                    <span className={styles.dnaValue}>Tech / SaaS</span>
                                </div>
                                <div className={styles.dnaItem}>
                                    <span className={styles.dnaLabel}>Audience</span>
                                    <span className={styles.dnaValue}>Entrepreneurs, 25-45</span>
                                </div>
                                <div className={styles.dnaItem}>
                                    <span className={styles.dnaLabel}>Style</span>
                                    <div className={styles.dnaTags}>
                                        <span>Emojis ✨</span>
                                        <span>Short paragraphs</span>
                                        <span>Call-to-action</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className={styles.howItWorks}>
                <div className={styles.sectionHeader}>
                    <h2>Get Started in <span className="text-gradient">3 Simple Steps</span></h2>
                    <p>From zero to viral-ready content in minutes</p>
                </div>
                <div className={styles.steps}>
                    <div className={styles.step}>
                        <div className={styles.stepNumber}>1</div>
                        <div className={styles.stepContent}>
                            <h3>Connect Your Accounts</h3>
                            <p>Link your Facebook, Instagram, and other social platforms in just a few clicks. Secure OAuth — we never store your passwords.</p>
                        </div>
                    </div>
                    <div className={styles.stepConnector}></div>
                    <div className={styles.step}>
                        <div className={styles.stepNumber}>2</div>
                        <div className={styles.stepContent}>
                            <h3>Create with AI</h3>
                            <p>Describe your topic, select your platforms, and watch AI generate perfect posts. Edit, refine, or use as-is.</p>
                        </div>
                    </div>
                    <div className={styles.stepConnector}></div>
                    <div className={styles.step}>
                        <div className={styles.stepNumber}>3</div>
                        <div className={styles.stepContent}>
                            <h3>Schedule & Publish</h3>
                            <p>Set your posting schedule or publish immediately. Sit back while SocialsGenie grows your audience.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className={styles.ctaSection}>
                <div className={styles.ctaCard}>
                    <h2>Ready to Transform Your Social Media?</h2>
                    <p>Join thousands of creators and businesses who are saving hours every week with AI-powered content creation.</p>
                    <Link href="/login" className={styles.ctaPrimary}>
                        <span>Get Started Free</span>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </Link>
                    <p className={styles.ctaNote}>No credit card required • Free forever for basic use</p>
                </div>
            </section>

            {/* Footer */}
            <footer className={styles.footer}>
                <div className={styles.footerContent}>
                    <div className={styles.footerBrand}>
                        <span className={styles.logoIcon}>🚀</span>
                        <span className={styles.logoText}>SocialsGenie</span>
                    </div>
                    <div className={styles.footerLinks}>
                        <Link href="/privacy">Privacy Policy</Link>
                        <Link href="/terms">Terms of Service</Link>
                    </div>
                    <div className={styles.footerCopyright}>
                        © {new Date().getFullYear()} SocialsGenie. All rights reserved.
                    </div>
                </div>
            </footer>
        </div>
    );
}
