'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { PlatformId, PLATFORMS, getCharacterLimit, Post } from '@/types';
import { getPlatformIcon } from '@/components/ui/PlatformIcons';
import { getPost, updatePost, deletePost } from '@/lib/db';
import styles from '@/components/composer/Composer.module.css';

type ContentMode = 'shared' | PlatformId;

interface EditPostPageProps {
    params: Promise<{ id: string }>;
}

export default function EditPostPage({ params }: EditPostPageProps) {
    const unwrappedParams = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [post, setPost] = useState<Post | null>(null);

    const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sharedContent, setSharedContent] = useState('');
    const [platformContent, setPlatformContent] = useState<Record<PlatformId, string>>({
        twitter: '',
        instagram: '',
        linkedin: '',
        facebook: '',
        threads: '',
    });
    const [activeTab, setActiveTab] = useState<ContentMode>('shared');
    const [error, setError] = useState<string | null>(null);
    const [allowedPlatforms, setAllowedPlatforms] = useState<PlatformId[] | null>(null);

    useEffect(() => {
        async function loadPost() {
            const existingPost = await getPost(unwrappedParams.id);
            if (existingPost) {
                setPost(existingPost);
                setSharedContent(existingPost.content);
                setSelectedPlatforms(existingPost.platforms);

                // Fetch library restrictions if applicable
                if (existingPost.libraryId) {
                    try {
                        const res = await fetch(`/api/libraries/${existingPost.libraryId}`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data.library.platforms && data.library.platforms.length > 0) {
                                setAllowedPlatforms(data.library.platforms);
                            }
                        }
                    } catch (err) {
                        console.error('Failed to load library settings:', err);
                    }
                }
            }
            setLoading(false);
        }
        loadPost();
    }, [unwrappedParams.id]);

    const togglePlatform = (id: PlatformId) => {
        if (allowedPlatforms && !allowedPlatforms.includes(id)) return;

        setSelectedPlatforms(prev => {
            const newPlatforms = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
            if (!newPlatforms.includes(id) && activeTab === id) setActiveTab('shared');
            return newPlatforms;
        });
    };

    // ...



    const getContentForPlatform = (platformId: PlatformId): string => {
        return platformContent[platformId] || sharedContent;
    };

    const getCurrentContent = (): string => {
        if (activeTab === 'shared') return sharedContent;
        return platformContent[activeTab] || sharedContent;
    };

    const handleContentChange = (value: string) => {
        if (activeTab === 'shared') {
            setSharedContent(value);
        } else {
            setPlatformContent(prev => ({ ...prev, [activeTab]: value }));
        }
    };

    const hasCustomContent = (platformId: PlatformId): boolean => {
        return platformContent[platformId].length > 0;
    };

    const initializePlatformContent = (platformId: PlatformId) => {
        if (!platformContent[platformId]) {
            setPlatformContent(prev => ({ ...prev, [platformId]: sharedContent }));
        }
        setActiveTab(platformId);
    };

    const clearPlatformContent = (platformId: PlatformId) => {
        setPlatformContent(prev => ({ ...prev, [platformId]: '' }));
        if (activeTab === platformId) setActiveTab('shared');
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
        return selectedPlatforms.some(id => getCharStatus(getContentForPlatform(id), id) === 'error');
    };

    const handleSave = async (status: 'draft' | 'scheduled' = 'draft') => {
        if (!sharedContent.trim() || selectedPlatforms.length === 0 || !post) return;
        setIsSubmitting(true);
        setError(null);

        try {
            await updatePost(post.id, {
                content: sharedContent,
                platforms: selectedPlatforms,
                status,
            });
            router.push('/');
        } catch (err) {
            console.error('Failed to save post:', err);
            setError(err instanceof Error ? err.message : 'Failed to save post');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!post || !confirm('Are you sure you want to delete this post?')) return;
        try {
            await deletePost(post.id);
            router.push('/');
        } catch (err) {
            console.error('Failed to delete post:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete post');
        }
    };

    if (loading) {
        return (
            <div className={styles.composerContainer}>
                <div className={styles.editorSection}>
                    <div className="skeleton" style={{ height: 40, width: 200, marginBottom: 16 }} />
                    <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
                </div>
            </div>
        );
    }

    if (!post) {
        return (
            <div className={styles.composerContainer}>
                <div className={styles.editorSection}>
                    <h2>Post not found</h2>
                    <button className="btn btn-secondary" onClick={() => router.push('/')}>
                        ← Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.composerContainer}>
            <div className={styles.editorSection}>
                <div className={styles.sectionHeader}>
                    <h2>Edit Post</h2>
                    <button className={styles.deleteBtn} onClick={handleDelete} type="button">
                        🗑️ Delete
                    </button>
                </div>

                <div className={styles.platformToggle}>
                    {PLATFORMS.map(platform => {
                        const isDisabled = allowedPlatforms && !allowedPlatforms.includes(platform.id);
                        return (
                            <button
                                key={platform.id}
                                className={`${styles.platformBtn} ${selectedPlatforms.includes(platform.id) ? styles.active : ''} ${isDisabled ? styles.disabled : ''}`}
                                onClick={() => togglePlatform(platform.id)}
                                type="button"
                                disabled={!!isDisabled}
                                title={isDisabled ? 'Not available for this library' : ''}
                                style={isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                            >
                                <span>{getPlatformIcon(platform.id, 16)}</span>
                                <span>{platform.name}</span>
                            </button>
                        );
                    })}
                </div>

                <div className={styles.contentTabs}>
                    <button
                        className={`${styles.contentTab} ${activeTab === 'shared' ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab('shared')}
                        type="button"
                    >
                        <span>📝</span>
                        <span>Shared Content</span>
                    </button>

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
                                <span style={{ color: platform.color }}>{getPlatformIcon(platform.id, 16)}</span>
                                <span>{platform.name}</span>
                                {isCustom && <span className={styles.customBadge}>✎</span>}
                                {status === 'error' && <span className={styles.errorIndicator}>!</span>}
                            </button>
                        );
                    })}
                </div>

                <div className={styles.editorCard}>
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
                        placeholder={activeTab === 'shared' ? "What's on your mind?" : `Customize for ${PLATFORMS.find(p => p.id === activeTab)?.name}...`}
                        value={getCurrentContent()}
                        onChange={(e) => handleContentChange(e.target.value)}
                    />

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
                                        <span>{content.length}</span>/<span>{limit}</span>
                                        <span className={styles.charLabel}>
                                            {remaining >= 0 ? `(${remaining} left)` : `(${Math.abs(remaining)} over!)`}
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    <div className={styles.actions}>
                        <button className="btn btn-ghost" onClick={() => router.push('/')} type="button">
                            Cancel
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={() => handleSave('draft')}
                            disabled={isSubmitting || !sharedContent.trim()}
                            type="button"
                        >
                            💾 Save Draft
                        </button>
                        <button
                            className="btn btn-primary btn-lg"
                            onClick={() => handleSave('scheduled')}
                            disabled={isSubmitting || !sharedContent.trim() || selectedPlatforms.length === 0 || hasAnyError()}
                            type="button"
                        >
                            {isSubmitting ? '⏳ Saving...' : hasAnyError() ? '⚠️ Fix Errors' : '✓ Save Changes'}
                        </button>
                    </div>
                </div>
            </div>

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
                                className={`${styles.previewCard} ${charStatus === 'error' ? styles.previewError : ''}`}
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
                                        {isCustom && <span className={styles.customLabel}>Custom</span>}
                                        <div className={styles.platformBadge} style={{ color: platform.color }}>
                                            <span>{getPlatformIcon(platform.id, 16)}</span>
                                            <span>{platform.name}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.previewContent}>
                                    {content || <span className={styles.placeholder}>Your post will appear here...</span>}
                                </div>

                                {limit && (
                                    <div className={`${styles.charRemaining} ${styles[charStatus]}`}>
                                        {remaining! >= 0 ? `${remaining} characters left` : `${Math.abs(remaining!)} characters over limit!`}
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
