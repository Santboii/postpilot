'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import { PlatformId, PLATFORMS, getCharacterLimit, Post, MediaAttachment, generateId } from '@/types';
import { getPlatformIcon } from '@/components/ui/PlatformIcons';
import { getPost, updatePost, deletePost } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';
import { useConnections } from '@/hooks/useQueries';
import { getCharStatus, getPlatformValidationError } from '@/hooks/usePlatformValidation';
import styles from '@/components/composer/Composer.module.css';
import MediaUploader from '@/components/composer/MediaUploader';
import PlatformSelector from '@/components/composer/PlatformSelector';
import PreviewCard from '@/components/composer/PreviewCard';
import ConfirmModal from '@/components/ui/ConfirmModal';

type ContentMode = 'shared' | PlatformId;

interface EditPostPageProps {
    params: Promise<{ id: string }>;
}

export default function EditPostPage({ params }: EditPostPageProps) {
    const unwrappedParams = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [post, setPost] = useState<Post | null>(null);

    // Get connected accounts for preview
    const { data: connectedAccounts = [] } = useConnections();

    const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sharedContent, setSharedContent] = useState('');
    const [platformContent, setPlatformContent] = useState<Partial<Record<PlatformId, string>>>({});
    const [activeTab, setActiveTab] = useState<ContentMode>('shared');
    const [, setError] = useState<string | null>(null);
    const [allowedPlatforms, setAllowedPlatforms] = useState<PlatformId[] | null>(null);

    // Media State
    const [existingMedia, setExistingMedia] = useState<MediaAttachment[]>([]);
    const [mediaFiles, setMediaFiles] = useState<File[]>([]);

    // Preview section scroll tracking
    const previewSectionRef = useRef<HTMLDivElement>(null);

    const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

    useEffect(() => {
        async function loadPost() {
            const existingPost = await getPost(unwrappedParams.id);
            if (existingPost) {
                setPost(existingPost);
                setSharedContent(existingPost.content);
                setSelectedPlatforms(existingPost.platforms);
                setExistingMedia(existingPost.media || []);

                // Initialize platform content if it exists
                if (existingPost.platformContent) {
                    setPlatformContent(prev => ({
                        ...prev,
                        ...existingPost.platformContent
                    }));
                }

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
            if (!newPlatforms.includes(id) && activeTab === id) {
                handleTabSwitch('shared');
            }
            return newPlatforms;
        });
    };

    // Helper to switch tabs and cleanup empty custom states
    const handleTabSwitch = (newTab: ContentMode) => {
        if (activeTab !== 'shared' && activeTab !== newTab) {
            const current = platformContent[activeTab];
            if (current !== undefined && current.trim() === '') {
                setPlatformContent(prev => {
                    const next = { ...prev };
                    delete next[activeTab as PlatformId];
                    return next;
                });
            }
        }
        setActiveTab(newTab);
    };

    const getContentForPlatform = (platformId: PlatformId): string => {
        return platformContent[platformId] !== undefined ? platformContent[platformId] : sharedContent;
    };

    const getCurrentContent = (): string => {
        if (activeTab === 'shared') return sharedContent;
        return platformContent[activeTab] !== undefined ? platformContent[activeTab] : sharedContent;
    };

    const handleContentChange = (value: string) => {
        if (activeTab === 'shared') {
            setSharedContent(value);
        } else {
            setPlatformContent(prev => ({ ...prev, [activeTab]: value }));
        }
    };

    const hasCustomContent = (platformId: PlatformId): boolean => {
        return platformContent[platformId] !== undefined && platformContent[platformId] !== sharedContent;
    };

    // Switch to platform tab (content initialization happens lazily on edit)
    const initializePlatformContent = (platformId: PlatformId) => {
        handleTabSwitch(platformId);
    };

    const clearPlatformContent = (platformId: PlatformId) => {
        setPlatformContent(prev => {
            const next = { ...prev };
            delete next[platformId];
            return next;
        });
        if (activeTab === platformId) {
            handleTabSwitch('shared');
        }
    };

    // Calculate total media count for validation
    const totalMediaCount = existingMedia.length + mediaFiles.length;

    const getValidationErrors = (): string[] => {
        const errors: string[] = [];

        if (selectedPlatforms.length === 0) {
            errors.push('Select at least one platform');
            return errors;
        }
        if (!sharedContent.trim()) {
            errors.push('Content is required');
        }

        // Per-platform checks
        selectedPlatforms.forEach(platformId => {
            // Char limit
            const content = getContentForPlatform(platformId);
            if (getCharStatus(content, platformId) === 'error') {
                const limit = getCharacterLimit(platformId);
                const platformName = PLATFORMS.find(p => p.id === platformId)?.name || platformId;
                errors.push(`${platformName} exceeds ${limit} chars`);
            }

            // Image requirements - Edit page typically uses shared media pool for now
            const imageError = getPlatformValidationError(platformId, totalMediaCount);
            if (imageError) {
                errors.push(imageError);
            }
        });

        return errors;
    };

    const validationErrors = getValidationErrors();

    const uploadImages = async (): Promise<MediaAttachment[]> => {
        if (mediaFiles.length === 0) return [];

        const supabase = getSupabase();
        const uploadedMedia: MediaAttachment[] = [];

        for (const file of mediaFiles) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${generateId()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('post-media')
                .upload(filePath, file);

            if (uploadError) {
                console.error('Error uploading image:', uploadError);
                throw new Error(`Failed to upload image: ${file.name}`);
            }

            const { data: { publicUrl } } = supabase.storage
                .from('post-media')
                .getPublicUrl(filePath);

            uploadedMedia.push({
                id: generateId(),
                type: 'image',
                url: publicUrl,
                altText: file.name,
            });
        }
        return uploadedMedia;
    };

    const handleSave = async (status: 'draft' | 'scheduled' = 'draft') => {
        if (!sharedContent.trim() || selectedPlatforms.length === 0 || !post) return;
        setIsSubmitting(true);
        setError(null);

        try {
            // Upload new images
            const newUploadedMedia = await uploadImages();

            // Combine with existing media
            const finalMedia = [...existingMedia, ...newUploadedMedia];

            // Filter platform content to only save what's non-empty and relevant
            const activePlatformContent = {} as Record<PlatformId, string>;
            selectedPlatforms.forEach(p => {
                const content = platformContent[p];
                // Include if explicitly defined (even if empty string)
                if (content !== undefined) {
                    activePlatformContent[p] = content;
                }
            });

            await updatePost(post.id, {
                content: sharedContent,
                platforms: selectedPlatforms,
                platformContent: activePlatformContent,
                status,
                media: finalMedia
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
        if (!post) return;
        setShowDeleteConfirmation(true);
    };

    const confirmDelete = async () => {
        if (!post) return;
        try {
            const libraryId = post.libraryId;
            await deletePost(post.id);
            // Redirect back to library if post was in one, otherwise go to home
            if (libraryId) {
                router.push(`/libraries/${libraryId}`);
            } else {
                router.push('/');
            }
        } catch (err) {
            console.error('Failed to delete post:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete post');
        } finally {
            setShowDeleteConfirmation(false);
        }
    };

    // Calculate max media based on selected platforms
    const getMaxMedia = (): number => {
        if (selectedPlatforms.length === 0) return 4;
        const limits = selectedPlatforms.map(id => {
            const platform = PLATFORMS.find(p => p.id === id);
            return platform?.maxMedia || 4;
        });
        return Math.min(...limits);
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
                    <h2>{post.status === 'published' ? 'View Post' : 'Edit Post'}</h2>
                    {post.status !== 'published' && (
                        <button className={styles.deleteBtn} onClick={handleDelete} type="button">
                            🗑️ Delete
                        </button>
                    )}
                </div>

                {/* Platform Selection - show different for published posts */}
                {post.status === 'published' ? (
                    <div className={styles.platformToggle}>
                        {selectedPlatforms.map(platformId => {
                            const platform = PLATFORMS.find(p => p.id === platformId)!;
                            return (
                                <button
                                    key={platformId}
                                    className={`${styles.platformBtn} ${styles.active}`}
                                    type="button"
                                    disabled
                                    style={{ cursor: 'default' }}
                                >
                                    <span style={{ color: platform.color }}>{getPlatformIcon(platformId, 16)}</span>
                                    <span>{platform.name}</span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <PlatformSelector
                        platforms={PLATFORMS}
                        selected={selectedPlatforms}
                        onToggle={togglePlatform}
                        getCharStatusForPlatform={(id) => getCharStatus(getContentForPlatform(id), id)}
                        allowedPlatforms={allowedPlatforms}
                        showAddMore={false}
                    />
                )}

                <div className={styles.editorCard}>
                    {post.status !== 'published' && (
                        <div className={styles.tabInfo}>
                            {selectedPlatforms.length === 1 ? (
                                <div className={styles.singlePlatformHeader}>
                                    <span style={{ color: PLATFORMS.find(p => p.id === selectedPlatforms[0])?.color, fontSize: '1.2em' }}>
                                        {getPlatformIcon(selectedPlatforms[0], 24)}
                                    </span>
                                    <p className={styles.tabDescription}>
                                        Writing post for <strong>{PLATFORMS.find(p => p.id === selectedPlatforms[0])?.name}</strong>
                                    </p>
                                </div>
                            ) : activeTab === 'shared' ? (
                                <p className={styles.tabDescription}>
                                    ✨ This content will be used for all platforms unless you customize individually.
                                </p>
                            ) : (
                                <div className={styles.tabDescriptionRow}>
                                    <p className={styles.tabDescription}>
                                        ✏️ Customizing for <strong>{PLATFORMS.find(p => p.id === activeTab)?.name}</strong> only
                                    </p>
                                    <div className={styles.tabActions}>
                                        <button
                                            className={styles.secondaryActionBtn}
                                            onClick={() => handleTabSwitch('shared')}
                                            type="button"
                                            title="Return to editing shared content (keeps your changes here)"
                                        >
                                            Edit Shared
                                        </button>
                                        <button
                                            className={styles.revertBtn}
                                            onClick={() => clearPlatformContent(activeTab as PlatformId)}
                                            type="button"
                                            title="Discard custom changes and use shared content"
                                        >
                                            ↩ Use shared
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <textarea
                        className={styles.composerTextarea}
                        placeholder={post.status === 'published' ? '' : (activeTab === 'shared' ? "What's on your mind?" : `Customize for ${PLATFORMS.find(p => p.id === activeTab)?.name}...`)}
                        value={getCurrentContent()}
                        onChange={(e) => handleContentChange(e.target.value)}
                        readOnly={post.status === 'published'}
                    />

                    {activeTab !== 'shared' && post.status !== 'published' && (
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

                    {/* Media Uploader */}
                    <div className="mb-4">
                        {post.status !== 'published' ? (
                            <MediaUploader
                                files={mediaFiles}
                                onFilesChange={setMediaFiles}
                                maxMedia={getMaxMedia()}
                                sharedContent={sharedContent}
                                existingMedia={existingMedia}
                                onRemoveExisting={(id) => setExistingMedia(prev => prev.filter(m => m.id !== id))}
                            />
                        ) : (
                            (existingMedia.length > 0) && (
                                <div className={styles.readOnlyMedia}>
                                    {existingMedia.map(media => (
                                        <div key={media.id} className={styles.previewImageWrapper} style={{ position: 'relative', width: '100px', height: '100px' }}>
                                            <Image
                                                src={media.url}
                                                alt="Media"
                                                className={styles.previewImage}
                                                fill
                                                style={{ objectFit: 'cover' }}
                                                unoptimized
                                            />
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>

                    <div className={styles.actions}>
                        {post.status !== 'published' && (
                            <button className="btn btn-ghost" onClick={() => router.push('/')} type="button">
                                Cancel
                            </button>
                        )}

                        {post.status === 'published' ? (
                            <div className={styles.publishedStatusBadge}>
                                <div className={styles.publishedIcon}>✓</div>
                                <div className={styles.publishedInfo}>
                                    <span className={styles.publishedLabel}>Published</span>
                                    <span className={styles.publishedDate}>
                                        {post.publishedAt ? new Date(post.publishedAt).toLocaleString() : 'Recently'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex gap-3">
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
                                            disabled={isSubmitting || validationErrors.length > 0}
                                            type="button"
                                            title={validationErrors.length > 0 ? 'Please fix validation errors' : undefined}
                                        >
                                            {isSubmitting ? '⏳ Saving...' : '✓ Save Changes'}
                                        </button>
                                    </div>
                                    {validationErrors.length > 0 && (
                                        <div className={styles.validationSubtext}>
                                            {validationErrors.map((error, index) => (
                                                <div key={index} className={styles.validationItem}>
                                                    <span>⚠️</span>
                                                    <span>{error}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div
                className={styles.previewSection}
                ref={previewSectionRef}
                onScroll={(e) => {
                    const target = e.target as HTMLDivElement;
                    const scrolledEnough = target.scrollTop > 100;
                    setIsScrolledToBottom(scrolledEnough);
                }}
            >
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
                    <>
                        {/* Sort platforms: validation errors first */}
                        {[...selectedPlatforms]
                            .sort((a, b) => {
                                const aHasError = !!getPlatformValidationError(a, totalMediaCount) || getCharStatus(getContentForPlatform(a), a) === 'error';
                                const bHasError = !!getPlatformValidationError(b, totalMediaCount) || getCharStatus(getContentForPlatform(b), b) === 'error';
                                if (aHasError && !bHasError) return -1;
                                if (!aHasError && bHasError) return 1;
                                return 0;
                            })
                            .map((platformId) => {
                                const content = getContentForPlatform(platformId);
                                const isCustom = hasCustomContent(platformId);

                                // Get connected account info
                                const account = connectedAccounts.find(a => a.platform === platformId);
                                const username = account?.platform_username || 'Your Name';
                                const handle = username.includes(' ')
                                    ? `@${username.toLowerCase().replace(/\s+/g, '')}`
                                    : (username.startsWith('@') ? username : `@${username}`);

                                // Create combined image preview objects with url and type
                                const existingPreviews = existingMedia.map(m => ({
                                    url: m.url,
                                    type: m.type === 'video' ? 'video/mp4' : 'image/jpeg'
                                }));
                                const newFilePreviews = mediaFiles.map(f => ({
                                    url: URL.createObjectURL(f),
                                    type: f.type
                                }));
                                const allImagePreviews = [...existingPreviews, ...newFilePreviews];

                                return (
                                    <React.Fragment key={platformId}>
                                        <PreviewCard
                                            platformId={platformId}
                                            content={content}
                                            username={username}
                                            handle={handle}
                                            isActive={activeTab === platformId}
                                            isCustom={isCustom}
                                            imageCount={totalMediaCount}
                                            imagePreviews={allImagePreviews}
                                            onClick={() => initializePlatformContent(platformId)}
                                        />
                                    </React.Fragment>
                                );
                            })}
                        {/* Sticky scroll indicator at bottom of preview section */}
                        {selectedPlatforms.length > 2 && !isScrolledToBottom && (
                            <button
                                className={styles.scrollHintSticky}
                                onClick={() => {
                                    previewSectionRef.current?.scrollBy({ top: 300, behavior: 'smooth' });
                                }}
                                type="button"
                            >
                                <span>↓</span>
                                <span>{selectedPlatforms.length - 1} more previews below</span>
                            </button>
                        )}
                    </>
                )}
            </div>
            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={showDeleteConfirmation}
                title="Delete Post?"
                message="Are you sure you want to delete this post? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteConfirmation(false)}
            />
        </div>
    );
}
