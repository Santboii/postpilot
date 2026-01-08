/**
 * Bluesky Platform Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockBlueskyApiResponses } from '../../utils';

// Mock jose library to bypass crypto operations
vi.mock('jose', async (importOriginal) => {
    return {
        generateKeyPair: vi.fn().mockResolvedValue({
            privateKey: new Uint8Array([1, 2, 3]),
            publicKey: new Uint8Array([4, 5, 6])
        }),
        SignJWT: vi.fn().mockImplementation(() => ({
            setProtectedHeader: vi.fn().mockReturnThis(),
            setIssuedAt: vi.fn().mockReturnThis(),
            setJti: vi.fn().mockReturnThis(),
            sign: vi.fn().mockResolvedValue('mock-dpop-proof'),
        })),
        exportJWK: vi.fn().mockResolvedValue({ kty: 'EC', crv: 'P-256', x: 'mock', y: 'mock' }),
        importJWK: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
        calculateJwkThumbprint: vi.fn().mockResolvedValue('mock-thumbprint'),
    };
});

const mockFetch = mockBlueskyApiResponses();
global.fetch = mockFetch;

describe('Bluesky Publishing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should resolve PDS from DID', async () => {
        const { resolvePdsEndpoint } = await import('@/lib/social/bluesky');

        const pds = await resolvePdsEndpoint('did:plc:123');
        expect(pds).toBe('https://bsky.social');

        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('plc.directory/did:plc:123'));
    });

    it('should create record via postBlueskyRecord', async () => {
        const { postBlueskyRecord } = await import('@/lib/social/bluesky');

        // This function orchestrates the whole flow including DPoP proof generation
        await postBlueskyRecord(
            'test-token',
            'did:plc:123',
            'Hello Bluesky',
            [] // no images
            // We let the internal key generation happen via our mock
        );

        // Verify Create Record Call
        const createCall = mockFetch.mock.calls.find(call => call[0].includes('com.atproto.repo.createRecord'));
        expect(createCall).toBeDefined();

        const [url, options] = createCall as [string, RequestInit];
        expect(options.method).toBe('POST');

        // Verify we hit the right PDS (mocked resolvePdsEndpoint implied, or default)
        // Check body content
        const body = JSON.parse(options.body as string);
        expect(body.record.text).toBe('Hello Bluesky');
        expect(body.repo).toBe('did:plc:123');
    });
});
