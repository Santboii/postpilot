/**
 * PostPilot Database Layer
 * 
 * This module provides type-safe access to the Supabase database.
 * All functions are async and handle errors gracefully.
 * 
 * Design Principles:
 * - Fail silently with empty arrays/null for reads (graceful degradation)
 * - Throw errors for writes so caller can show user feedback
 * - Always validate user authentication before operations
 */

'use client';

import { getSupabase } from './supabase';
import type { Post, PlatformId, Activity } from '@/types';

// ============================================
// Error Types
// ============================================

export class DatabaseError extends Error {
    constructor(message: string, public readonly code?: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

export class AuthenticationError extends DatabaseError {
    constructor() {
        super('User not authenticated', 'AUTH_REQUIRED');
        this.name = 'AuthenticationError';
    }
}

// ============================================
// Helper Functions
// ============================================

async function getCurrentUserId(): Promise<string> {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        throw new AuthenticationError();
    }
    return user.id;
}

async function getCurrentUserIdOrNull(): Promise<string | null> {
    try {
        return await getCurrentUserId();
    } catch {
        return null;
    }
}

interface DbPost {
    id: string;
    user_id: string;
    content: string;
    status: 'draft' | 'scheduled' | 'published' | 'failed';
    scheduled_at: string | null;
    published_at: string | null;
    created_at: string;
    updated_at: string;
}

interface DbPostPlatform {
    id: string;
    post_id: string;
    platform: string;
    custom_content: string | null;
    created_at: string;
}

interface DbActivity {
    id: string;
    user_id: string;
    type: string;
    message: string;
    post_id: string | null;
    created_at: string;
}

function dbToPost(row: DbPost, platforms: DbPostPlatform[]): Post {
    return {
        id: row.id,
        content: row.content,
        platforms: platforms.map(p => p.platform as PlatformId),
        status: row.status,
        scheduledAt: row.scheduled_at ?? undefined,
        publishedAt: row.published_at ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ============================================
// Posts - Read Operations
// ============================================

/**
 * Get all posts for the current user
 */
export async function getPosts(): Promise<Post[]> {
    const userId = await getCurrentUserIdOrNull();
    if (!userId) return [];

    const supabase = getSupabase();

    const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error || !posts || posts.length === 0) return [];

    // Get all platform associations for these posts
    const postIds = posts.map((p: DbPost) => p.id);
    const { data: platforms } = await supabase
        .from('post_platforms')
        .select('*')
        .in('post_id', postIds);

    const platformMap = new Map<string, DbPostPlatform[]>();
    (platforms as DbPostPlatform[] || []).forEach(p => {
        const existing = platformMap.get(p.post_id) || [];
        existing.push(p);
        platformMap.set(p.post_id, existing);
    });

    return posts.map((post: DbPost) =>
        dbToPost(post, platformMap.get(post.id) || [])
    );
}

/**
 * Get a single post by ID
 */
export async function getPost(id: string): Promise<Post | null> {
    const userId = await getCurrentUserIdOrNull();
    if (!userId) return null;

    const supabase = getSupabase();

    const { data: post, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

    if (error || !post) return null;

    const { data: platforms } = await supabase
        .from('post_platforms')
        .select('*')
        .eq('post_id', id);

    return dbToPost(post as DbPost, (platforms as DbPostPlatform[]) || []);
}

// ============================================
// Posts - Write Operations
// ============================================

export interface CreatePostInput {
    content: string;
    platforms: PlatformId[];
    status?: 'draft' | 'scheduled';
    scheduledAt?: string;
}

/**
 * Create a new post
 * @throws {AuthenticationError} if user is not logged in
 * @throws {DatabaseError} if creation fails
 */
export async function createPost(input: CreatePostInput): Promise<Post> {
    const userId = await getCurrentUserId();
    const supabase = getSupabase();

    const { content, platforms, status = 'draft', scheduledAt } = input;

    // Insert the post
    const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
            user_id: userId,
            content,
            status,
            scheduled_at: scheduledAt ?? null,
        })
        .select()
        .single();

    if (postError || !post) {
        throw new DatabaseError(postError?.message || 'Failed to create post');
    }

    // Insert platform associations
    if (platforms.length > 0) {
        const platformInserts = platforms.map(platform => ({
            post_id: (post as DbPost).id,
            platform,
        }));

        const { error: platformError } = await supabase
            .from('post_platforms')
            .insert(platformInserts);

        if (platformError) {
            console.error('Failed to insert platforms:', platformError);
        }
    }

    // Log activity
    await addActivity({
        type: status === 'scheduled' ? 'scheduled' : 'draft',
        message: `${status === 'scheduled' ? 'Scheduled' : 'Created draft'} post for ${platforms.length} platform${platforms.length !== 1 ? 's' : ''}`,
        postId: (post as DbPost).id,
    });

    return dbToPost(post as DbPost, platforms.map((p, i) => ({
        id: `temp-${i}`,
        post_id: (post as DbPost).id,
        platform: p,
        custom_content: null,
        created_at: new Date().toISOString(),
    })));
}

export interface UpdatePostInput {
    content?: string;
    status?: 'draft' | 'scheduled' | 'published' | 'failed';
    scheduledAt?: string | null;
    platforms?: PlatformId[];
}

/**
 * Update an existing post
 * @throws {AuthenticationError} if user is not logged in
 * @throws {DatabaseError} if update fails
 */
export async function updatePost(id: string, input: UpdatePostInput): Promise<Post> {
    const userId = await getCurrentUserId();
    const supabase = getSupabase();

    // Build update object
    const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };

