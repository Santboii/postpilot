import { vi } from 'vitest';

// ===========================================
// DATA FACTORIES
// ===========================================

export function createMockPost(overrides = {}) {
    return {
        id: 'post-123',
        content: 'Test post content',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: 'user-123',
        publish_status: 'DRAFT',
        scheduled_for: null,
        media: [],
        platforms: ['twitter'],
        ...overrides,
    };
}

export function createMockMedia(overrides = {}) {
    return {
        id: 'media-123',
        url: 'https://example.com/image.jpg',
        type: 'image',
        path: 'uploads/image.jpg',
        ...overrides,
    };
}

export function createMockSocialAccount(platform: string, overrides = {}) {
    return {
        id: `${platform}-account-123`,
        platform: platform,
        platform_account_id: '123456789',
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
        ...overrides,
    };
}

/**
 * Mock Supabase Client
 */
export function createMockSupabaseClient() {
    return {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upload: vi.fn().mockResolvedValue({ data: { path: 'uploads/test.jpg' }, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/uploads/test.jpg' } }),
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
            getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-session-token' } }, error: null }),
        },
        storage: {
            from: vi.fn().mockReturnThis(),
        }
    };
}

// ===========================================
// API MOCK FACTORIES
// ===========================================

/**
 * Mock fetch responses for X API
 */
export function mockXApiResponses() {
    return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        const urlString = url.toString();

        // Mock media upload
        if (urlString.includes('/2/media/upload')) {
            return Promise.resolve(new Response(JSON.stringify({
                data: {
                    id: 'mock-media-id-123',
                    media_key: '3_mock-media-id-123',
                }
            }), { status: 200 }));
        }

        // Mock tweet creation
        if (urlString.includes('/2/tweets')) {
            return Promise.resolve(new Response(JSON.stringify({
                data: {
                    id: 'mock-tweet-id-456',
                    text: 'Test post content',
                }
            }), { status: 201 }));
        }

        // Default: pass through
        return Promise.resolve(new Response(JSON.stringify({ error: 'Unknown endpoint' }), { status: 404 }));
    });
}

/**
 * Mock LinkedIn API Responses
 */
export function mockLinkedInApiResponses() {
    return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        const urlString = url.toString();

        // 1. Initialize Upload
        if (urlString.includes('action=initializeUpload')) {
            return Promise.resolve(new Response(JSON.stringify({
                value: {
                    uploadUrl: 'https://api.linkedin.com/dms-uploads/test',
                    image: 'urn:li:image:123'
                }
            }), { status: 200 }));
        }

        // 2. Upload Binary
        if (options?.method === 'PUT' && urlString.includes('dms-uploads')) {
            return Promise.resolve(new Response('', { status: 201 }));
        }

        // 3. Create Share (new Posts API)
        if (urlString.includes('/rest/posts')) {
            return Promise.resolve(new Response(JSON.stringify({}), {
                status: 201,
                headers: {
                    'x-restli-id': 'urn:li:share:123'
                }
            }));
        }

        return Promise.resolve(new Response(JSON.stringify({ error: 'Unknown endpoint' }), { status: 404 }));
    });
}

/**
 * Mock Meta (FB/IG) API Responses
 */
export function mockMetaApiResponses() {
    return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        const urlString = url.toString();

        // Facebook Feed
        if (urlString.includes('/feed')) {
            return Promise.resolve(new Response(JSON.stringify({
                id: 'fb-post-123'
            }), { status: 200 }));
        }

        // Facebook Photos
        if (urlString.includes('/photos')) {
            return Promise.resolve(new Response(JSON.stringify({
                id: 'fb-photo-123',
                post_id: 'fb-post-with-photo-123'
            }), { status: 200 }));
        }

        // Instagram Media Container
        if (urlString.includes('/media') && !urlString.includes('media_publish')) {
            return Promise.resolve(new Response(JSON.stringify({
                id: 'ig-container-123'
            }), { status: 200 }));
        }

        // Instagram Publish
        if (urlString.includes('/media_publish')) {
            return Promise.resolve(new Response(JSON.stringify({
                id: 'ig-media-123'
            }), { status: 200 }));
        }

        // Token Exchange
        if (urlString.includes('oauth/access_token')) {
            return Promise.resolve(new Response(JSON.stringify({
                access_token: 'mock-access-token',
                expires_in: 3600
            }), { status: 200 }));
        }

        return Promise.resolve(new Response(JSON.stringify({ error: 'Unknown endpoint' }), { status: 404 }));
    });
}

