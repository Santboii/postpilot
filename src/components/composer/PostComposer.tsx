'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PlatformId, PLATFORMS, getCharacterLimit, Platform } from '@/types';
import { createPost } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';
import styles from './Composer.module.css';

type ContentMode = 'shared' | PlatformId;

export default function PostComposer() {
    const router = useRouter();
    const [connectedPlatformIds, setConnectedPlatformIds] = useState<PlatformId[]>([]);
    const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Shared content (used when not customizing per-platform)
    const [sharedContent, setSharedContent] = useState('');

    // Per-platform content overrides
    const [platformContent, setPlatformContent] = useState<Record<PlatformId, string>>({
        twitter: '',
        instagram: '',
        linkedin: '',
        facebook: '',
        threads: '',
    });

    // Which content mode we're editing
    const [activeTab, setActiveTab] = useState<ContentMode>('shared');

    // Scheduling
    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');

    // Fetch connected platforms on mount
    useEffect(() => {
        async function loadConnectedPlatforms() {
            const supabase = getSupabase();
            const { data } = await supabase
                .from('connected_accounts')
                .select('platform');

            const connected = (data || []).map(d => d.platform as PlatformId);
            setConnectedPlatformIds(connected);

            // Auto-select all connected platforms by default
            setSelectedPlatforms(connected);

            // If only one platform, set it as active tab instead of 'shared'
            if (connected.length === 1) {
                setActiveTab(connected[0]);
            }

            setIsLoading(false);
        }
        loadConnectedPlatforms();
    }, []);

    // Get platforms that are connected (with full platform info)
    const connectedPlatforms = useMemo(() => {
        return PLATFORMS.filter(p => connectedPlatformIds.includes(p.id));
    }, [connectedPlatformIds]);

    // Show shared tab only if multiple platforms are connected
    const showSharedTab = connectedPlatforms.length > 1;

    const togglePlatform = (id: PlatformId) => {
        setSelectedPlatforms(prev => {
            const newPlatforms = prev.includes(id)
                ? prev.filter(p => p !== id)
                : [...prev, id];

            // If removing the active tab platform, switch to shared or first available
            if (!newPlatforms.includes(id) && activeTab === id) {
                if (showSharedTab) {
                    setActiveTab('shared');
                } else if (newPlatforms.length > 0) {
                    setActiveTab(newPlatforms[0]);
                }
            }

            return newPlatforms;
        });
    };

    // Get content for a specific platform (fallback to shared)
    const getContentForPlatform = (platformId: PlatformId): string => {
        return platformContent[platformId] || sharedContent;
    };

    // Get the content being edited in the current tab
    const getCurrentContent = (): string => {
        if (activeTab === 'shared') return sharedContent;
        return platformContent[activeTab] || sharedContent;
    };

    // Update content based on current tab
    const handleContentChange = (value: string) => {
        if (activeTab === 'shared') {
            setSharedContent(value);
        } else {
            setPlatformContent(prev => ({
                ...prev,
                [activeTab]: value,
            }));
        }
    };

    // Check if a platform has custom content (different from shared)
    const hasCustomContent = (platformId: PlatformId): boolean => {
        const custom = platformContent[platformId];
        return custom.length > 0 && custom !== sharedContent;
    };

    // Copy shared content to platform-specific
    const initializePlatformContent = (platformId: PlatformId) => {
        if (!platformContent[platformId]) {
            setPlatformContent(prev => ({
                ...prev,
                [platformId]: sharedContent,
            }));
        }
        setActiveTab(platformId);
    };

    // Clear platform-specific content (revert to shared)
    const clearPlatformContent = (platformId: PlatformId) => {
        setPlatformContent(prev => ({
            ...prev,
            [platformId]: '',
        }));
        if (activeTab === platformId) {
            setActiveTab('shared');
        }
    };

    const getCharStatus = (content: string, platformId: PlatformId): 'ok' | 'warning' | 'error' => {
        const limit = getCharacterLimit(platformId);
        if (!limit) return 'ok';
        const remaining = limit - content.length;
        if (remaining < 0) return 'error';
        if (remaining < 20) return 'warning';
        return 'ok';
    };

    const hasAnyError = (): boolean => {
        return selectedPlatforms.some(id => {
            const content = getContentForPlatform(id);
            return getCharStatus(content, id) === 'error';
        });
    };

    const getScheduledDateTime = (): string | undefined => {
        if (!scheduleEnabled || !scheduleDate || !scheduleTime) return undefined;
        return new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
    };

    const getMinDate = (): string => {
        const now = new Date();
        return now.toISOString().split('T')[0];
    };

    const formatSchedulePreview = (): string => {
        if (!scheduleDate || !scheduleTime) return '';
        const date = new Date(`${scheduleDate}T${scheduleTime}`);
        return date.toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const handleSubmit = async (status: 'draft' | 'scheduled' = 'draft') => {
        if (!sharedContent.trim() || selectedPlatforms.length === 0) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const scheduledAt = status === 'scheduled' ? getScheduledDateTime() : undefined;
            await createPost({
                content: sharedContent,
                platforms: selectedPlatforms,
                status,
                scheduledAt,
            });
            router.push('/');
        } catch (err) {
            console.error('Failed to create post:', err);
            setError(err instanceof Error ? err.message : 'Failed to create post');
        } finally {
            setIsSubmitting(false);
        }
    };

    const canSchedule = scheduleEnabled && scheduleDate && scheduleTime;

    return (
        <div className={styles.composerContainer}>
            <div className={styles.editorSection}>
                <div className={styles.sectionHeader}>
                    <h2>Create Post</h2>
                </div>

                {/* Platform Selection */}
                {isLoading ? (
                    <div className={styles.platformToggle}>
                        <span className={styles.loadingText}>Loading connected platforms...</span>
                    </div>
                ) : connectedPlatforms.length === 0 ? (
                    <div className={styles.noPlatforms}>
                        <span>🔌</span>
                        <p>No platforms connected yet.</p>
                        <a href="/settings" className={styles.connectLink}>Connect a platform in Settings →</a>
                    </div>
                ) : (
                    <div className={styles.platformToggle}>
                        {connectedPlatforms.map(platform => (
                            <button
                                key={platform.id}
                                className={`${styles.platformBtn} ${selectedPlatforms.includes(platform.id) ? styles.active : ''}`}
                                onClick={() => togglePlatform(platform.id)}
                                type="button"
                            >
                                <span>{platform.icon}</span>
                                <span>{platform.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Content Tabs - Only show if platforms are connected */}
                {connectedPlatforms.length > 0 && (
                    <div className={styles.contentTabs}>
                        {showSharedTab && (
                            <button
                                className={`${styles.contentTab} ${activeTab === 'shared' ? styles.activeTab : ''}`}
                                onClick={() => setActiveTab('shared')}
                                type="button"
                            >
                                <span>📝</span>
                                <span>Shared Content</span>
                            </button>
                        )}

                        {selectedPlatforms.map(platformId => {
                            const platform = PLATFORMS.find(p => p.id === platformId)!;
                            const content = getContentForPlatform(platformId);
                            const status = getCharStatus(content, platformId);
                            const isCustom = hasCustomContent(platformId);

                            return (
                                <button
                                    key={platformId}
                                    className={`${styles.contentTab} ${activeTab === platformId ? styles.activeTab : ''} ${status === 'error' ? styles.errorTab : ''}`}
                                    onClick={() => initializePlatformContent(platformId)}
                                    type="button"
                                >
                                    <span style={{ color: platform.color }}>{platform.icon}</span>
                                    <span>{platform.name}</span>
                                    {isCustom && <span className={styles.customBadge}>✎</span>}
                                    {status === 'error' && <span className={styles.errorIndicator}>!</span>}
                                </button>
                            );
                        })}
                    </div>
                )}
                <div className={styles.editorCard}>
                    {/* Tab Info Header */}
                    <div className={styles.tabInfo}>
                        {activeTab === 'shared' ? (
                            <p className={styles.tabDescription}>
                                ✨ This content will be used for all platforms unless you customize individually.
                            </p>
                        ) : (
                            <div className={styles.tabDescriptionRow}>
                                <p className={styles.tabDescription}>
                                    ✏️ Customizing for <strong>{PLATFORMS.find(p => p.id === activeTab)?.name}</strong> only
                                </p>
                                <button
                                    className={styles.revertBtn}
                                    onClick={() => clearPlatformContent(activeTab as PlatformId)}
                                    type="button"
                                >
                                    ↩ Use shared
                                </button>
                            </div>
                        )}
                    </div>

                    <textarea
                        className={styles.composerTextarea}
                        placeholder={activeTab === 'shared'
                            ? "What's on your mind? Write your main message here..."
                            : `Customize your ${PLATFORMS.find(p => p.id === activeTab)?.name} post...`}
                        value={getCurrentContent()}
                        onChange={(e) => handleContentChange(e.target.value)}
                    />

                    {/* Character count for current tab */}
                    {activeTab !== 'shared' && (
                        <div className={styles.charCountBar}>
                            {(() => {
                                const limit = getCharacterLimit(activeTab as PlatformId);
                                if (!limit) return null;
                                const content = getCurrentContent();
                                const remaining = limit - content.length;
                                const status = getCharStatus(content, activeTab as PlatformId);
                                return (
                                    <div className={`${styles.charCountInline} ${styles[status]}`}>
                                        <span>{content.length}</span>
                                        <span>/</span>
                                        <span>{limit}</span>
                                        <span className={styles.charLabel}>
                                            {remaining >= 0 ? `(${remaining} left)` : `(${Math.abs(remaining)} over!)`}
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    <div className={styles.mediaDropzone}>
                        <span>📷</span>
                        <span className="text-sm">Click or drag images here</span>
                    </div>

                    {/* Schedule Section */}
                    <div className={styles.scheduleSection}>
                        <div className={styles.scheduleHeader}>
                            <label className={styles.scheduleToggle}>
                                <input
                                    type="checkbox"
                                    checked={scheduleEnabled}
                                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                                />
                                <span className={styles.scheduleToggleSlider}></span>
                                <span className={styles.scheduleLabel}>📅 Schedule for later</span>
                            </label>
                        </div>

                        {scheduleEnabled && (
                            <div className={styles.schedulePicker}>
                                <div className={styles.scheduleInputGroup}>
                                    <label>Date</label>
                                    <input
                                        type="date"
                                        className={styles.scheduleInput}
                                        value={scheduleDate}
                                        onChange={(e) => setScheduleDate(e.target.value)}
                                        min={getMinDate()}
                                    />
                                </div>
                                <div className={styles.scheduleInputGroup}>
                                    <label>Time</label>
                                    <input
                                        type="time"
                                        className={styles.scheduleInput}
                                        value={scheduleTime}
                                        onChange={(e) => setScheduleTime(e.target.value)}
                                    />
                                </div>
                                {scheduleDate && scheduleTime && (
                                    <div className={styles.schedulePreview}>
                                        🕐 {formatSchedulePreview()}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={styles.toolbar}>
                        <div className={styles.toolbarActions}>
                            <button className={styles.toolbarBtn} type="button" title="Emoji">😊</button>
                            <button className={styles.toolbarBtn} type="button" title="Location">📍</button>
                            <button className={styles.toolbarBtn} type="button" title="Hashtags">#️⃣</button>
                            <button className={styles.toolbarBtn} type="button" title="Mention">@</button>
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => handleSubmit('draft')}
                            disabled={isSubmitting || !sharedContent.trim()}
                            type="button"
                        >
                            💾 Save Draft
                        </button>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={() => handleSubmit('scheduled')}
                            disabled={isSubmitting || !sharedContent.trim() || selectedPlatforms.length === 0 || hasAnyError() || (scheduleEnabled && !canSchedule)}
                            type="button"
                            title={hasAnyError() ? 'Fix character limit errors first' : (scheduleEnabled && !canSchedule) ? 'Select date and time' : undefined}
                        >
                            {isSubmitting ? '⏳ Scheduling...' : hasAnyError() ? '⚠️ Fix Errors' : scheduleEnabled ? '📅 Schedule Post' : '🚀 Post Now'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Section */}
            <div className={styles.previewSection}>
                <div className={styles.previewHeader}>
                    <span>👁️</span>
                    <span>Live Previews</span>
                </div>

                {selectedPlatforms.length === 0 ? (
                    <div className={styles.emptyPreview}>
                        <span>📱</span>
                        <p>Select platforms to see previews</p>
                    </div>
                ) : (
                    selectedPlatforms.map(platformId => {
                        const platform = PLATFORMS.find(p => p.id === platformId)!;
                        const content = getContentForPlatform(platformId);
                        const limit = getCharacterLimit(platformId);
                        const remaining = limit ? limit - content.length : null;
                        const charStatus = getCharStatus(content, platformId);
                        const isCustom = hasCustomContent(platformId);

                        return (
                            <div
                                key={platformId}
                                className={`${styles.previewCard} ${activeTab === platformId ? styles.previewCardActive : ''} ${isCustom ? styles.previewCardCustom : ''} ${charStatus === 'error' ? styles.previewError : ''}`}
                                onClick={() => initializePlatformContent(platformId)}
                            >
                                <div className={styles.previewPlatformHeader}>
                                    <div className={styles.previewUser}>
                                        <div className={styles.previewAvatar}></div>
                                        <div>
                                            <div className={styles.previewName}>Your Name</div>
                                            <div className={styles.previewHandle}>@username</div>
                                        </div>
                                    </div>
                                    <div className={styles.platformBadgeGroup}>
                                        {isCustom && (
                                            <span className={styles.customLabel}>Custom</span>
                                        )}
                                        <div className={styles.platformBadge} style={{ color: platform.color }}>
                                            <span>{platform.icon}</span>
                                            <span>{platform.name}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.previewContent}>
                                    {content || <span className={styles.placeholder}>Your post will appear here...</span>}
                                </div>

                                {limit && (
                                    <div className={`${styles.charRemaining} ${styles[charStatus]}`}>
                                        {remaining! >= 0
                                            ? `${remaining} characters left`
                                            : `${Math.abs(remaining!)} characters over limit!`
                                        }
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
