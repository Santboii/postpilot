'use client';

import { PlatformId, Platform } from '@/types';
import { getPlatformIcon } from '@/components/ui/PlatformIcons';
import { CharStatus } from '@/hooks/usePlatformValidation';
import styles from './Composer.module.css';

interface PlatformSelectorProps {
    platforms: Platform[];
    selected: PlatformId[];
    onToggle: (id: PlatformId) => void;
    getCharStatusForPlatform?: (id: PlatformId) => CharStatus;
    disabled?: boolean;
    showAddMore?: boolean;
    isLoading?: boolean;
    allowedPlatforms?: PlatformId[] | null;
}

export default function PlatformSelector({
    platforms,
    selected,
    onToggle,
    getCharStatusForPlatform,
    disabled = false,
    showAddMore = true,
    isLoading = false,
    allowedPlatforms,
}: PlatformSelectorProps) {
    // Loading state
    if (isLoading) {
        return (
            <div className={styles.platformToggle}>
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className={styles.skeletonBtn} />
                ))}
            </div>
        );
    }

    // Empty state
    if (platforms.length === 0) {
        return (
            <div className={styles.noPlatforms}>
                <span>🔌</span>
                <p>No platforms connected yet.</p>
                <a href="/settings" className={styles.connectLink}>Connect a platform in Settings →</a>
            </div>
        );
    }

    return (
        <div className={styles.platformToggle}>
            {platforms.map(platform => {
                const isSelected = selected.includes(platform.id);
                const status = getCharStatusForPlatform?.(platform.id) || 'ok';
                const isDisabled = disabled || (allowedPlatforms && !allowedPlatforms.includes(platform.id));

                return (
                    <button
                        key={platform.id}
                        className={`${styles.platformBtn} ${isSelected ? styles.active : styles.inactive} ${isDisabled ? styles.disabled : ''}`}
                        onClick={() => onToggle(platform.id)}
                        type="button"
                        title={isDisabled ? 'Not available for this library' : (isSelected ? 'Click to deselect' : 'Click to select')}
                        disabled={!!isDisabled}
                        style={isDisabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                    >
                        <span style={{ color: isSelected ? platform.color : undefined }}>
                            {getPlatformIcon(platform.id, 18)}
                        </span>
                        <span>{platform.name}</span>
                        {status === 'error' && isSelected && (
                            <span className={styles.errorIndicator}>!</span>
                        )}
                    </button>
                );
            })}
            {showAddMore && (
                <a href="/settings" className={styles.addMoreLink} title="Connect more platforms">
                    <span>+</span>
                    <span>Add More</span>
                </a>
            )}
        </div>
    );
}
