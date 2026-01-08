'use client';

import React from 'react';
import Image from 'next/image';
import { PlatformId, PLATFORMS, getCharacterLimit } from '@/types';
import { getPlatformIcon } from '@/components/ui/PlatformIcons';
import { getCharStatus, getPlatformValidationError, CharStatus } from '@/hooks/usePlatformValidation';
import styles from './Composer.module.css';

interface PreviewCardProps {
    platformId: PlatformId;
    content: string;
    username: string;
    handle: string;
    isActive: boolean;
    isCustom: boolean;
    imageCount: number;
    imagePreviews?: { url: string; type: string }[];
    files?: File[];
    validationError?: string | null;
    onClick: () => void;
    onImageClick?: (preview: { url: string; type: string }) => void;
}

// Helper to get platform-specific avatar class
const getAvatarClass = (pid: string): string => {
    switch (pid) {
        case 'twitter': return styles.previewAvatarTwitter;
        case 'facebook': return styles.previewAvatarFacebook;
        case 'linkedin': return styles.previewAvatarLinkedin;
        case 'instagram': return styles.previewAvatarInstagram;
        case 'tiktok': return styles.previewAvatarTiktok;
        case 'pinterest': return styles.previewAvatarPinterest;
        default: return '';
    }
};

export default function PreviewCard({
    platformId,
    content,
    username,
    handle,
    isActive,
    isCustom,
    imageCount,
    imagePreviews = [],
    files = [],
    validationError,
    onClick,
    onImageClick,
}: PreviewCardProps) {
    // Generate previews from files if provided and no explicit previews
    // This allows passing raw Files directly
    const [generatedPreviews, setGeneratedPreviews] = React.useState<{ url: string; type: string }[]>([]);

    // Stable reference for files array length to prevent infinite loops
    const filesLength = files?.length ?? 0;

    React.useEffect(() => {
        if (!files || files.length === 0) {
            if (generatedPreviews.length > 0) {
                setGeneratedPreviews([]);
            }
            return;
        }

        const newPreviews = files.map(file => ({
            url: URL.createObjectURL(file),
            type: file.type
        }));
        setGeneratedPreviews(newPreviews);

        return () => {
            newPreviews.forEach(p => URL.revokeObjectURL(p.url));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filesLength]);

    const activePreviews = imagePreviews.length > 0 ? imagePreviews : generatedPreviews;

    const platform = PLATFORMS.find(p => p.id === platformId)!;
    const limit = getCharacterLimit(platformId);
    const remaining = limit ? limit - content.length : null;
    const charStatus: CharStatus = getCharStatus(content, platformId);

    const hasError = charStatus === 'error' || !!validationError;

    return (
        <div
            className={`${styles.previewCard} ${isActive ? styles.previewCardActive : ''} ${isCustom ? styles.previewCardCustom : ''} ${hasError ? styles.previewError : ''}`}
            onClick={onClick}
        >
            <div className={styles.previewPlatformHeader}>
                <div className={styles.previewUser}>
                    <div className={`${styles.previewAvatar} ${getAvatarClass(platformId)}`}>
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

            {activePreviews.length > 0 && (
                <div className={styles.previewImages}>
                    {activePreviews.map((preview, index) => (
                        <div key={index} className="relative w-12 h-12">
                            {preview.type.startsWith('video/') ? (
                                <video
                                    src={preview.url}
                                    className={`${styles.previewImageThumb} object-cover w-full h-full rounded`}
                                    style={{ cursor: onImageClick ? 'pointer' : undefined }}
                                    muted
                                    preload="metadata"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onImageClick?.(preview); // Pass full object
                                    }}
                                >
                                    {/* Fallback */}
                                </video>
                            ) : (
                                <Image
                                    src={preview.url}
                                    alt={`Attachment ${index + 1}`}
                                    className={styles.previewImageThumb}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onImageClick?.(preview);
                                    }}
                                    width={48}
                                    height={48}
                                    unoptimized
                                    style={{ cursor: onImageClick ? 'pointer' : undefined, objectFit: 'cover' }}
                                />
                            )}
                            {preview.type.startsWith('video/') && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-white drop-shadow-md text-xs">▶️</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Validation warning banner */}
            {validationError && (
                <div className={styles.validationWarning}>
                    <span>⚠️</span>
                    <span>{validationError}</span>
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
}
