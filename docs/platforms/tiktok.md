# TikTok Platform Integration

## Overview
TikTok uses OAuth 2.0 with PKCE for authentication and the Content Posting API for publishing videos and photos.

## Authentication

### OAuth Scopes
```typescript
['user.info.basic', 'video.upload', 'video.publish']
```

### PKCE Note
TikTok uses **non-standard HEX encoding** for S256 code challenge (not Base64URL).

```typescript
// Standard PKCE uses Base64URL, TikTok uses HEX
const codeChallenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('hex');  // HEX, not base64url!
```

### Files
- Auth initiation: `src/app/api/auth/tiktok/route.ts`
- Auth callback: `src/app/api/auth/tiktok/callback/route.ts`
- Token refresh: `src/lib/social/tiktok.ts` → `refreshAccessToken()`

## Video Constraints
- **Max size**: 64MB (for single-chunk upload)
- **Allowed types**: `video/mp4`, `video/quicktime`, `video/webm`

## Video Upload (Direct Post)

### Step 1: Initialize Upload
```http
POST https://open.tiktokapis.com/v2/post/publish/video/init/
Authorization: Bearer <token>
Content-Type: application/json

{
  "post_info": {
    "title": "My video",
    "privacy_level": "PUBLIC_TO_EVERYONE",
    "disable_duet": false,
    "disable_comment": false,
    "disable_stitch": false,
    "video_cover_timestamp_ms": 0
  },
  "source_info": {
    "source": "FILE_UPLOAD",
    "video_size": 12345678,
    "chunk_size": 12345678,
    "total_chunk_count": 1
  }
}
```

Response:
```json
{
  "data": {
    "publish_id": "...",
    "upload_url": "https://..."
  }
}
```

### Step 2: Upload Video Binary
```http
PUT <upload_url>
Content-Range: bytes 0-12345677/12345678
Content-Type: video/mp4

<binary video data>
```

## Photo Posts (Photo Mode)

For image posts, TikTok uses URL-based upload:

```http
POST https://open.tiktokapis.com/v2/post/publish/content/init/
Authorization: Bearer <token>
Content-Type: application/json

{
  "post_info": {
    "title": "My photos",
    "privacy_level": "PUBLIC_TO_EVERYONE"
  },
  "source_info": {
    "source": "PULL_FROM_URL",
    "photo_images": ["https://url1.jpg", "https://url2.jpg"]
  },
  "post_mode": "DIRECT_POST",
  "media_type": "PHOTO"
}
```

## Privacy Levels
- `PUBLIC_TO_EVERYONE` - Anyone can view
- `MUTUAL_FOLLOW_FRIENDS` - Only mutual followers
- `SELF_ONLY` - Only you (for testing)

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `invalid_grant` | Token expired | Refresh token |
| `spam_risk` | Content flagged | Use different content |
| `video_size_limit` | File too large | Compress or use chunked upload |

## Files Reference

| File | Purpose |
|------|---------|
| `src/lib/social/tiktok.ts` | Auth, upload, post |
| `src/app/api/auth/tiktok/` | OAuth flow |
| `src/app/api/publish/tiktok/route.ts` | Publish endpoint |

## Last Updated
2026-01-06