/**
 * Mock TikTok API Responses
 */
export function mockTikTokApiResponses() {
    return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        const urlString = url.toString();

        // Init Video
        if (urlString.includes('/post/publish/video/init')) {
            return Promise.resolve(new Response(JSON.stringify({
                data: {
                    publish_id: 'tiktok-publish-id',
                    upload_url: 'https://upload.tiktok.com/test'
                }
            }), { status: 200 }));
        }

        // Init Photo Flow (Direct Post)
        if (urlString.includes('/post/publish/content/init')) {
            return Promise.resolve(new Response(JSON.stringify({
                data: {
                    publish_id: 'tiktok-photo-id'
                }
            }), { status: 200 }));
        }

        // Upload Video (PUT)
        if (urlString.includes('tiktok.com')) {
            return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
        }

        // Finalize/Post Video (Direct Post)
        if (!urlString.includes('/init') && options?.method === 'POST') {
            return Promise.resolve(new Response(JSON.stringify({
                data: {
                    publish_id: 'tiktok-publish-id'
                }
            }), { status: 200 }));
        }

        return Promise.resolve(new Response(JSON.stringify({ data: { publish_id: 'fallback-id' } }), { status: 200 }));
    });
}

/**
 * Mock Bluesky API Responses
 */
export function mockBlueskyApiResponses() {
    return vi.fn().mockImplementation((url: string | Request, options?: RequestInit) => {
        const urlString = url.toString();

        // PDS Resolution (simple GET)
        if (urlString.includes('plc.directory')) {
            return Promise.resolve(new Response(JSON.stringify({
                id: 'did:plc:123',
                service: [{
                    id: '#atproto_pds',
                    type: 'AtprotoPersonalDataServer',
                    serviceEndpoint: 'https://bsky.social'
                }]
            }), { status: 200 }));
        }

        // Create Record (Post)
        if (urlString.includes('com.atproto.repo.createRecord')) {
            return Promise.resolve(new Response(JSON.stringify({
                uri: 'at://did:plc:123/app.bsky.feed.post/3kjs9823s',
                cid: 'bafyreidf...'
            }), { status: 200 }));
        }

        // Image Upload
        if (urlString.includes('com.atproto.repo.uploadBlob')) {
            return Promise.resolve(new Response(JSON.stringify({
                blob: {
                    ref: { $link: 'blob-link-123' },
                    mimeType: 'image/jpeg',
                    size: 1024
                }
            }), { status: 200 }));
        }

        return Promise.resolve(new Response(JSON.stringify({ error: 'Unknown endpoint' }), { status: 404 }));
    });
}

/**
 * Mock Pinterest API Responses
 */
export function mockPinterestApiResponses() {
    return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        const urlString = url.toString();

        // Boards
        if (urlString.includes('/boards')) {
            return Promise.resolve(new Response(JSON.stringify({
                items: [{
                    id: 'board-123',
                    name: 'Test Board'
                }]
            }), { status: 200 }));
        }

        // Create Pin
        if (urlString.includes('/pins')) {
            return Promise.resolve(new Response(JSON.stringify({
                id: 'pin-123',
                title: 'Test Pin'
            }), { status: 201 }));
        }

        return Promise.resolve(new Response(JSON.stringify({ error: 'Unknown endpoint' }), { status: 404 }));
    });
}
