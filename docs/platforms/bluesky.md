# Bluesky Platform Integration

## Overview
Bluesky uses the AT Protocol with OAuth 2.0 DPoP (Demonstrating Proof of Possession) for authentication. It's the most complex auth flow of all platforms.

## Authentication

### OAuth Scopes
```typescript
'atproto transition:generic'
```

### DPoP Authentication
Bluesky requires DPoP proofs with every authenticated request. This involves:
1. Generating an ES256 key pair
2. Creating a DPoP JWT proof for each request
3. Including the proof in a `DPoP` header
4. Handling nonce rotation on 401 responses

### Key Files
- Auth initiation: `src/app/api/auth/bluesky/route.ts`
- Auth callback: `src/app/api/auth/bluesky/callback/route.ts`
- Library: `src/lib/social/bluesky.ts`

## Token Structure

```typescript
interface BlueskyTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    scope: string;
    did: string;         // Decentralized Identifier
    dpopKey?: JWK;       // Must store for future requests!
}
```

**Critical**: The DPoP key must be stored with the tokens and reused for all subsequent requests.

## Image Processing

Bluesky has strict image requirements:
- Max 1MB file size
- Converted to JPEG for optimal compatibility

```typescript
const processed = await sharp(buffer)
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
```

## Publishing

### AT Protocol Record Creation
```http
POST https://<pds>/xrpc/com.atproto.repo.createRecord
Authorization: DPoP <access_token>
DPoP: <dpop_proof>
Content-Type: application/json

{
  "repo": "did:plc:...",
  "collection": "app.bsky.feed.post",
  "record": {
    "$type": "app.bsky.feed.post",
    "text": "Hello Bluesky!",
    "createdAt": "2026-01-06T00:00:00.000Z",
    "embed": {  // Optional, for images
      "$type": "app.bsky.embed.images",
      "images": [
        {
          "alt": "Description",
          "image": { "$type": "blob", ... }
        }
      ]
    }
  }
}
```

### Image Upload (Blob)
```http
POST https://<pds>/xrpc/com.atproto.repo.uploadBlob
Authorization: DPoP <access_token>
DPoP: <dpop_proof>
Content-Type: image/jpeg

<binary image data>
```

## PDS Resolution

Users may be on different Personal Data Servers. The code resolves PDS from DID:

```typescript
// did:plc resolution
const plcRes = await fetch(`https://plc.directory/${did}`);
const doc = await plcRes.json();
const pds = doc.service.find(s => s.type === 'AtprotoPersonalDataServer');
```

Falls back to `bsky.social` if resolution fails.

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `use_dpop_nonce` | Nonce required/expired | Retry with provided nonce |
| `ExpiredToken` | Access token expired | Refresh token |
| `InvalidDpopProof` | Wrong key or malformed | Check DPoP key storage |

## DPoP Retry Flow

```typescript
// First request may fail with nonce requirement
const res1 = await makeRequest();
if (res1.status === 401) {
    const nonce = res1.headers.get('dpop-nonce');
    // Retry with nonce
    const res2 = await makeRequest(nonce);
}
```

## Files Reference

| File | Purpose |
|------|---------|
| `src/lib/social/bluesky.ts` | Auth, DPoP, upload, post |
| `src/app/api/auth/bluesky/` | OAuth DPoP flow |
| `src/app/api/publish/bluesky/route.ts` | Publish endpoint |

## Complexity Note

Bluesky is the most complex integration due to:
1. DPoP authentication (proof generation for every request)
2. Nonce handling (retries on 401)
3. PDS federation (different servers for different users)
4. AT Protocol record structure (not standard REST)

## Last Updated
2026-01-06
