import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Sidebar.module.css';
import { createClient } from '@/lib/supabase';
import { Subscription } from '@/types/db';

import { LayoutDashboard, PenSquare, FileText, Settings, Repeat, Library, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';

interface NavItem {
    label: string;
    href: string;
    icon: React.ElementType;
    badge?: number;
}

interface SidebarProps {
    isCollapsed: boolean;
    toggleSidebar: () => void;
}

const staticNavItems: NavItem[] = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Write Post', href: '/compose', icon: PenSquare },
    { label: 'Schedule', href: '/schedule', icon: Repeat },
    { label: 'Libraries', href: '/libraries', icon: Library },
    { label: 'Posts', href: '/posts', icon: FileText },
];

export default function Sidebar({ isCollapsed, toggleSidebar }: SidebarProps) {
    const pathname = usePathname();
    const { user, signOut } = useAuth();
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const supabase = createClient();

    useEffect(() => {
        const getSubscription = async () => {
            if (!user) return;
            const { data } = await supabase
                .from('subscriptions')
                .select('*, prices(*, products(*))')
                .in('status', ['trialing', 'active'])
                .eq('user_id', user.id)
                .maybeSingle();
            setSubscription(data);
        };
        getSubscription();
    }, [user, supabase]);

    const navItems: NavItem[] = [
        ...staticNavItems,
        { label: 'Settings', href: '/settings', icon: Settings },
    ];

    const handleLogout = async () => {
        await signOut();
    };

    const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';
    const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User';
    const planName = subscription?.prices?.products?.name || 'Free';

    return (
        <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
            <div className={styles.logo}>
                <Image
                    src="/logo.png"
                    alt="SocialsGenie Logo"
                    width={50}
                    height={50}
                    className={styles.logoImage}
                    priority
                />
                <span className={styles.logoText}>SocialsGenie</span>
            </div>

            <nav className={styles.nav}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href ||
                        (item.href !== '/' && pathname.startsWith(item.href));

                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                            title={isCollapsed ? item.label : undefined}
                        >
                            <Icon className={styles.navIcon} size={20} />
                            <span className={styles.navLabel}>{item.label}</span>
                            {item.badge !== undefined && item.badge > 0 && (
                                <span className={styles.badge}>{item.badge}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <button
                className={styles.toggleBtn}
                onClick={toggleSidebar}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
                <div className={styles.toggleIconWrapper}>
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </div>
                {!isCollapsed && <span className={styles.toggleLabel}>Collapse Sidebar</span>}
            </button>

            <div className={styles.footer}>
                <div className={styles.userSection} title={displayName}>
                    <div className={styles.avatar}>{userInitial}</div>
                    <div className={styles.userInfo}>
                        <div className={styles.userHeader}>
                            <span className={styles.userName}>{displayName}</span>
                            <span className={`${styles.planBadge} ${styles[planName.toLowerCase().split(' ')[0]]}`}>
                                {planName}
                            </span>
                        </div>
                        <button className={styles.logoutBtn} onClick={handleLogout}>
                            Sign Out
                        </button>
                    </div>
                </div>

                <div className={styles.legalLinks}>
                    <Link href="/terms">Terms</Link>
                    <span>·</span>
                    <Link href="/privacy">Privacy</Link>
                </div>
            </div>
        </aside>
    );
}
