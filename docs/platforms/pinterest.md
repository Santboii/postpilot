# Pinterest Platform Integration

## Overview
Pinterest uses OAuth 2.0 with Basic Auth for token exchange and their v5 API for creating Pins.

## Authentication

### OAuth Scopes
```typescript
'boards:read,boards:write,pins:read,pins:write,user_accounts:read'
```

### Token Exchange (Basic Auth)
Pinterest uses Basic Auth (client_id:client_secret) for token requests, not request body params:

```http
POST https://api.pinterest.com/v5/oauth/token
Authorization: Basic <base64(client_id:client_secret)>
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=<code>&redirect_uri=<uri>
```

### Files
- Auth initiation: `src/app/api/auth/pinterest/route.ts`
- Auth callback: `src/app/api/auth/pinterest/callback/route.ts`
- Token refresh: `src/lib/social/pinterest.ts` → `refreshPinterestToken()`

## Boards

Pinterest Pins must be posted to a Board. Fetch user's boards first:

```http
GET https://api.pinterest.com/v5/boards
Authorization: Bearer <token>
```

Response with pagination:
```json
{
  "items": [
    { "id": "123", "name": "My Board", "privacy": "PUBLIC" }
  ],
  "bookmark": "next_page_token"
}
```

## Creating Pins

### Pin with Image URL
```http
POST https://api.pinterest.com/v5/pins
Authorization: Bearer <token>
Content-Type: application/json

{
  "board_id": "123456789",
  "media_source": {
    "source_type": "image_url",
    "url": "https://example.com/image.jpg"
  },
  "title": "Pin title (max 100 chars)",
  "description": "Description (max 500 chars)",
  "link": "https://optional-link.com"
}
```

Response:
```json
{
  "id": "987654321",
  ...
}
```

### Constraints
- **Title**: Max 100 characters
- **Description**: Max 500 characters
- **Image**: Must be public URL (Pinterest fetches it)

## Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Token expired | Refresh token |
| `board_not_found` | Invalid board ID | Refetch boards |
| `image_fetch_failed` | Pinterest can't access image URL | Ensure URL is public |

## Important Notes

1. **Pins require a Board** - You must select a board to post to
2. **Image must be URL** - Pinterest fetches from URL, no binary upload
3. **Basic Auth for tokens** - Different from other platforms

## Files Reference

| File | Purpose |
|------|---------|
| `src/lib/social/pinterest.ts` | Auth, boards, create pin |
| `src/app/api/auth/pinterest/` | OAuth flow |

## Last Updated
2026-01-06
