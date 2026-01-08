/**
 * X (Twitter) Platform Publish Integration Tests
 * 
 * Tests the X media upload and tweet creation flow.
 * Uses mocked X API responses to test without making real API calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockPost, createMockMedia, mockXApiResponses, createMockSocialAccount } from '../../utils';

// Mock fetch globally for this test file
const mockFetch = mockXApiResponses();
global.fetch = mockFetch;

describe('X Platform Publishing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('uploadMedia', () => {
        it('should send correct JSON body for image upload', async () => {
            // Import the function dynamically to ensure mocks are set up
            const { uploadMedia } = await import('@/lib/social/x');

            // Create a small test buffer
            const testBuffer = Buffer.from('fake image data');
            const accessToken = 'test-access-token';
            const mimeType = 'image/png';

            await uploadMedia(accessToken, testBuffer, mimeType);

            // Verify fetch was called
            expect(mockFetch).toHaveBeenCalled();

            // Get the call arguments
            const calls = mockFetch.mock.calls;
            const uploadCall = calls.find((call: unknown[]) =>
                typeof call[0] === 'string' && call[0].includes('/2/media/upload')
            );

            expect(uploadCall).toBeDefined();

            // Verify request structure
            const [url, options] = uploadCall as [string, RequestInit];
            expect(url).toBe('https://api.x.com/2/media/upload');
            expect(options.method).toBe('POST');
            expect(options.headers).toHaveProperty('Content-Type', 'application/json');
            expect(options.headers).toHaveProperty('Authorization', `Bearer ${accessToken}`);

            // Verify body contains required fields
            const body = JSON.parse(options.body as string);
            expect(body).toHaveProperty('media');
            expect(body).toHaveProperty('media_category', 'tweet_image');
            expect(body).toHaveProperty('media_type', mimeType);
        });

        it('should return media ID on successful upload', async () => {
            const { uploadMedia } = await import('@/lib/social/x');

            const testBuffer = Buffer.from('fake image data');
            const result = await uploadMedia('test-token', testBuffer, 'image/jpeg');

            expect(result).toBe('mock-media-id-123');
        });

        it('should set correct category for GIF', async () => {
            const { uploadMedia } = await import('@/lib/social/x');

            await uploadMedia('test-token', Buffer.from('gif'), 'image/gif');

            const calls = mockFetch.mock.calls;
            const uploadCall = calls.find((call: unknown[]) =>
                typeof call[0] === 'string' && call[0].includes('/2/media/upload')
            );

            const body = JSON.parse((uploadCall as [string, RequestInit])[1].body as string);
            expect(body.media_category).toBe('tweet_gif');
        });
    });

    describe('postTweet', () => {
        it('should create tweet with correct structure', async () => {
            const { postTweet } = await import('@/lib/social/x');

            const result = await postTweet('test-token', 'Hello world!');

            expect(result).toHaveProperty('id');

            // Verify the tweet endpoint was called
            const calls = mockFetch.mock.calls;
            const tweetCall = calls.find((call: unknown[]) =>
                typeof call[0] === 'string' && call[0].includes('/2/tweets')
            );

            expect(tweetCall).toBeDefined();
        });

        it('should include media IDs when provided', async () => {
            const { postTweet } = await import('@/lib/social/x');

            await postTweet('test-token', 'With image', ['media-123', 'media-456']);

            const calls = mockFetch.mock.calls;
            const tweetCall = calls.find((call: unknown[]) =>
                typeof call[0] === 'string' && call[0].includes('/2/tweets')
            );

            const body = JSON.parse((tweetCall as [string, RequestInit])[1].body as string);
            expect(body.media).toHaveProperty('media_ids');
            expect(body.media.media_ids).toContain('media-123');
            expect(body.media.media_ids).toContain('media-456');
        });
    });

    describe('Full publish flow', () => {
        it('should upload media and create tweet', async () => {
            const { uploadMedia, postTweet } = await import('@/lib/social/x');

            // Upload image
            const mediaId = await uploadMedia(
                'test-token',
                Buffer.from('image data'),
                'image/png'
            );

            expect(mediaId).toBeDefined();

            // Create tweet with media
            const tweet = await postTweet('test-token', 'Test with image', [mediaId]);

            expect(tweet.id).toBeDefined();
        });
    });
});

describe('Mock utilities', () => {
    it('createMockPost generates valid post', () => {
        const post = createMockPost({ content: 'Custom content' });

        expect(post.id).toBeDefined();
        expect(post.content).toBe('Custom content');
        expect(post.platforms).toContain('twitter');
    });

    it('createMockMedia generates valid media', () => {
        const media = createMockMedia({ type: 'video' });

        expect(media.url).toBeDefined();
        expect(media.type).toBe('video');
    });

    it('createMockSocialAccount generates valid account', () => {
        const account = createMockSocialAccount('twitter');

        expect(account.platform).toBe('twitter');
        expect(account.access_token).toBeDefined();
    });
});
