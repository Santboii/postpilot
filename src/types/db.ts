import { PlatformId, PostStatus, MediaAttachment, LibraryAiSettings } from './app';

export interface Post {
    id: string;
    content: string;
    platforms: PlatformId[];
    status: PostStatus;
    scheduledAt?: string;
    publishedAt?: string;
    createdAt: string;
    updatedAt: string;
    media?: MediaAttachment[];
    platformContent?: Record<PlatformId, string>;
    platformMetadata?: Record<PlatformId, Record<string, unknown>>;
    // Evergreen / Recycling
    libraryId?: string;
    isEvergreen?: boolean;
    lastPublishedAt?: string;
}

export interface ContentLibrary {
    id: string;
    user_id: string;
    name: string;
    color: string;
    is_paused: boolean;
    auto_remix: boolean;
    generate_images?: boolean;
    topic_prompt?: string;
    template_type?: string;
    ai_settings?: LibraryAiSettings;
    platforms?: PlatformId[];
    created_at: string;
    post_count?: number;
}

export interface WeeklySlot {
    id: string;
    user_id: string;
    library_id: string;
    day_of_week: number; // 0-6
    time_of_day: string; // "09:00:00"
    platform_ids: PlatformId[];
    created_at?: string;
}

// User/Settings types
export interface UserSettings {
    theme: 'light' | 'dark' | 'system';
    defaultPlatforms: PlatformId[];
    timezone: string;
}

export interface BrandProfile {
    id: string;
    user_id: string;
    brand_name: string;
    audience: string;
    tone: string;
    examples: string[];
    created_at: string;
    updated_at: string;
}

// Stripe / Billing Types
export type PricingType = 'one_time' | 'recurring';
export type PricingPlanInterval = 'day' | 'week' | 'month' | 'year';
export type SubscriptionStatus = 'trialing' | 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'unpaid' | 'paused';

export interface Product {
    id: string;
    active: boolean;
    name: string;
    description?: string;
    image?: string;
    metadata?: Record<string, string>;
}

export interface Price {
    id: string;
    product_id: string;
    active: boolean;
    description?: string;
    unit_amount: number;
    currency: string;
    type: PricingType;
    interval?: PricingPlanInterval;
    interval_count?: number;
    trial_period_days?: number;
    metadata?: Record<string, string>;
    products?: Product; // Joined view
}

export interface Subscription {
    id: string;
    user_id: string;
    status: SubscriptionStatus;
    metadata?: Record<string, string>;
    price_id: string;
    quantity: number;
    cancel_at_period_end: boolean;
    created: string;
    current_period_start: string;
    current_period_end: string;
    ended_at?: string;
    cancel_at?: string;
    canceled_at?: string;
    trial_start?: string;
    trial_end?: string;
    prices?: Price; // Joined view
}

export interface Customer {
    id: string;
    stripe_customer_id: string;
}
