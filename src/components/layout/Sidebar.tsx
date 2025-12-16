'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Sidebar.module.css';

interface NavItem {
    label: string;
    href: string;
    icon: string;
    badge?: number;
}

const staticNavItems: NavItem[] = [
    { label: 'Dashboard', href: '/', icon: '🏠' },
    { label: 'AI Compose', href: '/ai-compose', icon: '✨' },
    { label: 'Write Post', href: '/compose', icon: '✏️' },
    { label: 'Calendar', href: '/calendar', icon: '📅' },
    { label: 'Posts', href: '/posts', icon: '📝' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user, signOut } = useAuth();

    const navItems: NavItem[] = [
        ...staticNavItems,
        { label: 'Settings', href: '/settings', icon: '⚙️' },
    ];

    const handleLogout = async () => {
        await signOut();
    };

    const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';
    const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';

    return (
        <aside className={styles.sidebar}>
            <div className={styles.logo}>
                <span className={styles.logoIcon}>🚀</span>
                <span className={styles.logoText}>PostPilot</span>
            </div>

            <nav className={styles.nav}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/' && pathname.startsWith(item.href));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                        >
                            <span className={styles.navIcon}>{item.icon}</span>
                            <span className={styles.navLabel}>{item.label}</span>
                            {item.badge !== undefined && item.badge > 0 && (
                                <span className={styles.badge}>{item.badge}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className={styles.footer}>
                <Link href="/ai-compose" className={styles.composeBtn}>
                    <span>✨</span>
                    <span>Create with AI</span>
                </Link>

                <div className={styles.userSection}>
                    <div className={styles.avatar}>{userInitial}</div>
                    <div className={styles.userInfo}>
                        <span className={styles.userName}>{displayName}</span>
                        <button className={styles.logoutBtn} onClick={handleLogout}>
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}
