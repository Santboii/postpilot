'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { PLATFORMS, PlatformId } from '@/types';
import { getSupabase } from '@/lib/supabase';
import { useConnections, useInvalidateConnections } from '@/hooks/useQueries';
import { getPlatformIcon } from '@/components/ui/PlatformIcons';
import { useTheme } from '@/providers/ThemeProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';
import BrandSettings from '@/components/settings/BrandSettings';
import styles from './page.module.css';

type SettingsTab = 'account' | 'connections' | 'brand';

interface LinkedInAccount {
    id: string;
    name: string;
    image?: string;
    type: 'organization' | 'person';
    selected?: boolean;
}

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

// Platform card component
function PlatformCard({
    platformId,
    connection,
    onConnect,
    onDisconnect,
    onManage,
    comingSoon = false
}: {
    platformId: PlatformId;
    connection: { platform_username?: string | null } | null;
    onConnect: () => void;
    onDisconnect: () => void;
    onManage?: () => void;
    comingSoon?: boolean;
}) {
    const platform = PLATFORMS.find(p => p.id === platformId);
    if (!platform) return null;

    const isConnected = !!connection;

    return (
        <div className={`${styles.platformCard} ${comingSoon ? styles.comingSoon : ''}`}>
            <div className={styles.platformCardIcon} style={{ color: platform.color }}>
                {getPlatformIcon(platformId, 24)}
            </div>
            <div className={styles.platformCardInfo}>
                <div className={styles.platformCardName}>{platform.name}</div>
                <div className={styles.platformCardStatus}>
                    {comingSoon
                        ? 'Coming soon'
                        : isConnected
                            ? `@${connection.platform_username || 'Connected'}`
                            : 'Not connected'}
                </div>
            </div>
            {!comingSoon && (
                <div className={styles.platformCardActions}>
                    {isConnected && onManage && (
                        <button className={styles.manageBtn} onClick={onManage} type="button">
                            ⚙️
                        </button>
                    )}
                    {isConnected ? (
                        <button className={styles.disconnectBtn} onClick={onDisconnect} type="button">
                            Disconnect
                        </button>
                    ) : (
                        <button className={styles.connectBtn} onClick={onConnect} type="button">
                            Connect
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default function SettingsPage() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<SettingsTab>('account');

    // Use cached query for connections
    const { data: connections = [] } = useConnections();
    const invalidateConnections = useInvalidateConnections();

    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // Fetch user email on mount
    useEffect(() => {
        const fetchUser = async () => {
            const supabase = getSupabase();
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.email) setUserEmail(user.email);
        };
        fetchUser();
    }, []);

    // Check for OAuth callback messages (runs once on mount if params exist)
    useEffect(() => {
        const success = searchParams.get('success');
        const error = searchParams.get('error');

        if (success || error) {
            // Clear URL first to prevent re-running on subsequent renders
            window.history.replaceState({}, '', '/settings');

            if (success) {
                setMessage({ type: 'success', text: success });
                if (searchParams.get('connected') === 'true') {
                    invalidateConnections();
                }
            } else if (error) {
                setMessage({ type: 'error', text: error });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount - searchParams are read once

    const getConnection = (platformId: PlatformId) => {
        return connections.find(c => c.platform === platformId);
    };

    // Platform connect handlers
    const connectHandlers: Record<string, () => void> = {
        facebook: () => window.location.href = '/api/auth/meta',
        instagram: () => window.location.href = '/api/auth/meta',
        twitter: () => window.location.href = '/api/auth/x',
        linkedin: () => window.location.href = '/api/auth/linkedin',
        bluesky: () => window.location.href = '/api/auth/bluesky',
        pinterest: () => window.location.href = '/api/auth/pinterest',
        tiktok: () => window.location.href = '/api/auth/tiktok',
    };

    const [pendingDisconnect, setPendingDisconnect] = useState<PlatformId | null>(null);

    const handleDisconnect = async () => {
        if (!pendingDisconnect) return;
        const platformId = pendingDisconnect;
        setPendingDisconnect(null);

        const supabase = getSupabase();
        await supabase
            .from('connected_accounts')
            .delete()
            .eq('platform', platformId);

        invalidateConnections();
        setMessage({ type: 'success', text: `Disconnected from ${platformId}` });
    };

    // LinkedIn Page Selection State
    const [showLinkedInModal, setShowLinkedInModal] = useState(false);
    const [linkedInAccounts, setLinkedInAccounts] = useState<LinkedInAccount[]>([]);
    const [loadingAccounts, setLoadingAccounts] = useState(false);

    const handleManageLinkedIn = async () => {
        setShowLinkedInModal(true);
        setLoadingAccounts(true);
        try {
            const res = await fetch('/api/linkedin/pages');
            const data = await res.json();
            if (data.accounts) {
                setLinkedInAccounts(data.accounts);
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to load LinkedIn pages' });
        } finally {
            setLoadingAccounts(false);
        }
    };

    const handleSelectLinkedInAccount = async (account: LinkedInAccount) => {
        try {
            const res = await fetch('/api/linkedin/select-page', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accountId: account.id,
                    accountName: account.name
                })
            });

            if (!res.ok) throw new Error('Failed to update selection');

            setShowLinkedInModal(false);
            setMessage({ type: 'success', text: `Switched posting to ${account.name}` });
            invalidateConnections();
        } catch {
            setMessage({ type: 'error', text: 'Failed to save selection' });
        }
    };

    // Delete account state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleDeleteAccount = async () => {
        setDeleting(true);
        try {
            const response = await fetch('/api/account/delete', { method: 'DELETE' });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete account');
            }

            const supabase = getSupabase();
            await supabase.auth.signOut();
            window.location.href = '/landing?deleted=true';
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Failed to delete account';
            setMessage({ type: 'error', text: msg });
            setDeleting(false);
            setShowDeleteModal(false);
        }
    };

    // Platform lists
    const activePlatforms: PlatformId[] = ['facebook', 'instagram', 'twitter', 'linkedin', 'bluesky', 'pinterest', 'tiktok'];
    const comingSoonPlatforms: PlatformId[] = ['threads'];

    const tabs = [
        { id: 'account' as const, label: 'Account', icon: '👤' },
        { id: 'connections' as const, label: 'Connections', icon: '🔗' },
        { id: 'brand' as const, label: 'Brand Identity', icon: '✨' },
    ];

    return (
        <div className={styles.settingsContainer}>
            <h1 className={styles.pageTitle}>Settings</h1>

            {message && (
                <div className={`${styles.message} ${styles[message.type]}`}>
                    {message.type === 'success' ? '✅' : '❌'} {message.text}
                    <button onClick={() => setMessage(null)}>×</button>
                </div>
            )}

            <div className={styles.settingsLayout}>
                {/* Tab Navigation */}
                <nav className={styles.tabNav}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.active : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                            type="button"
                        >
                            <span className={styles.tabIcon}>{tab.icon}</span>
                            <span className={styles.tabLabel}>{tab.label}</span>
                        </button>
                    ))}
                </nav>

                {/* Tab Content */}
                <div className={styles.tabContent}>
                    {/* Connections Tab */}
                    {activeTab === 'connections' && (
                        <div className={styles.tabPanel}>
                            <div className={styles.panelHeader}>
                                <h2>Connected Platforms</h2>
                                <p>Connect your social media accounts to publish content.</p>
                            </div>

                            <div className={styles.platformGrid}>
                                {activePlatforms.map(platformId => (
                                    <PlatformCard
                                        key={platformId}
                                        platformId={platformId}
                                        connection={getConnection(platformId) || null}
                                        onConnect={connectHandlers[platformId]}
                                        onDisconnect={() => setPendingDisconnect(platformId)}
                                        onManage={platformId === 'linkedin' ? handleManageLinkedIn : undefined}
                                    />
                                ))}
                                {comingSoonPlatforms.map(platformId => (
                                    <PlatformCard
                                        key={platformId}
                                        platformId={platformId}
                                        connection={null}
                                        onConnect={() => { }}
                                        onDisconnect={() => { }}
                                        comingSoon
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Brand Identity Tab */}
                    {activeTab === 'brand' && (
                        <div className={styles.tabPanel}>
                            <BrandSettings />
                        </div>
                    )}

                    {/* Account Tab */}
                    {activeTab === 'account' && (
                        <div className={styles.tabPanel}>
                            <div className={styles.panelHeader}>
                                <h2>Account</h2>
                                <p>Manage your account settings and preferences.</p>
                            </div>

                            {/* User Info Section */}
                            <div className={styles.accountSection}>
                                <div className={styles.settingRow}>
                                    <div className={styles.settingLabel}>
                                        <strong>Email</strong>
                                        <span>Your account email address</span>
                                    </div>
                                    <div className={styles.settingValue}>
                                        {userEmail || 'Loading...'}
                                    </div>
                                </div>
                            </div>

                            {/* Appearance Section */}
                            <div className={styles.accountSection}>
                                <div className={styles.settingRow}>
                                    <div className={styles.settingLabel}>
                                        <strong>Theme</strong>
                                        <span>Choose your preferred color mode</span>
                                    </div>
                                    <ThemeToggle />
                                </div>
                            </div>

                            {/* Billing Section */}
                            <div className={styles.accountSection}>
                                <div className={styles.settingRow}>
                                    <div className={styles.settingLabel}>
                                        <strong>Subscription</strong>
                                        <span>Manage your plan and billing details</span>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await fetch('/api/portal', { method: 'POST' });
                                                const data = await res.json();
                                                if (data.url) window.location.href = data.url;
                                                else throw new Error('Failed to create portal session');
                                            } catch {
                                                setMessage({ type: 'error', text: 'Failed to open billing portal' });
                                            }
                                        }}
                                        className={styles.connectBtn} // Reusing connectBtn style for consistency
                                    >
                                        Manage Subscription
                                    </button>
                                </div>
                            </div>

                            <div className={styles.dangerZone}>
                                <div className={styles.dangerHeader}>
                                    <span>⚠️</span>
                                    <span>Danger Zone</span>
                                </div>
                                <div className={styles.dangerContent}>
                                    <div className={styles.dangerInfo}>
                                        <strong>Delete Account</strong>
                                        <p>Permanently delete your account and all data. This cannot be undone.</p>
                                    </div>
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={() => setShowDeleteModal(true)}
                                        disabled={deleting}
                                        type="button"
                                    >
                                        Delete Account
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* LinkedIn Page Selector Modal */}
            {showLinkedInModal && (
                <div className={styles.modalOverlay} onClick={() => setShowLinkedInModal(false)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h2>Select Posting Identity</h2>
                        <p>Choose who you want to post as on LinkedIn:</p>

                        {loadingAccounts ? (
                            <div className={styles.spinner}>Loading accounts...</div>
                        ) : (
                            <div className={styles.accountList}>
                                {linkedInAccounts.map(account => (
                                    <button
                                        key={account.id}
                                        className={`${styles.accountOption} ${account.selected ? styles.selected : ''}`}
                                        onClick={() => handleSelectLinkedInAccount(account)}
                                    >
                                        <div className={styles.accountIcon}>
                                            {account.image ? (
                                                <Image
                                                    src={account.image || ''}
                                                    alt=""
                                                    width={24}
                                                    height={24}
                                                    unoptimized
                                                />
                                            ) : (
                                                <span>{account.type === 'organization' ? '🏢' : '👤'}</span>
                                            )}
                                        </div>
                                        <div className={styles.accountDetails}>
                                            <strong>{account.name}</strong>
                                            <span>{account.type === 'organization' ? 'Company Page' : 'Personal Profile'}</span>
                                        </div>
                                        {account.selected && <span className={styles.check}>✓</span>}
                                    </button>
                                ))}
                            </div>
                        )}

                        <button className={styles.closeBtn} onClick={() => setShowLinkedInModal(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Disconnect Confirmation Modal */}
            <ConfirmModal
                isOpen={!!pendingDisconnect}
                title="Disconnect Platform"
                message={`Are you sure you want to disconnect ${pendingDisconnect}? You'll need to reconnect to post.`}
                confirmText="Disconnect"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleDisconnect}
                onCancel={() => setPendingDisconnect(null)}
            />

            {/* Delete Account Confirmation Modal */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Delete Account"
                message="This will permanently delete your account and all associated data including posts, connected accounts, and brand settings. This action cannot be undone."
                confirmText="Delete My Account"
                cancelText="Cancel"
                variant="danger"
                onConfirm={handleDeleteAccount}
                onCancel={() => setShowDeleteModal(false)}
                isLoading={deleting}
            />
        </div>
    );
}
