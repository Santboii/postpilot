'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlatformId, PLATFORMS, getCharacterLimit, Platform, MediaAttachment, generateId, ContentLibrary } from '@/types';
import { createPost, publishPost } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';
import { getPlatformIcon } from '@/components/ui/PlatformIcons';
import { useInvalidatePosts, useLibraries } from '@/hooks/useQueries';
import { Library, Calendar as CalendarIcon, Repeat } from 'lucide-react';
import MediaUploader from './MediaUploader';
import AITextGenerator from './AITextGenerator';
import styles from './Composer.module.css';

type ContentMode = 'shared' | PlatformId;

export default function PostComposer() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const invalidatePosts = useInvalidatePosts();
    const [connectedPlatformIds, setConnectedPlatformIds] = useState<PlatformId[]>([]);
    const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connectedAccountsMap, setConnectedAccountsMap] = useState<Record<PlatformId, { username: string; handle: string }>>({} as any);

    // AI Composers State
    const [showAIPanel, setShowAIPanel] = useState(false);

    // Platform Optimization State
    const [isOptimizing, setIsOptimizing] = useState(false);


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

    // Evergreen / Library Mode
    const [postMode, setPostMode] = useState<'schedule' | 'library'>('schedule');
    const { data: fetchedLibraries, isLoading: isLoadingLibraries } = useLibraries();
    const [libraries, setLibraries] = useState<ContentLibrary[]>([]);
    const [selectedLibraryId, setSelectedLibraryId] = useState('');


    useEffect(() => {
        if (fetchedLibraries) {
            setLibraries(fetchedLibraries as ContentLibrary[]);
        }
    }, [fetchedLibraries]);

    // Image upload
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Sync previews for Live Preview section
    useEffect(() => {
        const newPreviews = selectedImages.map(file => URL.createObjectURL(file));
        setImagePreviews(newPreviews);
        return () => newPreviews.forEach(url => URL.revokeObjectURL(url));
    }, [selectedImages]);

    // Handle initial params from AI Composer (Legacy support for external redirects if any)
    useEffect(() => {
        const content = searchParams.get('content');
        const platform = searchParams.get('platform') as PlatformId | null;
        const imageUrl = searchParams.get('image');

        if (content) {
            setSharedContent(content);
        }

        if (platform && PLATFORMS.some(p => p.id === platform)) {
            // We'll set this when connected platforms load, 
            // but we can hint at it or handle logic there.
            // For now, let's store it to apply after connected check
        }

        if (imageUrl) {
            const fetchImage = (url: string) => {
                fetch(url)
                    .then(res => res.blob())
                    .then(blob => {
                        const file = new File([blob], "generated-image.png", { type: "image/png" });
                        setSelectedImages(prev => [...prev, file]);
                        // Preview will handle itself via useEffect
                    })
                    .catch(err => console.error("Failed to load generated image", err));
            };

            if (imageUrl === 'session_storage') {
                const storedImage = sessionStorage.getItem('ai_generated_image');
                if (storedImage) {
                    fetchImage(storedImage);
                    // Optional: Clear it after load? check if it causes refresh issues. 
                    // Keeping it for now so refresh works.
                }
            } else {
                fetchImage(imageUrl);
            }
        }
    }, [searchParams]);

    // Fetch connected platforms on mount
    useEffect(() => {
        async function loadConnectedPlatforms() {
            const supabase = getSupabase();
            const { data } = await supabase
                .from('connected_accounts')
                .select('platform, platform_username');

            if (data) {
                const connectedIds: PlatformId[] = [];
                const accountMap: Record<PlatformId, { username: string; handle: string }> = {} as any;

                data.forEach((account: any) => {
                    const pid = account.platform as PlatformId;
                    connectedIds.push(pid);

                    const name = account.platform_username || 'User';
                    const handle = name.includes(' ')
                        ? `@${name.toLowerCase().replace(/\s+/g, '')}`
                        : (name.startsWith('@') ? name : `@${name}`);

                    accountMap[pid] = {
                        username: name,
                        handle: handle
                    };
                });

                setConnectedPlatformIds(connectedIds);
                setConnectedAccountsMap(accountMap);

                // Auto-select all connected platforms by default
                const initialSelection = [...connectedIds];
                setSelectedPlatforms(initialSelection);

                // If only one platform, set it as active tab instead of 'shared'
                if (initialSelection.length === 1) {
                    setActiveTab(initialSelection[0]);
                }
            } else {
                setConnectedPlatformIds([]);
            }

            setIsLoading(false);
        }
        loadConnectedPlatforms();
    }, [searchParams]);

    // Get platforms that are connected (with full platform info)
    const connectedPlatforms = useMemo(() => {
        return PLATFORMS.filter(p => connectedPlatformIds.includes(p.id));
    }, [connectedPlatformIds]);

    // Show shared tab only if multiple platforms are connected
    const showSharedTab = connectedPlatforms.length > 1;

    const togglePlatform = (id: PlatformId) => {
        setSelectedPlatforms(prev => {
            // Prevent deselecting the last platform
            if (prev.includes(id) && prev.length === 1) {
                return prev;
            }

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

            // If only one platform is connected, we treat the platform content as shared content too
            // This ensures validation passes (which checks sharedContent) and keeps data in sync
            if (!showSharedTab) {
                setSharedContent(value);
            }
        }
    };



    // Platform Optimization Handler
    const handleOptimize = async () => {
        if (activeTab === 'shared') return;

        const currentContent = getCurrentContent();
        if (!currentContent.trim()) {
            setError('No content to optimize');
            return;
        }

        setIsOptimizing(true);
        setError(null);

        try {
            const response = await fetch('/api/ai/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: currentContent,
                    platform: activeTab
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to optimize');
            }

            const data = await response.json();
            handleContentChange(data.content);
        } catch (error: any) {
            console.error('Optimization failed', error);
            setError(error.message || 'Failed to optimize content.');
        } finally {
            setIsOptimizing(false);
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
            [platformId]: '',
        }));
        if (activeTab === platformId) {
            setActiveTab('shared');
        }
    };

    const getMaxMedia = (): number => {
        // Find the strictest limit among selected platforms
        // If no platforms selected, default to 4 (Twitter limit) as a baseline
        if (selectedPlatforms.length === 0) return 4;

        const limits = selectedPlatforms.map(id => {
            const platform = PLATFORMS.find(p => p.id === id);
            return platform?.maxMedia || 4;
        });

        return Math.min(...limits);
    };

    const validateMediaCount = (count: number): string | null => {
        const max = getMaxMedia();
        if (count > max) {
            return `Too many images for selected platforms (max ${max})`;
        }
        return null;
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
        // Use local time instead of UTC to fix "today" selection issues
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
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
            hour12: true,
        });
    };

    const hasValidContent = (): boolean => {
        if (!sharedContent.trim()) return false;
        if (selectedPlatforms.length === 0) return false;
        // We still check if platforms have content if we want to be strict, but the user requirement
        // specifically asked for "shared is empty; and that it is required". 
        // So strict requirement is sharedContent. 
        return true;
    };

    const canSchedule = scheduleEnabled && scheduleDate && scheduleTime;

    const getDisabledReason = (): string | undefined => {
        if (isSubmitting) return 'Publishing in progress...';
        if (!sharedContent.trim()) return 'Shared content is required';
        if (selectedPlatforms.length === 0) return 'Select at least one platform';

        // Media validation
        const mediaError = validateMediaCount(selectedImages.length);
        if (mediaError) return mediaError;

        if (hasAnyError()) return 'Fix character limit errors first';

        if (postMode === 'schedule') {
            if (scheduleEnabled && !canSchedule) return 'Select date and time';
        } else {
            if (!selectedLibraryId) return 'Select a library';
        }

        return undefined;
    };

    const disabledReason = getDisabledReason();

    const uploadImages = async (): Promise<MediaAttachment[]> => {
        if (selectedImages.length === 0) return [];

        const supabase = getSupabase();
        const uploadedMedia: MediaAttachment[] = [];

        for (const file of selectedImages) {
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

    const handleSubmit = async (targetStatus: 'draft' | 'scheduled' | 'published' = 'draft') => {
        if (!hasValidContent()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            // Upload images first
            const uploadedMedia = await uploadImages();

            // Logic:
            // 1. If 'published', create as 'published' (if DB supports invalidating) or 'draft' then publish?
            //    Best flow: Create as 'draft' first, then call publishPost. 
            //    Wait, creating as 'published' directly might imply it's already done? 
            //    No, for immediate publish we need to run the API calls.
            // 2. If 'scheduled', create as 'scheduled' with date.
            // 3. If 'draft', create as 'draft'.

            const initialStatus = targetStatus === 'published' ? 'draft' : targetStatus;

            // If library mode, we just save as draft (or published if we want it immediately available for recycling, 
            // but usually it waits for the slot). 'draft' is safer for "queued". 
            // Actually, if it's evergreen, it can be 'published' status but is_evergreen=true.
            // But for a new post that hasn't gone out yet, 'draft' + library_id is correct. 
            // The Cron job picks it up. 

            const scheduledAt = (postMode === 'schedule' && targetStatus === 'scheduled')
                ? getScheduledDateTime()
                : undefined;

            const post = await createPost({
                content: sharedContent,
                platforms: selectedPlatforms,
                status: initialStatus,
                scheduledAt,
                platformContent,
                media: uploadedMedia,
                libraryId: postMode === 'library' ? selectedLibraryId : undefined,
            });

            if (targetStatus === 'published' && postMode !== 'library') {
                // Trigger immediate publish (only for schedule mode, not library mode)
                await publishPost(post.id);
            }

            invalidatePosts(); // Refresh posts cache for immediate display
            router.push('/');
        } catch (err) {
            console.error('Failed to create post:', err);
            setError(err instanceof Error ? err.message : 'Failed to create post');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.composerContainer}>
            <div className={styles.editorSection}>
                <div className={styles.sectionHeader}>
                    <h2>Create Post</h2>
                </div>

                {/* Platform Selection - Unified toggle with active/inactive states */}
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
                        {connectedPlatforms.map(platform => {
                            const isSelected = selectedPlatforms.includes(platform.id);
                            const content = getContentForPlatform(platform.id);
                            const status = getCharStatus(content, platform.id);

                            return (
                                <button
                                    key={platform.id}
                                    className={`${styles.platformBtn} ${isSelected ? styles.active : styles.inactive}`}
                                    onClick={() => togglePlatform(platform.id)}
                                    type="button"
                                    title={isSelected ? 'Click to deselect' : 'Click to select'}
                                >
                                    <span style={{ color: isSelected ? platform.color : undefined }}>{getPlatformIcon(platform.id, 18)}</span>
                                    <span>{platform.name}</span>
                                    {status === 'error' && isSelected && <span className={styles.errorIndicator}>!</span>}
                                </button>
                            );
                        })}
                        <a href="/settings" className={styles.addMoreLink} title="Connect more platforms">
                            <span>+</span>
                            <span>Add More</span>
                        </a>
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
                                {showSharedTab ? (
                                    <>
                                        <p className={styles.tabDescription}>
                                            ✏️ Customizing for <strong>{PLATFORMS.find(p => p.id === activeTab)?.name}</strong> only
                                        </p>
                                        <div className={styles.tabActions}>
                                            <button
                                                className={styles.optimizeBtn}
                                                onClick={handleOptimize}
                                                disabled={isOptimizing || !getCurrentContent().trim()}
                                                type="button"
                                                title={`Rewrite content optimized for ${PLATFORMS.find(p => p.id === activeTab)?.name}`}
                                            >
                                                {isOptimizing ? (
                                                    <>
                                                        <span className="w-3 h-3 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                                                        Optimizing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>✨</span>
                                                        Optimize for {PLATFORMS.find(p => p.id === activeTab)?.name}
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                className={styles.secondaryActionBtn}
                                                onClick={() => setActiveTab('shared')}
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
                                    </>
                                ) : (
                                    <p className={styles.tabDescription}>
                                        ✏️ Creating post for <strong>{PLATFORMS.find(p => p.id === activeTab)?.name}</strong>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={styles.textareaContainer}>
                        <textarea
                            className={styles.composerTextarea}
                            placeholder={activeTab === 'shared'
                                ? "What's on your mind? Write your main message here..."
                                : `Customize your ${PLATFORMS.find(p => p.id === activeTab)?.name} post...`}
                            value={getCurrentContent()}
                            onChange={(e) => handleContentChange(e.target.value)}
                        />

                        <button
                            className={styles.floatingAIButton}
                            onClick={() => {
                                setShowAIPanel(!showAIPanel);
                            }}
                            title="Magic Compose with AI"
                        >
                            ✨
                        </button>

                        {/* AI Popover */}
                        {showAIPanel && (
                            <AITextGenerator
                                onClose={() => setShowAIPanel(false)}
                                onGenerate={(content) => {
                                    handleContentChange(content);
                                    // We could also handle image here if AITextGen supported it
                                }}
                                platform={activeTab === 'shared' ? (selectedPlatforms[0] || 'twitter') : activeTab}
                            />
                        )}
                    </div>

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

                    {/* Image Upload Dropzone */}
                    <MediaUploader
                        files={selectedImages}
                        onFilesChange={setSelectedImages}
                        maxMedia={getMaxMedia()}
                        disabled={isSubmitting}
                        sharedContent={sharedContent}
                    />

                    {/* X Media Warning - shown only when images are uploaded and X is selected */}
                    {selectedPlatforms.includes('twitter') && selectedImages.length > 0 && (
                        <div className={styles.xMediaWarning}>
                            <span>⚠️</span>
                            <span>Images are not yet supported for X (Twitter). Photos will only be posted to other selected platforms.</span>
                        </div>
                    )}

                    {/* Publishing Options Section */}
                    <div className={styles.scheduleSection}>
                        <div className={styles.modeToggleHeader}>
                            <button
                                type="button"
                                className={`${styles.modeBtn} ${postMode === 'schedule' ? styles.modeBtnActive : ''}`}
                                onClick={() => setPostMode('schedule')}
                            >
                                <CalendarIcon size={16} />
                                <span>Schedule Once</span>
                            </button>
                            <button
                                type="button"
                                className={`${styles.modeBtn} ${postMode === 'library' ? styles.modeBtnActive : ''}`}
                                onClick={() => setPostMode('library')}
                            >
                                <Library size={16} />
                                <span>Add to Library</span>
                            </button>
                        </div>

                        {postMode === 'schedule' ? (
                            <div className={styles.scheduleOptions}>
                                <div className={styles.scheduleHeader}>
                                    <label className={styles.scheduleToggle}>
                                        <input
                                            type="checkbox"
                                            checked={scheduleEnabled}
                                            onChange={(e) => setScheduleEnabled(e.target.checked)}
                                        />
                                        <span className={styles.scheduleToggleSlider}></span>
                                        <span className={styles.scheduleLabel}>📅 Schedule for specific time</span>
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
                        ) : (
                            <div className={styles.libraryOptions}>
                                <div className={styles.libraryPickerGroup}>
                                    <label className={styles.optionLabel}>Choose Library</label>
                                    <select
                                        className={styles.librarySelect}
                                        value={selectedLibraryId}
                                        onChange={(e) => setSelectedLibraryId(e.target.value)}
                                    >
                                        <option value="" disabled>Select a library...</option>
                                        {libraries.map(lib => (
                                            <option key={lib.id} value={lib.id}>
                                                {lib.name}
                                            </option>
                                        ))}
                                    </select>
                                    {libraries.length === 0 && (
                                        <div className={styles.noLibHint}>
                                            <a href="/libraries" target="_blank" className={styles.createLibLink}>
                                                + Create a library first
                                            </a>
                                        </div>
                                    )}
                                </div>

                            </div>
                        )}
                    </div>

                    <div className={styles.actions}>
                        <button
                            className={styles.secondaryBtn}
                            onClick={() => handleSubmit('draft')}
                            disabled={isSubmitting || !hasValidContent()}
                            type="button"
                            title={!hasValidContent() ? 'Content required to save draft' : undefined}
                        >
                            <span className={styles.btnIcon}>💾</span>
                            <span>Save Draft</span>
                        </button>
                        <button
                            className={`${styles.primaryBtn} ${hasAnyError() ? styles.errorBtn : ''}`}
                            onClick={() => handleSubmit(postMode === 'library' ? 'draft' : (scheduleEnabled ? 'scheduled' : 'published'))}
                            disabled={!!disabledReason}
                            type="button"
                            title={disabledReason}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className={styles.spinner} />
                                    <span>{postMode === 'library' ? 'Adding...' : 'Publishing...'}</span>
                                </>
                            ) : hasAnyError() ? (
                                <>
                                    <span className={styles.btnIcon}>⚠️</span>
                                    <span>Fix Errors</span>
                                </>
                            ) : postMode === 'library' ? (
                                <>
                                    <span className={styles.btnIcon}>📚</span>
                                    <span>Add to Library</span>
                                </>
                            ) : scheduleEnabled ? (
                                <>
                                    <span className={styles.btnIcon}>📅</span>
                                    <span>Schedule Post</span>
                                </>
                            ) : (
                                <>
                                    <span className={styles.btnIcon}>🚀</span>
                                    <span>Publish Now</span>
                                </>
                            )}
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
                        const username = connectedAccountsMap[platformId]?.username || 'Your Name';
                        const handle = connectedAccountsMap[platformId]?.handle || (username.includes(' ') ? `@${username.toLowerCase().replace(/\s+/g, '')}` : `@${username}`);

                        // Helper to get platform-specific avatar class
                        const getAvatarClass = (pid: string) => {
                            switch (pid) {
                                case 'twitter': return styles.previewAvatarTwitter;
                                case 'facebook': return styles.previewAvatarFacebook;
                                case 'linkedin': return styles.previewAvatarLinkedin;
                                case 'instagram': return styles.previewAvatarInstagram;
                                default: return '';
                            }
                        };

                        return (
                            <div
                                key={platformId}
                                className={`${styles.previewCard} ${activeTab === platformId ? styles.previewCardActive : ''} ${isCustom ? styles.previewCardCustom : ''} ${charStatus === 'error' ? styles.previewError : ''}`}
                                onClick={() => initializePlatformContent(platformId)}
                            >
                                <div className={styles.previewPlatformHeader}>
                                    <div className={styles.previewUser}>
                                        <div className={`${styles.previewAvatar} ${getAvatarClass(platformId)}`}>
                                            {/* Placeholder Avatar - could fetch real one later */}
                                            {username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className={styles.previewName}>{username}</div>
                                            <div className={styles.previewHandle}>{handle}</div>
                                        </div>
                                    </div>
                                    <div className={styles.platformBadgeGroup}>
                                        {isCustom && (
                                            <span className={styles.customLabel}>Custom</span>
                                        )}
                                        <div className={styles.platformBadge} style={{ color: platform.color }}>
                                            <span>{getPlatformIcon(platform.id, 16)}</span>
                                            <span>{platform.name}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.previewContent}>
                                    {content || <span className={styles.placeholder}>Your post will appear here...</span>}
                                </div>

                                {imagePreviews.length > 0 && (
                                    <div className={styles.previewImages}>
                                        {imagePreviews.map((preview, index) => (
                                            <img
                                                key={index}
                                                src={preview}
                                                alt={`Attachment ${index + 1}`}
                                                className={styles.previewImageThumb}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPreviewImage(preview);
                                                }}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        ))}
                                    </div>
                                )}

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
            {/* Full Screen Image Preview Modal */}
            {previewImage && (
                <div
                    className={styles.imageModalOverlay}
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        className={styles.imageModalContent}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            className={styles.closeModalBtn}
                            onClick={() => setPreviewImage(null)}
                        >
                            ✕
                        </button>
                        <img src={previewImage} alt="Full size preview" />
                    </div>
                </div>
            )}
        </div>
    );
}
