/**
 * Meta (Facebook & Instagram) Platform Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockMetaApiResponses } from '../../utils';

const mockFetch = mockMetaApiResponses();
global.fetch = mockFetch;

describe('Meta Publishing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Facebook', () => {
        it('should post to feed using postToFacebookPage', async () => {
            const { postToFacebookPage } = await import('@/lib/social/meta');

            const result = await postToFacebookPage('page-123', 'page-token', 'Hello FB');
            expect(result.id).toBe('fb-post-123');

            const call = mockFetch.mock.calls.find(call => call[0].includes('/feed'));
            expect(call).toBeDefined();
            const [url, options] = call as [string, RequestInit];

            // Verify token
            expect(options.headers).toHaveProperty('Content-Type', 'application/json');

            // Verify body
            const body = JSON.parse(options.body as string);
            expect(body.message).toBe('Hello FB');
            expect(body.access_token).toBe('page-token');
        });
    });

    describe('Instagram', () => {
        it('should follow container creation flow', async () => {
            const { postToInstagram } = await import('@/lib/social/meta');

            const result = await postToInstagram(
                'ig-user-123',
                'access-token',
                'Hello IG',
                [{ type: 'image', url: 'https://example.com/image.jpg' }]
            );

            expect(result.id).toBe('ig-media-123');

            // Check for container creation
            const containerCall = mockFetch.mock.calls.find(call => call[0].includes('/media') && !call[0].includes('/media_publish'));
            expect(containerCall).toBeDefined();

            // Check for publish
            const publishCall = mockFetch.mock.calls.find(call => call[0].includes('/media_publish'));
            expect(publishCall).toBeDefined();
        });
    });
});
