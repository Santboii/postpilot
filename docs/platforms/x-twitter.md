# X (Twitter) Platform Integration

## Overview
X uses OAuth 2.0 PKCE for authentication and their v2 API for all operations.

## Authentication

### OAuth Scopes
```typescript
const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'media.write'];
```

> **Note**: `media.read` is NOT a valid scope - only use `media.write`.

### Files
- Auth initiation: `src/app/api/auth/x/route.ts`
- Auth callback: `src/app/api/auth/x/callback/route.ts`
- Token refresh: `src/lib/social/x.ts` → `refreshAccessToken()`

## Media Upload (v2 API)

### Image Upload - Simple JSON Request
For images (PNG, JPEG, GIF, WebP), use a **single JSON request**:

```typescript
POST https://api.x.com/2/media/upload
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "media": "<base64_encoded_data>",
  "media_category": "tweet_image",  // or "tweet_gif"
  "media_type": "image/png"          // MIME type
}
```

Response:
```json
{
  "data": {
    "id": "2008705580618100736",
    "media_key": "3_2008705580618100736",
    "expires_after_secs": 86400
  }
}
```

### Video Upload - Chunked Flow
For videos, use separate endpoints:
1. `POST /2/media/upload/initialize` - Start session
2. `POST /2/media/upload/{id}/append` - Upload chunks
3. `POST /2/media/upload/finalize` - Complete
4. Poll `GET /2/media/upload/{id}/status` until processing complete

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `invalid_scope` | Invalid OAuth scope | Remove `media.read`, use only `media.write` |
| `$.command is not defined` | Using v1.1 format on v2 | Use JSON body, not FormData with `command=` |
| `$.media is missing` | Wrong request format | Include `media` key with base64 data in JSON |
| `403 Forbidden` | Token missing scope | Disconnect and reconnect X account |

## Publishing Flow

### Data Flow
```
PostComposer → createPost() → posts table
                            → post_platforms table (platform-specific metadata.media)

Publish button → publishPost() → /api/publish/x/route.ts
                               → uploadMedia() → X API
                               → postTweet() → X API
```

### Platform-Specific Media
When only 1 platform is selected, images are stored in `post_platforms.metadata.media`, NOT `posts.media`.

The publish route must check BOTH:
```typescript
// 1. Check platform-specific first
const platformMedia = twitterPlatform?.metadata?.media;
// 2. Fallback to shared
const sharedMedia = post?.media;
// 3. Use whichever has data
const mediaToUpload = platformMedia?.length > 0 ? platformMedia : sharedMedia;
```

## Files Reference

| File | Purpose |
|------|---------|
| `src/lib/social/x.ts` | Upload, post, auth helpers |
| `src/app/api/auth/x/route.ts` | OAuth initiation |
| `src/app/api/auth/x/callback/route.ts` | OAuth callback |
| `src/app/api/publish/x/route.ts` | Publishing endpoint |

## Last Updated
2026-01-06 - Fixed v2 media upload (simple JSON for images)
