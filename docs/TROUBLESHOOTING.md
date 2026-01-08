# Platform Integration Troubleshooting Guide

Quick reference for common platform integration issues and their solutions.

## General Debugging Strategy

1. **Add logging** - Use `/debug-publishing` workflow
2. **Check both consoles** - Browser (F12) AND Terminal
3. **Read error messages carefully** - They often tell you exactly what's wrong
4. **Trace the data flow** - From UI → Database → API → Platform

## Media Not Uploading

### Symptom: `mediaCount: 0` in logs

**Check 1**: Is the file in `selectedImages` or `platformImages`?
- Single platform selected → Images go to `platformImages[platform]`
- Multiple platforms selected → Images go to `selectedImages` (shared)

**Check 2**: Is the API route checking both locations?
```typescript
const platformMedia = metadata?.media;  // Check this first
const sharedMedia = post.media;         // Fallback
```

### Symptom: Media uploads but not attached to post

**Check**: Is the `media_ids` array being passed to the post creation?
```typescript
// X example
const body = {
  text: content,
  media: { media_ids: mediaIds }  // ← Is this populated?
};
```

## API Errors

### 400 Bad Request

**Common causes**:
| Error Detail | Solution |
|--------------|----------|
| `is not defined in schema` | Wrong API version format (v1.1 vs v2) |
| `is missing but required` | Missing required field in request body |
| `Content-Type` issues | Check if JSON or FormData expected |

### 401 Unauthorized

**Token expired or revoked**:
1. Check `token_expires_at` in `social_accounts` table
2. Try refreshing token programmatically
3. If refresh fails, user needs to reconnect account

### 403 Forbidden

**Usually scope or permission issue**:
1. Check OAuth scopes in auth flow
2. User may need to disconnect and reconnect
3. Some features require paid API tier

### 429 Rate Limited

**Too many requests**:
1. Implement exponential backoff
2. Check platform rate limits
3. Consider caching or request batching

## Platform-Specific Issues

### X (Twitter)
- **v2 uses JSON, not FormData** for image uploads
- **`media.read` is NOT a valid scope** - only use `media.write`
- See: `docs/platforms/x-twitter.md`

### LinkedIn
- OAuth requires specific redirect URI format
- Uses `urn:li:person:` format for author ID
- See: `docs/platforms/linkedin.md` (TODO)

### Meta (Facebook/Instagram)
- Requires Business Account for Instagram
- Uses Graph API with page-level tokens
- See: `docs/platforms/meta.md` (TODO)

## Database Issues

### Platform not showing as connected
Check `social_accounts` table:
```sql
SELECT * FROM social_accounts 
WHERE user_id = '<user_id>' AND platform = '<platform>';
```

### Token not refreshing
Check token expiry and refresh token presence:
```sql
SELECT platform, token_expires_at, refresh_token IS NOT NULL as has_refresh
FROM social_accounts WHERE user_id = '<user_id>';
```

## Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| Media not found | Check `post_platforms.metadata.media` |
| Wrong API format | Check platform docs for v2 vs v1.1 |
| Token expired | Disconnect and reconnect account |
| Scope missing | Update scopes in auth route, reconnect |
| Rate limited | Wait and retry with backoff |
