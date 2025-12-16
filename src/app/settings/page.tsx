'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { PLATFORMS, PlatformId } from '@/types';
import { getSupabase } from '@/lib/supabase';
import styles from './page.module.css';

interface ConnectedAccount {
    platform: PlatformId;
    platform_username: string | null;
    connected_at: string;
}

export default function SettingsPage() {
    const searchParams = useSearchParams();
    const [connections, setConnections] = useState<ConnectedAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Check for OAuth callback messages
    useEffect(() => {
        const success = searchParams.get('success');
        const error = searchParams.get('error');

        if (success) {
            setMessage({ type: 'success', text: success });
        } else if (error) {
            setMessage({ type: 'error', text: error });
        }
    }, [searchParams]);

    const loadConnections = useCallback(async () => {
        setLoading(true);
        const supabase = getSupabase();
        const { data } = await supabase
            .from('connected_accounts')
            .select('platform, platform_username, connected_at');

        setConnections((data || []) as ConnectedAccount[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadConnections();
    }, [loadConnections]);

    const getConnection = (platformId: PlatformId) => {
        return connections.find(c => c.platform === platformId);
    };

    const handleConnectMeta = () => {
        // Redirect to Meta OAuth endpoint
        window.location.href = '/api/auth/meta';
    };

    const handleDisconnect = async (platformId: PlatformId) => {
        if (!confirm(`Disconnect ${platformId}? You'll need to reconnect to post.`)) return;

        const supabase = getSupabase();
        await supabase
            .from('connected_accounts')
            .delete()
            .eq('platform', platformId);

        await loadConnections();
        setMessage({ type: 'success', text: `Disconnected from ${platformId}` });
    };

    // Platforms with real OAuth support
    const metaPlatforms: PlatformId[] = ['facebook', 'instagram'];
    const otherPlatforms: PlatformId[] = ['twitter', 'linkedin', 'threads'];

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
                    <span>🔌</span>
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
                                            {platform.icon}
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

                {/* Other Platforms (Coming Soon) */}
                <div className={styles.platformGroup}>
                    <div className={styles.groupHeader}>
                        <span>🚀 More Platforms (Coming Soon)</span>
                    </div>

                    <div className={styles.platformGrid}>
                        {otherPlatforms.map(platformId => {
                            const platform = PLATFORMS.find(p => p.id === platformId);
                            if (!platform) return null;

                            return (
                                <div key={platformId} className={`${styles.platformRow} ${styles.disabled}`}>
                                    <div className={styles.platformInfo}>
                                        <div className={styles.platformIcon} style={{ color: platform.color, opacity: 0.5 }}>
                                            {platform.icon}
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
                    <span>🎨</span>
                    <span>Appearance</span>
                </h2>

                <div className={styles.themeSelector}>
                    <div className={`${styles.themeOption} ${styles.active}`}>
                        <span>🌑</span>
                        <span>Dark</span>
                    </div>
                    <div className={`${styles.themeOption} ${styles.disabledOption}`}>
                        <span>☀️</span>
                        <span>Light (Soon)</span>
                    </div>
                </div>
            </section>
        </div>
    );
}
