'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { MediaAttachment } from '@/types';
import styles from './Composer.module.css'; // We'll share the styles for now to avoid breaking CSS
import MediaCarouselModal from '@/components/ui/MediaCarouselModal';

interface MediaUploaderProps {
    files: File[];
    onFilesChange: (files: File[]) => void;
    maxMedia: number;
    disabled?: boolean;
    sharedContent?: string; // For default image prompt
    existingMedia?: MediaAttachment[];
    onRemoveExisting?: (mediaId: string) => void;
}

export default function MediaUploader({
    files,
    onFilesChange,
    maxMedia,
    disabled,
    sharedContent,
    existingMedia = [],
    onRemoveExisting
}: MediaUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);

    // AI Image Gen State (Local)
    const [showAIImagePanel, setShowAIImagePanel] = useState(false);
    const [aiImagePrompt, setAiImagePrompt] = useState('');
    const [originalAiImagePrompt, setOriginalAiImagePrompt] = useState<string | null>(null);
    const [isAiImagePromptOptimized, setIsAiImagePromptOptimized] = useState(false);
    const [isOptimizingAiImagePrompt, setIsOptimizingAiImagePrompt] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Preview Image State (for full screen)
    const [previewIndex, setPreviewIndex] = useState<number>(-1);

    // Sync previews with files
    useEffect(() => {
        const newPreviews = files.map(file => URL.createObjectURL(file));
        setImagePreviews(newPreviews);

        // Cleanup function
        return () => {
            newPreviews.forEach(url => URL.revokeObjectURL(url));
        };
    }, [files]);

    const handleFileSelect = (fileList: FileList | null) => {
        if (!fileList) return;

        const imageFiles = Array.from(fileList).filter(file =>
            file.type.startsWith('image/') || file.type.startsWith('video/')
        );

        if (imageFiles.length === 0) return;

        const currentCount = files.length + existingMedia.length;
        const newCount = currentCount + imageFiles.length;

        // Global hard limit check (10)
        if (newCount > 10) {
            alert(`Cannot upload more than 10 items total`);
            return;
        }

        onFilesChange([...files, ...imageFiles]);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (disabled) return;
        handleFileSelect(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (disabled) return;
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const removeImage = (index: number) => {
        const newFiles = files.filter((_, i) => i !== index);
        onFilesChange(newFiles);
    };

    // AI Handlers
    const handleOptimizeAiImagePrompt = async () => {
        if (!aiImagePrompt || isOptimizingAiImagePrompt) return;

        setIsOptimizingAiImagePrompt(true);
        try {
            const response = await fetch('/api/ai/optimize-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiImagePrompt })
            });

            if (!response.ok) throw new Error('Failed to optimize');

            const data = await response.json();
            setOriginalAiImagePrompt(aiImagePrompt);
            setAiImagePrompt(data.optimizedPrompt);
            setIsAiImagePromptOptimized(true);
        } catch (error) {
            console.error(error);
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

    const handleAIImageGenerate = async () => {
        const prompt = aiImagePrompt.trim() || (sharedContent || '').trim();
        if (!prompt) return;

        setIsGeneratingImage(true);
        setError(null);

        try {
            const response = await fetch('/api/ai/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) throw new Error('Failed to generate image');

            const data = await response.json();

            // Fetch image to create File object
            const imgRes = await fetch(data.imageUrl);
            const blob = await imgRes.blob();
            const file = new File([blob], "ai-generated.png", { type: "image/png" });

            onFilesChange([...files, file]);
            setShowAIImagePanel(false);
            setAiImagePrompt('');

        } catch (error: unknown) {
            console.error('Image generation failed', error);
            setError(error instanceof Error ? error.message : 'Failed to generate image');
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const totalMediaCount = existingMedia.length + files.length;

    // Combine all media for preview
    const allPreviews = [
        ...existingMedia.map(m => ({ url: m.url, type: m.type, alt: m.altText })),
        ...imagePreviews.map((url, i) => ({
            url,
            type: files[i]?.type?.startsWith('video/') ? 'video' : 'image',
            alt: files[i]?.name
        }))
    ];

    return (
        <>
            <div
                className={`${styles.mediaDropzone} ${isDragging ? styles.dragging : ''} ${totalMediaCount > 0 ? styles.hasImages : ''}`}
                onClick={() => !disabled && totalMediaCount === 0 && fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(e) => handleFileSelect(e.target.files)}
                    style={{ display: 'none' }}
                    disabled={disabled}
                />

                {totalMediaCount === 0 ? (
                    <>
                        <div className={styles.dropzoneContent}>
                            <span className={styles.dropzoneIcon}>📷</span>
                            <span className={styles.dropzoneText}>Click or drag media here</span>
                            <span className={styles.dropzoneHint}>Up to {maxMedia} items</span>
                        </div>

                        {/* Floating AI button */}
                        {!disabled && (
                            <button
                                type="button"
                                className={styles.floatingAIButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowAIImagePanel(!showAIImagePanel);
                                }}
                                title="Generate an image with AI"
                            >
                                <span>✨</span>
                                <span>Generate with AI</span>
                            </button>
                        )}

                        {/* AI Image Popover */}
                        {showAIImagePanel && (
                            <div
                                className={styles.aiPopoverFromButton}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* HEADER */}
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

                                {/* BODY */}
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

                                    {error && <div className={styles.errorText}>{error}</div>}

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
                        {/* Existing Media Previews */}
                        {existingMedia.map((media, idx) => (
                            <div key={media.id} className={styles.imagePreviewItem}>
                                {media.type === 'video' ? (
                                    <div
                                        className="relative w-full h-full cursor-pointer group"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewIndex(idx);
                                        }}
                                    >
                                        <video
                                            src={media.url}
                                            className={`${styles.mediaPreview} object-cover w-full h-full`}
                                            muted
                                            playsInline
                                            preload="metadata"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                                            <span className="text-white text-2xl drop-shadow-md">▶️</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="relative w-full h-full">
                                        <Image
                                            src={media.url}
                                            alt={media.altText || 'Existing media'}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewIndex(idx);
                                            }}
                                            fill
                                            className="object-cover"
                                            style={{ cursor: 'pointer' }}
                                            unoptimized
                                        />
                                    </div>
                                )}
                                <button
                                    type="button"
                                    className={styles.removeImageBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveExisting?.(media.id);
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}

                        {/* New File Previews */}
                        {imagePreviews.map((preview, index) => {
                            const isVideo = files[index]?.type.startsWith('video/');
                            // Calculate global index: existing count + current index
                            const globalIndex = existingMedia.length + index;

                            return (
                                <div key={`new-${index}`} className={styles.imagePreviewItem}>
                                    {isVideo ? (
                                        <div
                                            className="relative w-full h-full cursor-pointer group"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewIndex(globalIndex);
                                            }}
                                        >
                                            <video
                                                src={preview}
                                                className={`${styles.mediaPreview} object-cover w-full h-full`}
                                                muted
                                                playsInline
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                                                <span className="text-white text-2xl drop-shadow-md">▶️</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="relative w-full h-full">
                                            <Image
                                                src={preview}
                                                alt={`Preview ${index + 1}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setPreviewIndex(globalIndex);
                                                }}
                                                fill
                                                className="object-cover"
                                                style={{ cursor: 'pointer' }}
                                                unoptimized
                                            />
                                        </div>
                                    )}
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
                            );
                        })}

                        {totalMediaCount < 10 && (
                            <div className={styles.addMoreImages} onClick={() => !disabled && fileInputRef.current?.click()}>
                                <span>+</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Full Screen Preview */}
            <MediaCarouselModal
                isOpen={previewIndex >= 0}
                onClose={() => setPreviewIndex(-1)}
                mediaItems={allPreviews}
                initialIndex={previewIndex}
            />
        </>
    );
}
