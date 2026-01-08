/**
 * LinkedIn Platform Integration Tests
 * 
 * Verifies the post flow which internally handles the 2-step media upload.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockLinkedInApiResponses } from '../../utils';

const mockFetch = mockLinkedInApiResponses();
global.fetch = mockFetch;

describe('LinkedIn Publishing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should handle full flow: init -> upload -> create post', async () => {
        const { postLinkedInShare } = await import('@/lib/social/linkedin');

        // Test data
        const buffer = Buffer.from('test-image');
        const token = 'test-token';
        const personUrn = 'urn:li:person:123';
        const content = 'Hello LinkedIn';

        // Execute public function
        const result = await postLinkedInShare(token, personUrn, content, buffer, 'Alt Text');

        expect(result.success).toBe(true);
        expect(result.id).toBe('urn:li:share:123');

        // Verify Sequence of API Calls

        // 1. Initialize Upload
        const initCall = mockFetch.mock.calls.find(call => call[0].includes('action=initializeUpload'));
        expect(initCall).toBeDefined();

        // 2. Upload Binary
        const uploadCall = mockFetch.mock.calls.find(call => call[0].includes('dms-uploads'));
        expect(uploadCall).toBeDefined();
        const [uploadUrl, uploadOpts] = uploadCall as [string, RequestInit];
        expect(uploadOpts.method).toBe('PUT');

        // 3. Create Post
        const postCall = mockFetch.mock.calls.find(call => call[0].includes('/rest/posts'));
        expect(postCall).toBeDefined();

        const body = JSON.parse((postCall as [string, RequestInit])[1].body as string);
        expect(body.author).toBe(personUrn);
        expect(body.content.media.id).toBe('urn:li:image:123');
        expect(body.content.media.altText).toBe('Alt Text');
    });

    it('should create text-only post when no image provided', async () => {
        const { postLinkedInShare } = await import('@/lib/social/linkedin');

        await postLinkedInShare('test-token', 'urn:li:person:123', 'Text only');

        const postCall = mockFetch.mock.calls.find(call => call[0].includes('/rest/posts'));
        expect(postCall).toBeDefined();

        const body = JSON.parse((postCall as [string, RequestInit])[1].body as string);
        expect(body.content).toBeUndefined(); // No media content
        expect(body.commentary).toBe('Text only');
    });
});
