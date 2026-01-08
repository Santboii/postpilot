'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import Spinner from '@/components/ui/Spinner';
import Sidebar from '@/components/layout/Sidebar';
import styles from '@/app/layout.module.css';

function AppContent({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Public routes that don't require authentication
    const publicRoutes = ['/login', '/landing', '/privacy', '/terms', '/data-deletion-status', '/pricing'];
    const isPublicRoute = publicRoutes.includes(pathname);

    useEffect(() => {
        if (!loading) {
            if (!user && !isPublicRoute) {
                router.push('/landing');
            } else if (user && pathname === '/login') {
                router.push('/');
            }
        }
    }, [user, loading, isPublicRoute, pathname, router]);

    // Show loading state
    if (loading) {
        return <Spinner fullScreen />;
    }

    // Show login page without sidebar
    if (isPublicRoute) {
        return <>{children}</>;
    }

    // Show protected content with sidebar

    // Auto-collapse on small screens if needed, or just let CSS handle it
    // For now, we'll let user control via button

    if (user) {
        return (
            <div className={styles.appContainer}>
                <Sidebar
                    isCollapsed={isSidebarCollapsed}
                    toggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                />
                <main className={`${styles.mainContent} ${isSidebarCollapsed ? styles.mainContentCollapsed : ''}`}>
                    {children}
                </main>
            </div>
        );
    }

    // Redirect happening
    return null;
}

export function AppWrapper({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider>
            <QueryProvider>
                <AuthProvider>
                    <AppContent>{children}</AppContent>
                </AuthProvider>
            </QueryProvider>
        </ThemeProvider>
    );
}

