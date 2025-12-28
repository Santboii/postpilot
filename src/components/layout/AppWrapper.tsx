'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { ThemeProvider } from '@/providers/ThemeProvider';
import Sidebar from '@/components/layout/Sidebar';
import styles from '@/app/layout.module.css';

function AppContent({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

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
        return (
            <div className={styles.loading}>
                <div className={styles.spinner}></div>
                <p>Loading...</p>
            </div>
        );
    }

    // Show login page without sidebar
    if (isPublicRoute) {
        return <>{children}</>;
    }

    // Show protected content with sidebar
    if (user) {
        return (
            <div className={styles.appContainer}>
                <Sidebar />
                <main className={styles.mainContent}>
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

