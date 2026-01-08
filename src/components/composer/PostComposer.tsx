'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlatformId, PLATFORMS, getCharacterLimit, MediaAttachment, generateId, ContentLibrary } from '@/types';
import { createPost, publishPost } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';
import { getPlatformIcon } from '@/components/ui/PlatformIcons';
import { useInvalidatePosts, useLibraries, useConnections } from '@/hooks/useQueries';
import { getCharStatus, getPlatformValidationError } from '@/hooks/usePlatformValidation';
import { Library, Calendar as CalendarIcon } from 'lucide-react';
import MediaUploader from './MediaUploader';
import ConfirmModal from '../ui/ConfirmModal';

import AITextGenerator from './AITextGenerator';
import PlatformSelector from './PlatformSelector';
import PreviewCard from './PreviewCard';
import styles from './Composer.module.css';

interface PinterestBoard {
    id: string;
    name: string;
    description: string;
    privacy: 'PUBLIC' | 'PROTECTED' | 'SECRET';
}

import MediaCarouselModal from '@/components/ui/MediaCarouselModal';

type ContentMode = 'shared' | PlatformId;

export default function PostComposer() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const invalidatePosts = useInvalidatePosts();
    const [connectedPlatformIds, setConnectedPlatformIds] = useState<PlatformId[]>([]);
    const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [connectedAccountsMap, setConnectedAccountsMap] = useState<Partial<Record<PlatformId, { username: string; handle: string }>>>({});

    // AI Composers State
    const [showAIPanel, setShowAIPanel] = useState(false);

    // Platform Optimization State
    const [isOptimizing, setIsOptimizing] = useState(false);


    // Shared content (used when not customizing per-platform)
    const [sharedContent, setSharedContent] = useState('');

    // Per-platform content overrides
    const [platformContent, setPlatformContent] = useState<Partial<Record<PlatformId, string>>>({});

    // Per-platform metadata (e.g. Pinterest Board ID)
    const [platformMetadata, setPlatformMetadata] = useState<Record<PlatformId, Record<string, unknown>>>({
        twitter: {},
        instagram: {},
        linkedin: {},
        facebook: {},
        threads: {},
        bluesky: {},
        pinterest: {},
        tiktok: {},
    });

    // Pinterest specific state
    const [pinterestBoards, setPinterestBoards] = useState<PinterestBoard[]>([]);
    const [isLoadingBoards, setIsLoadingBoards] = useState(false);

    // Per-platform image overrides (undefined means inherit from shared)
    const [platformImages, setPlatformImages] = useState<Partial<Record<PlatformId, File[]>>>({});

    // Which content mode we're editing
    const [activeTab, setActiveTab] = useState<ContentMode>('shared');

    // Scheduling
    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [scheduleDate, setScheduleDate] = useState('');
    const [scheduleTime, setScheduleTime] = useState('');

    // Evergreen / Library Mode
    const [postMode, setPostMode] = useState<'schedule' | 'library'>('schedule');
    const { data: fetchedLibraries } = useLibraries();
    const [libraries, setLibraries] = useState<ContentLibrary[]>([]);
    const [selectedLibraryId, setSelectedLibraryId] = useState('');


    useEffect(() => {
        if (fetchedLibraries) {
            setLibraries(fetchedLibraries as ContentLibrary[]);
        }
    }, [fetchedLibraries]);

    // Image upload
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<{ url: string; type: string }[]>([]);
    const [previewIndex, setPreviewIndex] = useState<number>(-1);

    // Preview section scroll tracking
    const previewSectionRef = useRef<HTMLDivElement>(null);
    const [isScrolledToBottom, setIsScrolledToBottom] = useState(false);

    // Confirmation Modals
    const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);


    // Confirmation Modals



    // Sync previews for Live Preview section
    useEffect(() => {
        const newPreviews = selectedImages.map(file => ({
            url: URL.createObjectURL(file),
            type: file.type
        }));
        setImagePreviews(newPreviews);
        return () => newPreviews.forEach(p => URL.revokeObjectURL(p.url));
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

    // Cached Connections Query
    const { data: connectedAccountsData, isLoading: isLoadingConnections } = useConnections();

    useEffect(() => {
        if (connectedAccountsData) {
            const connectedIds: PlatformId[] = [];
            const accountMap: Partial<Record<PlatformId, { username: string; handle: string }>> = {};

            connectedAccountsData.forEach((account) => {
                const pid = account.platform;
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


            // Auto-select all connected platforms by default ONLY on initial load
            // We use a ref or check if selection is empty to prevent overwriting user selection
            if (selectedPlatforms.length === 0 && connectedIds.length > 0) {
                setSelectedPlatforms([...connectedIds]);
                if (connectedIds.length === 1) {
                    setActiveTab(connectedIds[0]);
                }
            }
        }
        setIsLoading(isLoadingConnections);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connectedAccountsData, isLoadingConnections]);

    // Fetch Pinterest Boards if Pinterest is connected
    useEffect(() => {
        if (connectedPlatformIds.includes('pinterest') && pinterestBoards.length === 0) {
            setIsLoadingBoards(true);
            fetch('/api/pinterest/boards')
                .then(res => res.json())
                .then(data => {
                    if (data.boards) {
                        setPinterestBoards(data.boards);
                        // Default to first board if not set
                        if (data.boards.length > 0 && !platformMetadata.pinterest?.boardId) {
                            setPlatformMetadata(prev => ({
                                ...prev,
                                pinterest: { ...prev.pinterest, boardId: data.boards[0].id }
                            }));
                        }
                    }
                })
                .catch(err => console.error('Failed to load Pinterest boards:', err))
                .finally(() => setIsLoadingBoards(false));
        }
    }, [connectedPlatformIds, pinterestBoards.length, platformMetadata.pinterest?.boardId]);

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
                    handleTabSwitch('shared');
                } else if (newPlatforms.length > 0) {
                    handleTabSwitch(newPlatforms[0]);
                }
            }

            return newPlatforms;
        });
    };

    // Helper to switch tabs and cleanup empty custom states
    const handleTabSwitch = (newTab: ContentMode) => {
        // If leaving a custom tab and it has empty content, revert it to shared (inherit)
        // This prevents leaving "blank" custom overrides unintentionally
        if (activeTab !== 'shared' && activeTab !== newTab) {
            const current = platformContent[activeTab];
            // Only clean up if it's explicitly set to empty string (and assume no custom images prevents cleanup?)
            // User requested "found blank -> defaulted back".
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

    // Get content for a specific platform (fallback to shared)
    const getContentForPlatform = (platformId: PlatformId): string => {
        return platformContent[platformId] !== undefined ? platformContent[platformId] : sharedContent;
    };

    // Get the content being edited in the current tab
    const getCurrentContent = (): string => {
        if (activeTab === 'shared') return sharedContent;
        return platformContent[activeTab] !== undefined ? platformContent[activeTab] : sharedContent;
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

    const areImageSetsEqual = (a: File[], b: File[]) => {
        if (a.length !== b.length) return false;
        return a.every((file, index) => {
            const other = b[index];
            return file.name === other.name && file.size === other.size && file.lastModified === other.lastModified;
        });
    };

    // Images Helper: Get current images based on tab
    // When only 1 platform is selected, return that platform's images
    const getCurrentImages = (): File[] => {
        if (selectedPlatforms.length === 1) {
            return platformImages[selectedPlatforms[0]] ?? selectedImages;
        }
        if (activeTab === 'shared') return selectedImages;
        return platformImages[activeTab] ?? selectedImages;
    };

    // Images Handler - when only 1 platform is selected, treat it as platform-specific
    const handleImagesChange = (files: File[]) => {
        // If only 1 platform is selected, always update that specific platform's images
        if (selectedPlatforms.length === 1) {
            setPlatformImages(prev => ({
                ...prev,
                [selectedPlatforms[0]]: files
            }));
        } else if (activeTab === 'shared') {
            setSelectedImages(files);
        } else {
            setPlatformImages(prev => ({
                ...prev,
                [activeTab]: files
            }));
        }
    };

    // Promote custom platform images to shared
    const handleMakeShared = () => {
        if (activeTab === 'shared') return;
        const currentImages = platformImages[activeTab];
        if (currentImages) {
            setSelectedImages(currentImages);
            // Revert back to shared state (inheriting the new shared images)
            clearPlatformContent(activeTab);
        }
    };

    // Platform Optimization Handler
    const handleOptimize = async () => {
        if (activeTab === 'shared') return;

        const currentContent = getCurrentContent();
        if (!currentContent.trim()) {
            alert('No content to optimize');
            return;
        }

        setIsOptimizing(true);
        setIsOptimizing(true);

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
            handleContentChange(data.content);
        } catch (error: unknown) {
            console.error('Optimization failed', error);
            const msg = error instanceof Error ? error.message : 'Failed to optimize content.';
            alert(msg);
        } finally {
            setIsOptimizing(false);
        }
    };

    // Check if a platform has custom content (different from shared)
    const hasCustomContent = (platformId: PlatformId): boolean => {
        const customText = platformContent[platformId] || '';
        const customImages = platformImages[platformId];
        // It has custom content if text is different OR if specific images are set
        // Note: platformImages being undefined means "inherit".
        const hasCustomText = customText.length > 0 && customText !== sharedContent;
        const hasCustomImages = customImages !== undefined;
        return hasCustomText || hasCustomImages;
    };

    // Switch to platform tab (content initialization happens lazily on edit)
    const initializePlatformContent = (platformId: PlatformId) => {
        handleTabSwitch(platformId);
    };

    // Clear platform-specific content (revert to shared)
    const clearPlatformContent = (platformId: PlatformId) => {
        setPlatformContent(prev => {
            const next = { ...prev };
            delete next[platformId];
            return next;
        });
        setPlatformImages(prev => {
            const next = { ...prev };
            delete next[platformId];
            return next;
        });
        if (activeTab === platformId) {
            handleTabSwitch('shared');
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
        if (selectedPlatforms.length === 0) return false;

        const isSharedValid = sharedContent.trim().length > 0;

        // If shared content is valid, we're good unless a specific selected platform has overridden it with empty content
        // (Wait, current UX implies shared is fallback. If shared is empty, ALL selected platforms must have custom content)

        if (isSharedValid) return true;

        // If shared is empty, check if ALL selected platforms have custom content
        const allCustomized = selectedPlatforms.every(id => {
            const content = platformContent[id] || '';
            return content.trim().length > 0;
        });

        return allCustomized;
    };

    const canSchedule = scheduleEnabled && scheduleDate && scheduleTime;

    const getValidationErrors = (): string[] => {
        const errors: string[] = [];

        if (isSubmitting) errors.push('Publishing in progress...');
        if (selectedPlatforms.length === 0) {
            errors.push('Select at least one platform');
            return errors;
        }

        if (!hasValidContent()) {
            errors.push('Content is required');
        }

        // Media validation
        const mediaError = validateMediaCount(selectedImages.length);
        if (mediaError) errors.push(mediaError);

        // Per-platform checks
        selectedPlatforms.forEach(platformId => {
            // Char limit
            const content = platformContent[platformId] !== undefined ? platformContent[platformId] : sharedContent;
            if (getCharStatus(content, platformId) === 'error') {
                const limit = getCharacterLimit(platformId);
                const platformName = PLATFORMS.find(p => p.id === platformId)?.name || platformId;
                errors.push(`${platformName} exceeds ${limit} chars`);
            }

            // Image requirements
            const customImages = platformImages[platformId];
            const effectiveImages = customImages !== undefined ? customImages : selectedImages;

            const imageError = getPlatformValidationError(platformId, effectiveImages);
            if (imageError) {
                errors.push(imageError);
            }
        });

        if (postMode === 'schedule') {
            if (scheduleEnabled && !canSchedule) errors.push('Select date and time');
        } else {
            if (!selectedLibraryId) errors.push('Select a library');
        }

        return errors;
    };

    const validationErrors = getValidationErrors();
    const isSaveDisabled = validationErrors.length > 0 || isSubmitting;

    // Helper to upload a list of files
    const uploadFiles = async (files: File[], context: string): Promise<MediaAttachment[]> => {
        if (files.length === 0) return [];

        const supabase = getSupabase();
        const uploaded: MediaAttachment[] = [];

        for (const file of files) {
            const fileExt = file.name.split('.').pop();
            const fileName = `${generateId()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('post-media')
                .upload(filePath, file);

            if (uploadError) {
                console.error(`[${context}] Error uploading file:`, uploadError);
                throw new Error(`Failed to upload ${file.name}`);
            }

            const { data: { publicUrl } } = supabase.storage
                .from('post-media')
                .getPublicUrl(filePath);

            const isVideo = file.type.startsWith('video/');
            console.log(`[${context}] Processed file:`, { name: file.name, type: file.type, isVideo });

            uploaded.push({
                id: generateId(),
                type: isVideo ? 'video' : 'image',
                url: publicUrl,
                altText: file.name,
            });
        }
        return uploaded;
    };

    const handleSubmit = async (targetStatus: 'draft' | 'scheduled' | 'published' = 'draft') => {
        // Run full validation before submitting
        const errors = getValidationErrors();
        if (errors.length > 0) {
            alert(`Please fix validation errors:\n${errors.join('\n')}`);
            return;
        }

        if (!hasValidContent()) return;

        setIsSubmitting(true);

        try {
            // 1. Upload Shared Images
            console.log('[Composer] ====== UPLOAD DEBUG START ======');
            console.log('[Composer] selectedImages count:', selectedImages.length);
            console.log('[Composer] selectedImages:', selectedImages.map(f => ({ name: f.name, size: f.size, type: f.type })));
            console.log('[Composer] Uploading shared media...');
            const uploadedSharedMedia = await uploadFiles(selectedImages, 'Shared');
            console.log('[Composer] Uploaded shared media:', JSON.stringify(uploadedSharedMedia));

            // 2. Upload Platform-Specific Images (if any)
            const updatedPlatformMetadata = { ...platformMetadata };

            for (const platformId of selectedPlatforms) {
                const customFiles = platformImages[platformId];
                if (customFiles && customFiles.length > 0) {
                    console.log(`[Composer] Uploading custom media for ${platformId}...`);
                    const uploadedCustomMedia = await uploadFiles(customFiles, platformId);

                    // Store in metadata
                    updatedPlatformMetadata[platformId] = {
                        ...updatedPlatformMetadata[platformId] || {},
                        media: uploadedCustomMedia
                    };
                }
            }

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

            console.log('[Composer] Creating post with media:', {
                mediaCount: uploadedSharedMedia.length,
                media: JSON.stringify(uploadedSharedMedia)
            });

            const post = await createPost({
                content: sharedContent,
                platforms: selectedPlatforms,
                status: initialStatus,
                scheduledAt,
                platformContent: platformContent as Record<PlatformId, string>,
                platformMetadata: updatedPlatformMetadata,
                media: uploadedSharedMedia,
                libraryId: postMode === 'library' ? selectedLibraryId : undefined,
            });
            console.log('[Composer] Post created, ID:', post.id);
            console.log('[Composer] ====== UPLOAD DEBUG END ======');

            if (targetStatus === 'published' && postMode !== 'library') {
                // Trigger immediate publish (only for schedule mode, not library mode)
                await publishPost(post.id);
            }

            invalidatePosts(); // Refresh posts cache for immediate display
            router.push('/');
            router.push('/');
        } catch (err: unknown) {
            console.error('Failed to create post:', err);
            const msg = err instanceof Error ? err.message : 'Failed to create post';
            alert(msg);
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

                {/* Platform Selection */}
                <PlatformSelector
                    platforms={connectedPlatforms}
                    selected={selectedPlatforms}
                    onToggle={togglePlatform}
                    getCharStatusForPlatform={(id) => getCharStatus(getContentForPlatform(id), id)}
                    isLoading={isLoading}
                    showAddMore={true}
                />
                <div className={styles.editorCard}>
                    {/* Tab Info Header */}
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
                                    </>
                                ) : (
                                    <p className={styles.tabDescription}>
                                        ✏️ Creating post for <strong>{PLATFORMS.find(p => p.id === activeTab)?.name}</strong>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Pinterest Board Selector - Show if tab is pinterest OR if pinterest is the only selected platform */}
                    {(activeTab === 'pinterest' || (selectedPlatforms.length === 1 && selectedPlatforms[0] === 'pinterest')) && (
                        <div className={styles.boardSelector}>
                            <span className={styles.boardIcon}>
                                {getPlatformIcon('pinterest', 24)}
                            </span>
                            <div className={styles.boardSelectWrapper}>
                                <label className={styles.boardLabel}>
                                    Select Board (Required)
                                </label>
                                <select
                                    className={styles.boardSelect}
                                    value={(platformMetadata.pinterest?.boardId as string) || ''}
                                    onChange={(e) => setPlatformMetadata(prev => ({
                                        ...prev,
                                        pinterest: { ...prev.pinterest, boardId: e.target.value }
                                    }))}
                                    disabled={isLoadingBoards}
                                >
                                    {isLoadingBoards ? (
                                        <option>Loading boards...</option>
                                    ) : pinterestBoards.length === 0 ? (
                                        <option value="">No boards found</option>
                                    ) : (
                                        pinterestBoards.map(board => (
                                            <option key={board.id} value={board.id}>
                                                {board.name} {board.privacy === 'SECRET' ? '🔒' : ''}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                        </div>
                    )}

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
                            <span>✨</span>
                            <span>Generate with AI</span>
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
                        files={getCurrentImages()}
                        onFilesChange={handleImagesChange}
                        maxMedia={getMaxMedia()}
                        disabled={isSubmitting}
                        sharedContent={sharedContent}
                    />

                    {/* Make Shared Button - Only show if platform images differ from shared */}
                    {activeTab !== 'shared' && platformImages[activeTab] && !areImageSetsEqual(selectedImages, platformImages[activeTab]!) && (
                        <div className="flex justify-end mt-2">
                            <button
                                className={styles.secondaryActionBtn}
                                onClick={handleMakeShared}
                                type="button"
                                title="Promote these images to be the Shared default for all platforms"
                                style={{ fontSize: '0.85rem', padding: '4px 8px' }}
                            >
                                <span></span>
                                Make Shared Images
                            </button>
                        </div>
                    )}

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
                            onClick={() => {
                                const hasUnsavedWork = sharedContent.trim() || selectedImages.length > 0 || Object.values(platformContent).some(c => c && c.trim());
                                if (hasUnsavedWork) {
                                    setShowCancelConfirmation(true);
                                    return;
                                }
                                router.push('/');
                            }}
                            type="button"
                            style={{ marginRight: 'auto', background: 'transparent', border: 'none', boxShadow: 'none' }}
                        >
                            Cancel
                        </button>
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
                            className={`${styles.primaryBtn}`}
                            onClick={() => handleSubmit(postMode === 'library' ? 'draft' : (scheduleEnabled ? 'scheduled' : 'published'))}
                            disabled={isSaveDisabled}
                            type="button"
                            title={isSaveDisabled ? 'Please fix validation errors' : undefined}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className={styles.spinner} />
                                    <span>{postMode === 'library' ? 'Adding...' : 'Publishing...'}</span>
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

                    {/* Validation Message Subtext */}
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
            </div>

            {/* Preview Section */}
            < div
                className={styles.previewSection}
                ref={previewSectionRef}
                onScroll={(e) => {
                    const target = e.target as HTMLDivElement;
                    const scrolledEnough = target.scrollTop > 100;
                    setIsScrolledToBottom(scrolledEnough);
                }
                }
            >
                <div className={styles.previewHeader}>
                    <span>👁️</span>
                    <span>Live Previews</span>
                </div>

                {
                    selectedPlatforms.length === 0 ? (
                        <div className={styles.emptyPreview}>
                            <span>📱</span>
                            <p>Select platforms to see previews</p>
                        </div>
                    ) : (
                        <>
                            {/* Sort platforms: validation errors first */}
                            {[...selectedPlatforms]
                                .sort((a, b) => {
                                    const aImages = platformImages[a] !== undefined ? platformImages[a] : selectedImages;
                                    const bImages = platformImages[b] !== undefined ? platformImages[b] : selectedImages;
                                    const aHasError = !!getPlatformValidationError(a, aImages.length) || getCharStatus(getContentForPlatform(a), a) === 'error';
                                    const bHasError = !!getPlatformValidationError(b, bImages.length) || getCharStatus(getContentForPlatform(b), b) === 'error';
                                    if (aHasError && !bHasError) return -1;
                                    if (!aHasError && bHasError) return 1;
                                    return 0;
                                })
                                .map((platformId) => {
                                    const content = getContentForPlatform(platformId);
                                    const isCustom = hasCustomContent(platformId);
                                    const username = connectedAccountsMap[platformId]?.username || 'Your Name';
                                    const handle = connectedAccountsMap[platformId]?.handle || (username.includes(' ') ? `@${username.toLowerCase().replace(/\s+/g, '')}` : `@${username}`);

                                    // Calculate effective image count for this platform
                                    const customImages = platformImages[platformId];
                                    const effectiveImages = customImages !== undefined ? customImages : selectedImages;

                                    // Run validation for this platform
                                    const validationError = getPlatformValidationError(platformId, effectiveImages);

                                    return (
                                        <React.Fragment key={platformId}>
                                            <PreviewCard
                                                platformId={platformId}
                                                content={content}
                                                username={username}
                                                handle={handle}
                                                isActive={activeTab === platformId}
                                                isCustom={isCustom}
                                                imageCount={effectiveImages.length}
                                                imagePreviews={imagePreviews}
                                                files={effectiveImages}
                                                validationError={validationError}
                                                onClick={() => initializePlatformContent(platformId)}
                                                onImageClick={(preview) => {
                                                    const idx = imagePreviews.findIndex(p => p.url === preview.url);
                                                    if (idx !== -1) setPreviewIndex(idx);
                                                }}
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
                    )
                }
            </div >
            {/* Full Screen Image Preview Modal */}
            <MediaCarouselModal
                isOpen={previewIndex >= 0}
                onClose={() => setPreviewIndex(-1)}
                mediaItems={imagePreviews}
                initialIndex={previewIndex}
            />
            {/* Confirmation Modal */}
            <ConfirmModal
                isOpen={showCancelConfirmation}
                title="Discard Post?"
                message="You have unsaved changes. Are you sure you want to discard this post?"
                confirmText="Discard"
                cancelText="Keep Editing"
                variant="danger"
                onConfirm={() => router.push('/')}
                onCancel={() => setShowCancelConfirmation(false)}
            />
        </div >
    );
}
