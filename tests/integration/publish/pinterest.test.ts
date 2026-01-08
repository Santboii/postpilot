/**
 * Pinterest Platform Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockPinterestApiResponses } from '../../utils';

const mockFetch = mockPinterestApiResponses();
global.fetch = mockFetch;

describe('Pinterest Publishing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch boards', async () => {
        const { getPinterestBoards } = await import('@/lib/social/pinterest');

        const boards = await getPinterestBoards('test-token');
        expect(boards).toHaveLength(1);
        expect(boards[0].name).toBe('Test Board');

        const call = mockFetch.mock.calls.find(call => call[0].includes('/boards'));
        expect(call).toBeDefined();
    });

    it('should create pin with image URL', async () => {
        const { createPin } = await import('@/lib/social/pinterest');

        const result = await createPin(
            'test-token',
            'board-123',
            'Pin Title',
            'Pin Desc',
            'https://example.com/image.jpg',
            'https://link.com'
        );

        expect(result.id).toBe('pin-123');

        const call = mockFetch.mock.calls.find(call => call[0].includes('/pins'));
        expect(call).toBeDefined();

        const body = JSON.parse((call as [string, RequestInit])[1].body as string);
        expect(body.board_id).toBe('board-123');
        expect(body.media_source.source_type).toBe('image_url');
        expect(body.media_source.url).toBe('https://example.com/image.jpg');
    });
});
