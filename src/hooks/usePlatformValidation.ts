import { PlatformId, getCharacterLimit, PLATFORMS } from '@/types';

/**
 * Character status for a given content length vs platform limit
 */
export type CharStatus = 'ok' | 'warning' | 'error';

/**
 * Get character count status for a platform
 */
export function getCharStatus(content: string, platformId: PlatformId): CharStatus {
    const limit = getCharacterLimit(platformId);
    if (!limit) return 'ok';
    const remaining = limit - content.length;
    if (remaining < 0) return 'error';
    if (remaining < 20) return 'warning';
    return 'ok';
}

/**
 * Check if any platform has a character limit error
 */
export function hasAnyCharError(
    selectedPlatforms: PlatformId[],
    getContentForPlatform: (platformId: PlatformId) => string
): boolean {
    return selectedPlatforms.some(id => {
        const content = getContentForPlatform(id);
        return getCharStatus(content, id) === 'error';
    });
}

/**
 * Platforms that require images
 */
const PLATFORMS_REQUIRING_IMAGES: PlatformId[] = ['instagram', 'pinterest'];

/**
 * Check if a platform has a validation error (e.g., missing required image)
 */
export function getPlatformValidationError(
    platformId: PlatformId,
    imageCount: number
): string | null {
    if (PLATFORMS_REQUIRING_IMAGES.includes(platformId) && imageCount === 0) {
        const platform = PLATFORMS.find(p => p.id === platformId);
        return `${platform?.name || platformId} requires an image`;
    }
    return null;
}

/**
 * Check if any selected platform has a validation error
 */
export function getFirstPlatformError(
    selectedPlatforms: PlatformId[],
    imageCount: number
): string | null {
    for (const platformId of selectedPlatforms) {
        const error = getPlatformValidationError(platformId, imageCount);
        if (error) return error;
    }
    return null;
}
