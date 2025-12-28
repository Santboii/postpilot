'use client';

import Link from 'next/link';
import Image from 'next/image';
import styles from './Footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.footerContent}>
                <div className={styles.footerBrand}>
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
    );
}
