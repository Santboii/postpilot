/**
 * TikTok Platform Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockTikTokApiResponses } from '../../utils';

const mockFetch = mockTikTokApiResponses();
global.fetch = mockFetch;

describe('TikTok Publishing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Video Upload', () => {
        it('should handle full video upload flow via postVideo', async () => {
            const { postVideo } = await import('@/lib/social/tiktok');

            const buffer = Buffer.from('video-data');

            await postVideo(
                'test-token',
                buffer,
                'Test Video',
                'PUBLIC_TO_EVERYONE'
            );

            // Verify Init Call
            const initCall = mockFetch.mock.calls.find(call => call[0].includes('/post/publish/video/init'));
            expect(initCall).toBeDefined();

            // Verify Upload Call
            const uploadCall = mockFetch.mock.calls.find(call => call[0].includes('tiktok.com/test'));
            expect(uploadCall).toBeDefined();
            const [, options] = uploadCall as [string, RequestInit];
            expect(options.method).toBe('PUT');
        });
    });

    describe('Photo Post', () => {
        it('should handle photo post via postPhotos', async () => {
            const { postPhotos } = await import('@/lib/social/tiktok');

            await postPhotos(
                'test-token',
                ['https://example.com/image.jpg'],
                'Test Photo'
            );

            const call = mockFetch.mock.calls.find(call => call[0].includes('/post/publish/content/init'));
            expect(call).toBeDefined();

            const body = JSON.parse((call as [string, RequestInit])[1].body as string);
            expect(body.post_mode).toBe('MEDIA_UPLOAD');
            expect(body.media_type).toBe('PHOTO');
        });
    });
});
