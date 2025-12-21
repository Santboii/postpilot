'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlatformId, PLATFORMS, getCharacterLimit, Platform, MediaAttachment, generateId } from '@/types';
import { createPost } from '@/lib/db';
import { getSupabase } from '@/lib/supabase';
import styles from './Composer.module.css';

type ContentMode = 'shared' | PlatformId;

export default function PostComposer() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [connectedPlatformIds, setConnectedPlatformIds] = useState<PlatformId[]>([]);
    const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // AI Composers State
    const [showAIPanel, setShowAIPanel] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [originalAiTopic, setOriginalAiTopic] = useState<string | null>(null);
    const [isAiTopicOptimized, setIsAiTopicOptimized] = useState(false);
    const [isOptimizingAiTopic, setIsOptimizingAiTopic] = useState(false);
    const [aiIncludeImage, setAiIncludeImage] = useState(false);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);

    // Platform Optimization State
    const [isOptimizing, setIsOptimizing] = useState(false);

    // AI Image Generation State
    const [showAIImagePanel, setShowAIImagePanel] = useState(false);
    const [aiImagePrompt, setAiImagePrompt] = useState('');
    const [originalAiImagePrompt, setOriginalAiImagePrompt] = useState<string | null>(null);
    const [isAiImagePromptOptimized, setIsAiImagePromptOptimized] = useState(false);
    const [isOptimizingAiImagePrompt, setIsOptimizingAiImagePrompt] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);

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

    // Image upload
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);

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
                        setImagePreviews(prev => [...prev, url]);
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
                .select('platform');

            const connected = (data || []).map(d => d.platform as PlatformId);
            setConnectedPlatformIds(connected);

            // Auto-select all connected platforms by default
            const initialSelection = [...connected];

            // If URL param specified a platform, ensure it's selected (if connected)
            const paramPlatform = searchParams.get('platform') as PlatformId | null;
            if (paramPlatform && connected.includes(paramPlatform)) {
                // Nothing special needed as we select all, but we could focus it
            }

            setSelectedPlatforms(initialSelection);

            // If only one platform, set it as active tab instead of 'shared'
            if (initialSelection.length === 1) {
                setActiveTab(initialSelection[0]);
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

    // AI Generation Handler
    const handleAIGenerate = async () => {
        if (!aiTopic) return;

        setIsGeneratingAI(true);
        setError(null);

        try {
            // Determine platform context: if specific tab, use that; else use first selected or twitter default
            const targetPlatform = activeTab !== 'shared' ? activeTab : (selectedPlatforms[0] || 'twitter');

            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: aiTopic,
                    platform: targetPlatform,
                    includeImage: aiIncludeImage
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to generate');
            }

            const data = await response.json();

            // Update content
            handleContentChange(data.post.content);

            // Handle Image
            if (data.imageUrl) {
                const imgRes = await fetch(data.imageUrl);
                const blob = await imgRes.blob();
                const file = new File([blob], "ai-generated.png", { type: "image/png" });

                // Add to images
                const max = getMaxMedia();
                if (selectedImages.length < max) {
                    setSelectedImages(prev => [...prev, file]);
                    setImagePreviews(prev => [...prev, data.imageUrl]); // data.imageUrl is a public URL usually, or base64? 
                    // Note: If using blob from internal AI route, make sure it's accessible. 
                    // If the AI route returns a remote URL, we can use it directly in preview, 
                    // but we fetched it to blob to unify 'File' handling.
                    // For preview consistency, create object URL from the blob we just fetched
                    const objectUrl = URL.createObjectURL(blob);
                    // Replace the remote URL in previews with local object URL to be safe
                    setImagePreviews(prev => {
                        const newPreviews = [...prev];
                        newPreviews[newPreviews.length - 1] = objectUrl;
                        return newPreviews;
                    });
                }
            }

            // Close AI panel or indicate success?
            // Let's keep it open but maybe show a visual cue or just the result in the editor is enough.
            // Collapsing panel for better UX
            setShowAIPanel(false);
            setAiTopic(''); // Clear topic or keep it? Keeping it allows refinement if we didn't close.
            // Since we close, clearing might be annoying if they want to re-open and edit.
            // Let's keep topic state but clear it only on manual clear.

        } catch (error: any) {
            console.error('Generation failed', error);
            setError(error.message || 'Failed to generate post.');
        } finally {
            setIsGeneratingAI(false);
        }
    };

    // AI Topic Prompt Optimization Handler
    const handleOptimizeAiTopic = async () => {
        if (!aiTopic || isOptimizingAiTopic) return;

        setIsOptimizingAiTopic(true);
        try {
            const targetPlatform = activeTab !== 'shared' ? activeTab : (selectedPlatforms[0] || 'twitter');
            const response = await fetch('/api/ai/optimize-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiTopic, platform: targetPlatform })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to optimize');
            }

            const data = await response.json();
            setOriginalAiTopic(aiTopic);
            setAiTopic(data.optimizedPrompt);
            setIsAiTopicOptimized(true);
        } catch (error: any) {
            console.error('Topic optimization failed', error);
            setError(error.message || 'Failed to optimize prompt');
        } finally {
            setIsOptimizingAiTopic(false);
        }
    };

    const handleRevertAiTopic = () => {
        if (originalAiTopic) {
            setAiTopic(originalAiTopic);
            setOriginalAiTopic(null);
            setIsAiTopicOptimized(false);
        }
    };

    // AI Image Prompt Optimization Handler
    const handleOptimizeAiImagePrompt = async () => {
        if (!aiImagePrompt || isOptimizingAiImagePrompt) return;

        setIsOptimizingAiImagePrompt(true);
        try {
            const response = await fetch('/api/ai/optimize-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiImagePrompt })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to optimize');
            }

            const data = await response.json();
            setOriginalAiImagePrompt(aiImagePrompt);
            setAiImagePrompt(data.optimizedPrompt);
            setIsAiImagePromptOptimized(true);
        } catch (error: any) {
            console.error('Image prompt optimization failed', error);
            setError(error.message || 'Failed to optimize prompt');
        } finally {
            setIsOptimizingAiImagePrompt(false);
        }
    };

    const handleRevertAiImagePrompt = () => {
        if (originalAiImagePrompt) {
            setAiImagePrompt(originalAiImagePrompt);
            setOriginalAiImagePrompt(null);
            setIsAiImagePromptOptimized(false);
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

    // AI Image Generation Handler
    const handleAIImageGenerate = async () => {
        const prompt = aiImagePrompt.trim() || sharedContent.trim();
        if (!prompt) {
            setError('Enter an image prompt or write some post content first');
            return;
        }

        setIsGeneratingImage(true);
        setError(null);

        try {
            const response = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to generate image');
            }

            const data = await response.json();

            // Fetch the image and add it
            const imgRes = await fetch(data.imageUrl);
            const blob = await imgRes.blob();
            const file = new File([blob], "ai-generated.png", { type: "image/png" });

            const max = getMaxMedia();
            if (selectedImages.length < max) {
                setSelectedImages(prev => [...prev, file]);
                const objectUrl = URL.createObjectURL(blob);
                setImagePreviews(prev => [...prev, objectUrl]);
            }

            setShowAIImagePanel(false);
            setAiImagePrompt('');
        } catch (error: any) {
            console.error('Image generation failed', error);
            setError(error.message || 'Failed to generate image.');
        } finally {
            setIsGeneratingImage(false);
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

    // Image upload handlers
    const handleFileSelect = (files: FileList | null) => {
        if (!files) return;

        const imageFiles = Array.from(files).filter(file =>
            file.type.startsWith('image/')
        );

        if (imageFiles.length === 0) return;

        const max = getMaxMedia();
        const currentCount = selectedImages.length;
        const newCount = currentCount + imageFiles.length;

        // If trying to add more than allowed global max (10 for FB/Insta)
        if (newCount > 10) {
            setError(`Cannot upload more than 10 images total`);
            return;
        }

        // Warning if exceeding platform limits
        if (newCount > max) {
            setError(`Note: Some selected platforms only support ${max} images`);
        } else {
            setError(null);
        }

        const newImages = [...selectedImages, ...imageFiles];
        setSelectedImages(newImages);

        // Generate previews
        const newPreviews = newImages.map(file => URL.createObjectURL(file));
        // Clean up old previews
        imagePreviews.forEach(url => URL.revokeObjectURL(url));
        setImagePreviews(newPreviews);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const removeImage = (index: number) => {
        URL.revokeObjectURL(imagePreviews[index]);
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
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

    const getDisabledReason = (): string | undefined => {
        if (isSubmitting) return 'Publishing in progress...';
        if (!sharedContent.trim()) return 'Shared content is required';
        if (selectedPlatforms.length === 0) return 'Select at least one platform';

        // Media validation
        const mediaError = validateMediaCount(selectedImages.length);
        if (mediaError) return mediaError;

        if (hasAnyError()) return 'Fix character limit errors first';
        if (scheduleEnabled && !canSchedule) return 'Select date and time';
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

    const handleSubmit = async (status: 'draft' | 'scheduled' = 'draft') => {
        if (!hasValidContent()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            // Upload images first
            const uploadedMedia = await uploadImages();

            const scheduledAt = status === 'scheduled' ? getScheduledDateTime() : undefined;
            await createPost({
                content: sharedContent,
                platforms: selectedPlatforms,
                status,
                scheduledAt,
                platformContent,
                media: uploadedMedia,
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
                                    <span style={{ color: isSelected ? platform.color : undefined }}>{platform.icon}</span>
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
                                setShowAIImagePanel(false);
                            }}
                            title="Magic Compose with AI"
                        >
                            ✨
                        </button>

                        {/* AI Popover - emerges from button */}
                        {showAIPanel && (
                            <div
                                className={styles.aiPopoverFromButton}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className={styles.aiPopoverHeader}>
                                    <h3 className={styles.aiPopoverTitle}>
                                        <span>✨</span> AI Text
                                    </h3>
                                    <button
                                        onClick={() => setShowAIPanel(false)}
                                        className={styles.aiPopoverClose}
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className={styles.aiPopoverBody}>
                                    <div>
                                        <label className={styles.aiPopoverLabel}>
                                            What would you like to post about?
                                        </label>
                                        <textarea
                                            value={aiTopic}
                                            onChange={(e) => {
                                                setAiTopic(e.target.value);
                                                if (isAiTopicOptimized) {
                                                    setIsAiTopicOptimized(false);
                                                    setOriginalAiTopic(null);
                                                }
                                            }}
                                            className={`${styles.aiPopoverTextarea} ${isAiTopicOptimized ? styles.optimizedTextarea : ''}`}
                                            placeholder="e.g., Announcing our summer collection..."
                                            autoFocus
                                        />
                                        <div className={styles.optimizeRow}>
                                            <button
                                                onClick={handleOptimizeAiTopic}
                                                disabled={!aiTopic || isOptimizingAiTopic || isAiTopicOptimized}
                                                className={styles.optimizeBtnSecondary}
                                                type="button"
                                            >
                                                {isOptimizingAiTopic ? (
                                                    <>
                                                        <span className={styles.spinner} />
                                                        <span>Optimizing...</span>
                                                    </>
                                                ) : isAiTopicOptimized ? (
                                                    <>
                                                        <span>✨</span>
                                                        <span>Prompt optimized</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>✨</span>
                                                        <span>Optimize Prompt</span>
                                                    </>
                                                )}
                                            </button>
                                            {isAiTopicOptimized && originalAiTopic && (
                                                <button
                                                    onClick={handleRevertAiTopic}
                                                    className={styles.revertBtn}
                                                    type="button"
                                                >
                                                    ↩ Revert
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className={styles.aiPopoverActions}>
                                        <label className={styles.aiPopoverCheckbox}>
                                            <input
                                                type="checkbox"
                                                checked={aiIncludeImage}
                                                onChange={(e) => setAiIncludeImage(e.target.checked)}
                                            />
                                            <span>Generate Image</span>
                                        </label>

                                        <button
                                            onClick={handleAIGenerate}
                                            disabled={isGeneratingAI || !aiTopic}
                                            className={styles.aiPopoverSubmit}
                                        >
                                            {isGeneratingAI ? (
                                                <>
                                                    <span className={styles.spinner} />
                                                    <span>Generating...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>✨</span>
                                                    <span>Generate</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
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
                    <div
                        className={`${styles.mediaDropzone} ${isDragging ? styles.dragging : ''} ${selectedImages.length > 0 ? styles.hasImages : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => handleFileSelect(e.target.files)}
                            style={{ display: 'none' }}
                        />

                        {selectedImages.length === 0 ? (
                            <>
                                <div className={styles.dropzoneContent}>
                                    <span className={styles.dropzoneIcon}>📷</span>
                                    <span className={styles.dropzoneText}>Click or drag images here</span>
                                    <span className={styles.dropzoneHint}>Up to 4 images</span>
                                </div>

                                {/* Floating AI button in corner - same pattern as textarea */}
                                <button
                                    type="button"
                                    className={styles.floatingAIButton}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowAIImagePanel(!showAIImagePanel);
                                        setShowAIPanel(false);
                                    }}
                                    title="Generate an image with AI"
                                >
                                    ✨
                                </button>

                                {/* AI Image Popover - emerges from button */}
                                {showAIImagePanel && (
                                    <div
                                        className={styles.aiPopoverFromButton}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className={styles.aiPopoverHeader}>
                                            <h3 className={styles.aiPopoverTitle}>
                                                <span>🖼️</span> AI Image
                                            </h3>
                                            <button
                                                onClick={() => setShowAIImagePanel(false)}
                                                className={styles.aiPopoverClose}
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        <div className={styles.aiPopoverBody}>
                                            <div>
                                                <label className={styles.aiPopoverLabel}>
                                                    Describe your image
                                                </label>
                                                <textarea
                                                    value={aiImagePrompt}
                                                    onChange={(e) => {
                                                        setAiImagePrompt(e.target.value);
                                                        if (isAiImagePromptOptimized) {
                                                            setIsAiImagePromptOptimized(false);
                                                            setOriginalAiImagePrompt(null);
                                                        }
                                                    }}
                                                    className={`${styles.aiPopoverTextarea} ${isAiImagePromptOptimized ? styles.optimizedTextarea : ''}`}
                                                    placeholder={sharedContent ? "Leave blank to use post content" : "A vibrant photo of..."}
                                                    autoFocus
                                                />
                                                <div className={styles.optimizeRow}>
                                                    <button
                                                        onClick={handleOptimizeAiImagePrompt}
                                                        disabled={!aiImagePrompt || isOptimizingAiImagePrompt || isAiImagePromptOptimized}
                                                        className={styles.optimizeBtnSecondary}
                                                        type="button"
                                                    >
                                                        {isOptimizingAiImagePrompt ? (
                                                            <>
                                                                <span className={styles.spinner} />
                                                                <span>Optimizing...</span>
                                                            </>
                                                        ) : isAiImagePromptOptimized ? (
                                                            <>
                                                                <span>✨</span>
                                                                <span>Prompt optimized</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span>✨</span>
                                                                <span>Optimize Prompt</span>
                                                            </>
                                                        )}
                                                    </button>
                                                    {isAiImagePromptOptimized && originalAiImagePrompt && (
                                                        <button
                                                            onClick={handleRevertAiImagePrompt}
                                                            className={styles.revertBtn}
                                                            type="button"
                                                        >
                                                            ↩ Revert
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleAIImageGenerate}
                                                disabled={isGeneratingImage}
                                                className={styles.aiPopoverSubmit}
                                                style={{ width: '100%' }}
                                            >
                                                {isGeneratingImage ? (
                                                    <>
                                                        <span className={styles.spinner} />
                                                        <span>Generating...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span>🖼️</span>
                                                        <span>Generate Image</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className={styles.imagePreviewGrid}>
                                {imagePreviews.map((preview, index) => (
                                    <div key={index} className={styles.imagePreviewItem}>
                                        <img src={preview} alt={`Preview ${index + 1}`} />
                                        <button
                                            type="button"
                                            className={styles.removeImageBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeImage(index);
                                            }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                {selectedImages.length < 4 && (
                                    <div className={styles.addMoreImages}>
                                        <span>+</span>
                                    </div>
                                )}
                            </div>
                        )}
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
                            onClick={() => handleSubmit('scheduled')}
                            disabled={!!disabledReason}
                            type="button"
                            title={disabledReason}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className={styles.spinner} />
                                    <span>Publishing...</span>
                                </>
                            ) : hasAnyError() ? (
                                <>
                                    <span className={styles.btnIcon}>⚠️</span>
                                    <span>Fix Errors</span>
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

                                {imagePreviews.length > 0 && (
                                    <div className={styles.previewImages}>
                                        {imagePreviews.map((preview, index) => (
                                            <img
                                                key={index}
                                                src={preview}
                                                alt={`Attachment ${index + 1}`}
                                                className={styles.previewImageThumb}
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
        </div>
    );
}
