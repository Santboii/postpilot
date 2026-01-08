# LinkedIn Platform Integration

## Overview
LinkedIn uses OAuth 2.0 for authentication and their REST Posts API (version 202511) for publishing.

## Authentication

### OAuth Scopes
```typescript
'openid profile w_member_social email w_organization_social r_organization_social rw_organization_admin'
```

### Files
- Auth initiation: `src/app/api/auth/linkedin/route.ts`
- Auth callback: `src/app/api/auth/linkedin/callback/route.ts`
- Token refresh: `src/lib/social/linkedin.ts` → `refreshLinkedInToken()`

## Image Upload

LinkedIn uses a two-step process for image uploads:

### Step 1: Initialize Upload
```http
POST https://api.linkedin.com/rest/images?action=initializeUpload
Authorization: Bearer <token>
Content-Type: application/json
LinkedIn-Version: 202511
X-Restli-Protocol-Version: 2.0.0

{
  "initializeUploadRequest": {
    "owner": "urn:li:person:<id>"
  }
}
```

Response:
```json
{
  "value": {
    "uploadUrl": "https://www.linkedin.com/dms-uploads/...",
    "image": "urn:li:image:<id>"
  }
}
```

### Step 2: Upload Binary
```http
PUT <uploadUrl>
Authorization: Bearer <token>
Content-Type: application/octet-stream

<binary image data>
```

## Publishing

### Post with Optional Image
```http
POST https://api.linkedin.com/rest/posts
Authorization: Bearer <token>
Content-Type: application/json
LinkedIn-Version: 202511
X-Restli-Protocol-Version: 2.0.0

{
  "author": "urn:li:person:<id>",
  "commentary": "Post content",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED",
    "targetEntities": [],
    "thirdPartyDistributionChannels": []
  },
  "lifecycleState": "PUBLISHED",
  "content": {  // Optional, only if image
    "media": {
      "id": "urn:li:image:<id>",
      "altText": "Image description"
    }
  }
}
```

### Author URN Format
- **Person**: `urn:li:person:<id>`
- **Organization**: `urn:li:organization:<id>`

The code auto-prefixes raw IDs with `urn:li:person:`.

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Token expired | Refresh token or reconnect |
| 403 Forbidden | Missing scope | Check requested scopes |
| `EMPTY_AUTHOR` | Invalid author URN | Ensure URN format is correct |

## Files Reference

| File | Purpose |
|------|---------|
| `src/lib/social/linkedin.ts` | Auth, upload, post functions |
| `src/app/api/auth/linkedin/` | OAuth flow |
| `src/app/api/publish/linkedin/route.ts` | Publish endpoint |

## Last Updated
2026-01-06
