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
/**
 * Platforms that require media (image or video)
 */
const PLATFORMS_REQUIRING_MEDIA: PlatformId[] = ['instagram', 'pinterest', 'tiktok'];

/**
 * Check if a platform has a validation error (e.g., missing required image, mixed media)
 */
export function getPlatformValidationError(
    platformId: PlatformId,
    files: File[] | number
): string | null {
    const count = typeof files === 'number' ? files : files.length;

    // 1. Basic Requirement Check
    if (PLATFORMS_REQUIRING_MEDIA.includes(platformId) && count === 0) {
        const platform = PLATFORMS.find(p => p.id === platformId);
        return `${platform?.name || platformId} requires media (image/video)`;
    }

    // 2. TikTok Specific Validation
    if (platformId === 'tiktok' && Array.isArray(files)) {
        const videos = files.filter(f => f.type.startsWith('video/'));
        const images = files.filter(f => f.type.startsWith('image/'));

        console.log('[TikTok Validation]', { count, videoCount: videos.length, imageCount: images.length, types: files.map(f => f.type) });

        // Rule: Video Required (Photo Mode not yet supported by backend)
        // [FIXED] Photo Mode backend support added. 
        // if (videos.length === 0) { ... }

        // Rule: No Mixed Media
        if (videos.length > 0 && images.length > 0) {
            return "TikTok does not support mixed media (video + images)";
        }

        // Rule: Single Video Limit
        if (videos.length > 1) {
            return "TikTok only supports one video per post";
        }
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
        // Note: This helper only checks count-based errors for now
        // Detailed validation happens in PostComposer
        const error = getPlatformValidationError(platformId, imageCount);
        if (error) return error;
    }
    return null;
}
