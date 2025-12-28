// Platform types
export type PlatformId = 'twitter' | 'instagram' | 'linkedin' | 'facebook' | 'threads';

export interface Platform {
    id: PlatformId;
    name: string;
    icon: string;
    color: string;
    maxLength?: number;
    maxMedia?: number;
    supportsImages: boolean;
    supportsVideo: boolean;
    connected: boolean;
    username?: string;
}

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';

export interface MediaAttachment {
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
    altText?: string;
}

// Stats types
export interface DashboardStats {
    postsThisWeek: number;
    scheduledPosts: number;
    drafts: number;
    publishedThisMonth: number;
}

// Activity types
export interface Activity {
    id: string;
    type: 'published' | 'scheduled' | 'drafted' | 'failed';
    message: string;
    timestamp: string;
    postId?: string;
}

// AI Suggestion types
export type SuggestionStatus = 'pending' | 'approved' | 'rejected';
export type ToneType = 'casual' | 'professional' | 'promotional';

export interface PlatformVariant {
    platformId: PlatformId;
    content: string;
    hashtags?: string[];
}

export interface Suggestion {
    id: string;
    topic: string;
    tone: ToneType;
    sourceUrl?: string;
    variants: PlatformVariant[];
    status: SuggestionStatus;
    createdAt: string;
}

// Platform configs
export const PLATFORMS: Platform[] = [
    {
        id: 'twitter',
        name: 'X',
        icon: '𝕏',
        color: '#000000',
        maxLength: 280,
        maxMedia: 4,
        supportsImages: true,
        supportsVideo: true,
        connected: false,
    },
    {
        id: 'instagram',
        name: 'Instagram',
        icon: '◐',
        color: '#E1306C',
        maxMedia: 10,
        supportsImages: true,
        supportsVideo: true,
        connected: false,
    },
    {
        id: 'linkedin',
        name: 'LinkedIn',
        icon: 'in',
        color: '#0a66c2',
        maxLength: 3000,
        maxMedia: 9,
        supportsImages: true,
        supportsVideo: true,
        connected: false,
    },
    {
        id: 'facebook',
        name: 'Facebook',
        icon: 'f',
        color: '#1877f2',
        maxLength: 63206,
        maxMedia: 10,
        supportsImages: true,
        supportsVideo: true,
        connected: false,
    },
    {
        id: 'threads',
        name: 'Threads',
        icon: '@',
        color: '#000000',
        maxLength: 500,
        maxMedia: 10,
        supportsImages: true,
        supportsVideo: true,
        connected: false,
    },
];

// Helper to get platform by ID
export function getPlatform(id: PlatformId): Platform | undefined {
    return PLATFORMS.find(p => p.id === id);
}

// Helper to generate unique IDs
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Character limit helpers
export function getCharacterLimit(platformId: PlatformId): number | undefined {
    return getPlatform(platformId)?.maxLength;
}

export function isOverLimit(content: string, platformId: PlatformId): boolean {
    const limit = getCharacterLimit(platformId);
    return limit !== undefined && content.length > limit;
}

// Library Template types
export type LibraryTemplateType = 'tips' | 'facts' | 'quotes' | 'promos' | 'custom';

export interface LibraryTemplate {
    id: LibraryTemplateType;
    name: string;
    icon: string;
    promptPrefix: string;
    description: string;
    color: string;
}

export const LIBRARY_TEMPLATES: LibraryTemplate[] = [
    {
        id: 'tips',
        name: 'Tips & How-tos',
        icon: '💡',
        promptPrefix: 'Actionable tips and tutorials about',
        description: 'Share practical advice and step-by-step guides',
        color: '#f59e0b',
    },
    {
        id: 'facts',
        name: 'Fun Facts',
        icon: '📊',
        promptPrefix: 'Interesting and shareable facts about',
        description: 'Engage with surprising information and trivia',
        color: '#3b82f6',
    },
    {
        id: 'quotes',
        name: 'Quotes',
        icon: '💬',
        promptPrefix: 'Inspirational or thought-provoking quotes about',
        description: 'Motivate your audience with powerful words',
        color: '#8b5cf6',
    },
    {
        id: 'promos',
        name: 'Promos',
        icon: '🎯',
        promptPrefix: 'Product highlights and promotional content for',
        description: 'Showcase your offerings and drive action',
        color: '#ef4444',
    },
];
