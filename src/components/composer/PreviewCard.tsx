'use client';

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
    imagePreviews?: string[];
    onClick: () => void;
    onImageClick?: (preview: string) => void;
}

// Helper to get platform-specific avatar class
const getAvatarClass = (pid: string): string => {
    switch (pid) {
        case 'twitter': return styles.previewAvatarTwitter;
        case 'facebook': return styles.previewAvatarFacebook;
        case 'linkedin': return styles.previewAvatarLinkedin;
        case 'instagram': return styles.previewAvatarInstagram;
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
    onClick,
    onImageClick,
}: PreviewCardProps) {
    const platform = PLATFORMS.find(p => p.id === platformId)!;
    const limit = getCharacterLimit(platformId);
    const remaining = limit ? limit - content.length : null;
    const charStatus: CharStatus = getCharStatus(content, platformId);
    const validationError = getPlatformValidationError(platformId, imageCount);
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
                                onImageClick?.(preview);
                            }}
                            style={{ cursor: onImageClick ? 'pointer' : undefined }}
                        />
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
