'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PLATFORMS, PlatformId } from '@/types';
import { getSupabase } from '@/lib/supabase';
import { useConnections, useInvalidateConnections } from '@/hooks/useQueries';
import { getPlatformIcon } from '@/components/ui/PlatformIcons';
import { useTheme } from '@/providers/ThemeProvider';
import styles from './page.module.css';

// Theme toggle component
function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <div className={styles.themeSelector}>
            <button
                className={`${styles.themeOption} ${theme === 'light' ? styles.active : ''}`}
                onClick={() => setTheme('light')}
                type="button"
            >
                <span>☀️</span>
                <span>Light</span>
            </button>
            <button
                className={`${styles.themeOption} ${theme === 'dark' ? styles.active : ''}`}
                onClick={() => setTheme('dark')}
                type="button"
            >
                <span>🌙</span>
                <span>Dark</span>
            </button>
            <button
                className={`${styles.themeOption} ${theme === 'system' ? styles.active : ''}`}
                onClick={() => setTheme('system')}
                type="button"
            >
                <span>💻</span>
                <span>System</span>
            </button>
        </div>
    );
}

export default function SettingsPage() {
    const searchParams = useSearchParams();

    // Use cached query for connections
    const { data: connections = [], isLoading: loading } = useConnections();
    const invalidateConnections = useInvalidateConnections();

    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Check for OAuth callback messages
    useEffect(() => {
        const success = searchParams.get('success');
        const error = searchParams.get('error');

        if (success) {
            setMessage({ type: 'success', text: success });
            // Invalidate connections cache after OAuth success
            invalidateConnections();
            // Clear URL params to prevent re-triggering
            window.history.replaceState({}, '', '/settings');
        } else if (error) {
            setMessage({ type: 'error', text: error });
            // Clear URL params
            window.history.replaceState({}, '', '/settings');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const getConnection = (platformId: PlatformId) => {
        return connections.find(c => c.platform === platformId);
    };

    const handleConnectMeta = () => {
        // Redirect to Meta OAuth endpoint
        window.location.href = '/api/auth/meta';
    };

    const handleConnectX = () => {
        // Redirect to X OAuth endpoint
        window.location.href = '/api/auth/x';
    };

    const handleConnectLinkedIn = () => {
        // Redirect to LinkedIn OAuth endpoint
        window.location.href = '/api/auth/linkedin';
    };

    const handleDisconnect = async (platformId: PlatformId) => {
        if (!confirm(`Disconnect ${platformId}? You'll need to reconnect to post.`)) return;

        const supabase = getSupabase();
        await supabase
            .from('connected_accounts')
            .delete()
            .eq('platform', platformId);

        invalidateConnections(); // Refresh cache
        setMessage({ type: 'success', text: `Disconnected from ${platformId}` });
    };

    // Delete account state and handler
    const [deleting, setDeleting] = useState(false);

    const handleDeleteAccount = async () => {
        const confirmText = prompt(
            'This will permanently delete your account and all data. Type "DELETE" to confirm:'
        );

        if (confirmText !== 'DELETE') {
            if (confirmText !== null) {
                setMessage({ type: 'error', text: 'Account deletion cancelled. You must type "DELETE" to confirm.' });
            }
            return;
        }

        setDeleting(true);
        try {
            const response = await fetch('/api/account/delete', {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete account');
            }

            // Sign out and redirect to landing
            const supabase = getSupabase();
            await supabase.auth.signOut();
            window.location.href = '/landing?deleted=true';
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to delete account' });
            setDeleting(false);
        }
    };

    // Platforms with real OAuth support
    const metaPlatforms: PlatformId[] = ['facebook', 'instagram'];
    const xPlatform: PlatformId = 'twitter';
    const linkedinPlatform: PlatformId = 'linkedin';
    const comingSoonPlatforms: PlatformId[] = ['threads'];

    return (
        <div className={styles.settingsContainer}>
            <h1 className={styles.pageTitle}>Settings</h1>

            {message && (
                <div className={`${styles.message} ${styles[message.type]}`}>
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                    <button onClick={() => setMessage(null)}>×</button>
                </div>
            )}

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>

                    <span>AI & Content</span>
                </h2>

                <div className={styles.platformGrid}>
                    <Link href="/settings/brand" className={styles.platformRow}>
                        <div className={styles.platformInfo}>
                            <div className={styles.platformIcon} style={{ background: 'var(--bg-elevated)', color: 'var(--accent-purple)' }}>
                                ✨
                            </div>
                            <div>
                                <div className={styles.platformName}>Brand DNA</div>
                                <div className={styles.platformStatus}>
                                    Configure your voice, audience, and style
                                </div>
                            </div>
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                            →
                        </div>
                    </Link>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>

                    <span>Connected Platforms</span>
                </h2>

                {/* Meta Platforms (Facebook + Instagram) */}
                <div className={styles.platformGroup}>
                    <div className={styles.groupHeader}>
                        <span>📱 Meta (Facebook & Instagram)</span>
                        <button
                            className="btn btn-primary"
                            onClick={handleConnectMeta}
                            type="button"
                        >
                            {connections.some(c => metaPlatforms.includes(c.platform))
                                ? '🔄 Reconnect'
                                : '🔗 Connect with Facebook'}
                        </button>
                    </div>

                    <div className={styles.platformGrid}>
                        {metaPlatforms.map(platformId => {
                            const platform = PLATFORMS.find(p => p.id === platformId);
                            const connection = getConnection(platformId);

                            if (!platform) return null;

                            return (
                                <div key={platformId} className={styles.platformRow}>
                                    <div className={styles.platformInfo}>
                                        <div className={styles.platformIcon} style={{ color: platform.color }}>
                                            {getPlatformIcon(platformId, 22)}
                                        </div>
                                        <div>
                                            <div className={styles.platformName}>{platform.name}</div>
                                            <div className={styles.platformStatus}>
                                                {connection
                                                    ? `✓ Connected ${connection.platform_username ? `as ${connection.platform_username}` : ''}`
                                                    : 'Not connected'}
                                            </div>
                                        </div>
                                    </div>

                                    {connection && (
                                        <button
                                            className={styles.disconnectBtn}
                                            onClick={() => handleDisconnect(platformId)}
                                            type="button"
                                        >
                                            Disconnect
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* X (Twitter) Platform */}
                <div className={styles.platformGroup}>
                    <div className={styles.groupHeader}>
                        <span>𝕏 X (Twitter)</span>
                        <button
                            className="btn btn-primary"
                            onClick={handleConnectX}
                            type="button"
                        >
                            {getConnection(xPlatform)
                                ? '🔄 Reconnect'
                                : '🔗 Connect X'}
                        </button>
                    </div>

                    <div className={styles.platformGrid}>
                        {(() => {
                            const platform = PLATFORMS.find(p => p.id === xPlatform);
                            const connection = getConnection(xPlatform);
                            if (!platform) return null;

                            return (
                                <div className={styles.platformRow}>
                                    <div className={styles.platformInfo}>
                                        <div className={styles.platformIcon} style={{ color: platform.color }}>
                                            {getPlatformIcon(xPlatform, 22)}
                                        </div>
                                        <div>
                                            <div className={styles.platformName}>{platform.name}</div>
                                            <div className={styles.platformStatus}>
                                                {connection
                                                    ? `✓ Connected as @${connection.platform_username}`
                                                    : 'Not connected'}
                                            </div>
                                        </div>
                                    </div>

                                    {connection && (
                                        <button
                                            className={styles.disconnectBtn}
                                            onClick={() => handleDisconnect(xPlatform)}
                                            type="button"
                                        >
                                            Disconnect
                                        </button>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* LinkedIn Platform */}
                <div className={styles.platformGroup}>
                    <div className={styles.groupHeader}>
                        <span>In LinkedIn</span>
                        <button
                            className="btn btn-primary"
                            onClick={handleConnectLinkedIn}
                            type="button"
                        >
                            {getConnection(linkedinPlatform)
                                ? '🔄 Reconnect'
                                : '🔗 Connect LinkedIn'}
                        </button>
                    </div>

                    <div className={styles.platformGrid}>
                        {(() => {
                            const platform = PLATFORMS.find(p => p.id === linkedinPlatform);
                            const connection = getConnection(linkedinPlatform);
                            if (!platform) return null;

                            return (
                                <div className={styles.platformRow}>
                                    <div className={styles.platformInfo}>
                                        <div className={styles.platformIcon} style={{ color: platform.color }}>
                                            {getPlatformIcon(linkedinPlatform, 22)}
                                        </div>
                                        <div>
                                            <div className={styles.platformName}>{platform.name}</div>
                                            <div className={styles.platformStatus}>
                                                {connection
                                                    ? `✓ Connected as ${connection.platform_username || 'Business Page'}`
                                                    : 'Not connected'}
                                            </div>
                                        </div>
                                    </div>

                                    {connection && (
                                        <button
                                            className={styles.disconnectBtn}
                                            onClick={() => handleDisconnect(linkedinPlatform)}
                                            type="button"
                                        >
                                            Disconnect
                                        </button>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Other Platforms (Coming Soon) */}
                <div className={styles.platformGroup}>
                    <div className={styles.groupHeader}>
                        <span>🚀 More Platforms (Coming Soon)</span>
                    </div>

                    <div className={styles.platformGrid}>
                        {comingSoonPlatforms.map(platformId => {
                            const platform = PLATFORMS.find(p => p.id === platformId);
                            if (!platform) return null;

                            return (
                                <div key={platformId} className={`${styles.platformRow} ${styles.disabled}`}>
                                    <div className={styles.platformInfo}>
                                        <div className={styles.platformIcon} style={{ color: platform.color, opacity: 0.5 }}>
                                            {getPlatformIcon(platformId, 22)}
                                        </div>
                                        <div>
                                            <div className={styles.platformName}>{platform.name}</div>
                                            <div className={styles.platformStatus}>Coming soon</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>

                    <span>Appearance</span>
                </h2>

                <ThemeToggle />
            </section>

            {/* Danger Zone */}
            <section className={`${styles.section} ${styles.dangerSection}`}>
                <h2 className={styles.sectionTitle}>
                    <span>⚠️</span>
                    <span>Danger Zone</span>
                </h2>

                <div className={styles.dangerContent}>
                    <div className={styles.dangerInfo}>
                        <h3>Delete Account</h3>
                        <p>
                            Permanently delete your account and all associated data including posts,
                            connected accounts, and brand settings. This action cannot be undone.
                        </p>
                    </div>
                    <button
                        className={styles.deleteBtn}
                        onClick={handleDeleteAccount}
                        disabled={deleting}
                        type="button"
                    >
                        {deleting ? 'Deleting...' : 'Delete My Account'}
                    </button>
                </div>
            </section>
        </div>
    );
}
