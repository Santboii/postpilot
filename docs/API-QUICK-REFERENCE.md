# Platform API Quick Reference

Quick reference for API formats across all platforms.

## X (Twitter) v2

### Image Upload
```http
POST https://api.x.com/2/media/upload
Content-Type: application/json
Authorization: Bearer <token>

{"media": "<base64>", "media_category": "tweet_image", "media_type": "image/png"}
```

### Post Tweet
```http
POST https://api.x.com/2/tweets
Content-Type: application/json
Authorization: Bearer <token>

{"text": "Hello", "media": {"media_ids": ["123456789"]}}
```

### OAuth Scopes
`tweet.read`, `tweet.write`, `users.read`, `offline.access`, `media.write`

---

## LinkedIn v2

### Image Upload
```http
POST https://api.linkedin.com/rest/images?action=initializeUpload
Authorization: Bearer <token>

{"initializeUploadRequest": {"owner": "urn:li:person:xxx"}}
```

### Post Share
```http
POST https://api.linkedin.com/v2/ugcPosts
Authorization: Bearer <token>

{"author": "urn:li:person:xxx", "lifecycleState": "PUBLISHED", ...}
```

---

## Meta (Facebook/Instagram)

### Page Post
```http
POST https://graph.facebook.com/v21.0/{page-id}/feed
Authorization: Bearer <page_token>

{"message": "Hello", "link": "https://..."}
```

### Instagram Container
```http
POST https://graph.facebook.com/v21.0/{ig-user-id}/media
Authorization: Bearer <token>

{"caption": "Hello", "image_url": "https://..."}
```

---

## Common Headers

All platforms require:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

## Rate Limits

| Platform | Tweets/Day | Media/Day |
|----------|------------|-----------|
| X (Free) | 500 | Varies |
| X (Basic) | 50,000 | Varies |
| LinkedIn | ~200 | ~50 |
| Meta | ~200 | ~50 |

## File Limits

| Platform | Image Max | Video Max | Image Types |
|----------|-----------|-----------|-------------|
| X | 5MB | 512MB | PNG, JPEG, GIF, WebP |
| LinkedIn | 5MB | 200MB | JPEG, PNG, GIF |
| Meta | 8MB | 1GB | JPEG, PNG |
