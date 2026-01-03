'use client';

import Link from 'next/link';
import Image from 'next/image';
import styles from './Navbar.module.css';

const isPrelaunchMode = process.env.NEXT_PUBLIC_PRELAUNCH_MODE === 'true';

export default function Navbar() {
    const handleWaitlistClick = (e: React.MouseEvent) => {
        e.preventDefault();
        const waitlistSection = document.getElementById('waitlist');
        if (waitlistSection) {
            waitlistSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <nav className={styles.nav}>
            <div className={styles.navContent}>
                <Link href="/landing" className={styles.logo} style={{ textDecoration: 'none' }}>
                    <div className={styles.logoIcon}>
                        <Image
                            src="/logo.png"
                            alt="SocialsGenie Logo"
                            width={0}
                            height={0}
                            sizes="100vw"
                            style={{ width: 'auto', height: '50px' }}
                        />
                    </div>
                    <span className={styles.logoText}>SocialsGenie</span>
                </Link>
                <div className={styles.navLinks}>
                    <Link href="/landing#features">Features</Link>
                    <Link href="/landing#how-it-works">How It Works</Link>
                    <Link href="/pricing">Pricing</Link>
                    {isPrelaunchMode ? (
                        <button onClick={handleWaitlistClick} className={styles.navCta}>
                            Join Waitlist
                        </button>
                    ) : (
                        <Link href="/login" className={styles.navCta}>Get Started</Link>
                    )}
                </div>
            </div>
        </nav>
    );
}