    if (input.content !== undefined) updates.content = input.content;
    if (input.status !== undefined) updates.status = input.status;
    if (input.scheduledAt !== undefined) updates.scheduled_at = input.scheduledAt;
    if (input.status === 'published') updates.published_at = new Date().toISOString();

    // Update the post
    const { data: post, error: postError } = await supabase
        .from('posts')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

    if (postError || !post) {
        throw new DatabaseError(postError?.message || 'Failed to update post');
    }

    // Update platforms if provided
    if (input.platforms) {
        await supabase.from('post_platforms').delete().eq('post_id', id);

        if (input.platforms.length > 0) {
            const platformInserts = input.platforms.map(platform => ({
                post_id: id,
                platform,
            }));
            await supabase.from('post_platforms').insert(platformInserts);
        }
    }

    // Get updated platforms
    const { data: platforms } = await supabase
        .from('post_platforms')
        .select('*')
        .eq('post_id', id);

    return dbToPost(post as DbPost, (platforms as DbPostPlatform[]) || []);
}

/**
 * Delete a post
 * @throws {AuthenticationError} if user is not logged in
 */
export async function deletePost(id: string): Promise<void> {
    const userId = await getCurrentUserId();
    const supabase = getSupabase();

    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

    if (error) {
        throw new DatabaseError(error.message);
    }
}

/**
 * Publish a post (update status to published)
 */
export async function publishPost(id: string): Promise<Post> {
    const post = await updatePost(id, { status: 'published' });

    await addActivity({
        type: 'published',
        message: `Published post to ${post.platforms.length} platform${post.platforms.length !== 1 ? 's' : ''}`,
        postId: id,
    });

    return post;
}

// ============================================
// Activities
// ============================================

interface AddActivityInput {
    type: string;
    message: string;
    postId?: string;
}

/**
 * Add an activity entry (silently fails if not authenticated)
 */
export async function addActivity(input: AddActivityInput): Promise<void> {
    const userId = await getCurrentUserIdOrNull();
    if (!userId) return;

    const supabase = getSupabase();

    await supabase.from('activities').insert({
        user_id: userId,
        type: input.type,
        message: input.message,
        post_id: input.postId ?? null,
    });
}

/**
 * Get recent activities for the current user
 */
export async function getActivities(limit = 50): Promise<Activity[]> {
    const userId = await getCurrentUserIdOrNull();
    if (!userId) return [];

    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error || !data) return [];

    return (data as DbActivity[]).map(a => ({
        id: a.id,
        type: a.type as Activity['type'],
        message: a.message,
        postId: a.post_id ?? undefined,
        timestamp: a.created_at,
    }));
}

// ============================================
// Dashboard Stats
// ============================================

export interface DashboardStats {
    postsThisWeek: number;
    scheduledPosts: number;
    drafts: number;
    publishedThisMonth: number;
}

/**
 * Get dashboard statistics for the current user
 */
export async function getDashboardStats(): Promise<DashboardStats> {
    const posts = await getPosts();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
        postsThisWeek: posts.filter(p => new Date(p.createdAt) >= weekAgo).length,
        scheduledPosts: posts.filter(p => p.status === 'scheduled').length,
        drafts: posts.filter(p => p.status === 'draft').length,
        publishedThisMonth: posts.filter(p =>
            p.status === 'published' &&
            p.publishedAt &&
            new Date(p.publishedAt) >= monthAgo
        ).length,
    };
}
