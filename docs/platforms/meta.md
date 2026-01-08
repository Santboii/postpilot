# Meta (Facebook & Instagram) Platform Integration

## Overview
Meta uses OAuth 2.0 and the Graph API (v21.0) for both Facebook and Instagram. Instagram posting requires a linked Facebook Page with an Instagram Business account.

## Authentication

### OAuth Scopes
```typescript
'public_profile,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish,business_management'
```

### Token Flow
1. Short-lived user token (from OAuth)
2. Exchange for long-lived token (60 days)
3. Get Page-level access tokens for posting

### Files
- Auth initiation: `src/app/api/auth/meta/route.ts`
- Auth callback: `src/app/api/auth/meta/callback/route.ts`
- Library: `src/lib/social/meta.ts`

## Facebook Page Posting

### Text-Only Post
```http
POST https://graph.facebook.com/v21.0/{page-id}/feed
Authorization: Bearer <page_access_token>
Content-Type: application/x-www-form-urlencoded

message=Hello%20world!
```

### Post with Images (URLs)
```http
POST https://graph.facebook.com/v21.0/{page-id}/photos
Authorization: Bearer <page_access_token>
Content-Type: application/x-www-form-urlencoded

url=https://example.com/image.jpg&published=false
```

Then attach to post:
```http
POST https://graph.facebook.com/v21.0/{page-id}/feed

message=Hello&attached_media=[{"media_fbid":"<photo_id>"}]
```

## Instagram Posting

Instagram uses a container-based flow:

### Step 1: Create Container
```http
POST https://graph.facebook.com/v21.0/{ig-user-id}/media
Authorization: Bearer <token>

image_url=https://...&caption=Hello
```

### Step 2: Publish Container
```http
POST https://graph.facebook.com/v21.0/{ig-user-id}/media_publish

creation_id=<container_id>
```

### Carousel Posts
For multiple images:
1. Create each item container (with `is_carousel_item=true`)
2. Wait for processing on each
3. Create carousel container with `children` param
4. Publish carousel

### Video Posts (Reels)
1. Create container with `media_type=REELS&video_url=...`
2. Poll `GET /{container-id}?fields=status_code` until `FINISHED`
3. Publish container

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `(#200) Requires business_management` | Missing scope | Reconnect with all scopes |
| `Media already published` | Container used twice | Create new container |
| No Instagram account | Page not linked | Link IG Business account in Meta Business Suite |

## Important Notes

1. **Instagram requires business account** - Personal IG accounts cannot use the API
2. **Image URLs must be public** - Instagram fetches from URLs, not binary upload
3. **Video processing takes time** - Must poll status before publishing

## Files Reference

| File | Purpose |
|------|---------|
| `src/lib/social/meta.ts` | Auth, upload, post for FB & IG |
| `src/app/api/auth/meta/` | OAuth flow |
| `src/app/api/publish/facebook/route.ts` | Facebook publish |
| `src/app/api/publish/instagram/route.ts` | Instagram publish |

## Last Updated
2026-01-06
