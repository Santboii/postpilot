---
description: How to add extensive logging to debug platform publishing issues
---

# Debugging Platform Publishing

Use this workflow when a platform publish is failing and you need to trace the data flow.

## When to Use
- Media uploads fail with cryptic errors
- Posts publish without expected content/media
- API returns unexpected errors

## Step 1: Add Logging to PostComposer Submit

Add to `src/components/composer/PostComposer.tsx` in `handleSubmit()`:

```typescript
console.log('[Composer] ====== UPLOAD DEBUG START ======');
console.log('[Composer] selectedImages count:', selectedImages.length);
console.log('[Composer] selectedImages:', selectedImages.map(f => ({ name: f.name, size: f.size, type: f.type })));
console.log('[Composer] platformImages:', Object.keys(platformImages));
console.log('[Composer] Uploading shared media...');
const uploadedSharedMedia = await uploadFiles(selectedImages, 'Shared');
console.log('[Composer] Uploaded shared media:', JSON.stringify(uploadedSharedMedia));
// ... platform-specific uploads ...
console.log('[Composer] Creating post with media:', { mediaCount: uploadedSharedMedia.length });
```

## Step 2: Add Logging to API Route

Add to `src/app/api/publish/<platform>/route.ts`:

```typescript
console.log('[<Platform>] ====== MEDIA DEBUG START ======');
console.log('[<Platform>] Post ID:', postId);
console.log('[<Platform>] Post data:', post ? {
    hasSharedMedia: !!post.media,
    sharedMediaLength: post.media?.length,
    sharedMedia: JSON.stringify(post.media),
    platformData: JSON.stringify(post.post_platforms)
} : 'null');
console.log('[<Platform>] Query error:', queryError);

// After determining which media to use:
console.log('[<Platform>] Platform-specific media:', platformMedia?.length || 0);
console.log('[<Platform>] Shared media:', sharedMedia?.length || 0);
console.log('[<Platform>] Using media:', mediaToUpload.length);

// For each attachment:
console.log(`[<Platform>] Attachment ${index}:`, { url: media.url, type: media.type, mimeType });
```

## Step 3: Add Logging to Platform Library

Add to `src/lib/social/<platform>.ts`:

```typescript
// Before API call:
console.log('[<Platform>] Request:', {
    endpoint: url,
    method: 'POST',
    bodyPreview: JSON.stringify(body).substring(0, 200)
});

// After API call:
if (!response.ok) {
    const errorText = await response.text();
    console.error('[<Platform>] API Error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
    });
}

// On success:
console.log('[<Platform>] Success:', data);
```

## Step 4: Check Both Consoles

| Console | What to Look For |
|---------|------------------|
| **Browser** (F12 → Console) | PostComposer logs, client-side errors |
| **Terminal** (npm run dev) | API route logs, server-side errors |

## Key Things to Trace

1. **Is media being saved to the post?**
   - Check `mediaCount:` in PostComposer logs
   - Check `post.media.length` in API route logs

2. **Is platform-specific media being used?**
   - When one platform selected, media goes to `post_platforms.metadata.media`
   - Check `Platform-specific media:` vs `Shared media:` logs

3. **Is the API call formatted correctly?**
   - Check `Request:` log for correct endpoint and body format
   - Check API Error for specific error messages

4. **Is the token valid?**
   - 401/403 errors usually mean token issue
   - Check `token_expires_at` in database

## Common Root Causes

| Symptom | Likely Cause |
|---------|--------------|
| `mediaCount: 0` in PostComposer | Files not in `selectedImages` state |
| `sharedMediaLength: 0` in route | Single platform → check `platformData` instead |
| API returns 400/403 | Wrong request format or missing scope |
| API returns 401 | Token expired, trigger refresh or reconnect |

## Cleanup

After debugging, search for `====== DEBUG` and remove logging blocks:
```bash
grep -r "DEBUG START" src/
```
