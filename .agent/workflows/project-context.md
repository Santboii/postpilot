---
description: Context and overview for the SocialsGenie social media management app
---

# SocialsGenie - Project Context

## What is SocialsGenie?
SocialsGenie is an AI-powered social media management web application that helps users create, schedule, and publish content across multiple social media platforms.

## Current Year
**2025** - All dates and references should use 2025.

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: CSS Modules with design tokens (`globals.css`)
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth
- **AI**: Google Generative AI (Gemini 2.0 Flash)
- **Deployment**: Vercel

## Supported Platforms
| Platform   | ID         | Max Length | Max Media |
|------------|------------|------------|-----------|
| X (Twitter)| `twitter`  | 280        | 4         |
| Instagram  | `instagram`| -          | 10        |
| LinkedIn   | `linkedin` | 3000       | 9         |
| Facebook   | `facebook` | 63206      | 10        |
| Threads    | `threads`  | 500        | 10        |

Platform config is in `src/types/index.ts`.

## Key Features
1. **Multi-platform posting** - Compose once, publish to multiple platforms
2. **AI Text Generation** - AI creates post content from user prompts
3. **AI Image Generation** - Create images via AI
4. **Prompt Optimization** - AI enhances brief prompts before generation
5. **Platform-specific content** - Override content per platform
6. **Brand DNA** - Store brand voice, tone, audience for consistent AI outputs
7. **Post Scheduling** - Schedule posts for future publishing
8. **Post Calendar** - Visual calendar view of scheduled content

## Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/ai/            # AI endpoints (generate, optimize-prompt, optimize, generate-image)
│   ├── api/auth/          # Auth endpoints (linkedin, etc.)
│   ├── api/publish/       # Social media publishing (linkedin, facebook, etc.)
│   ├── compose/           # Post composer page
│   ├── posts/             # Posts list/management
│   ├── calendar/          # Calendar view
│   ├── settings/          # User settings & Brand DNA
│   ├── landing/           # Marketing landing page
│   ├── privacy/           # Privacy policy
│   └── terms/             # Terms of use
├── components/
│   ├── composer/          # PostComposer.tsx - main composition UI
│   ├── layout/            # Sidebar.tsx, AppWrapper.tsx
│   └── settings/          # BrandSettings.tsx
├── contexts/              # AuthContext.tsx
├── lib/
│   ├── ai/                # google.ts - Gemini AI utilities
│   ├── supabase/          # client.ts, server.ts
│   ├── social/            # meta.ts, linkedin.ts - Social Platform APIs
└── types/index.ts         # All TypeScript types
```

## Design System (globals.css)
- **Theme**: Dark default with light mode support (`[data-theme="light"]`)
- **Primary accent**: Purple `#a855f7` (`--accent-purple`)
- **Primary gradient**: `linear-gradient(135deg, #a855f7 0%, #6366f1 40%, #ec4899 100%)`
- **Font**: Inter (Google Fonts)
- **Spacing scale**: `--space-1` (0.25rem) through `--space-16` (4rem)
- **Border radius**: `--radius-sm` (6px) through `--radius-full` (9999px)

## Key Types (src/types/index.ts)
```typescript
type PlatformId = 'twitter' | 'instagram' | 'linkedin' | 'facebook' | 'threads';
type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
type ToneType = 'casual' | 'professional' | 'promotional';

interface Post {
  id, content, platforms, status, scheduledAt?, media?, platformContent?
}

interface BrandProfile {
  brand_name, audience, tone, examples[]
}
```

## Important Files
| File | Purpose |
|------|---------|
| `src/components/composer/PostComposer.tsx` | Main content creation UI with AI popovers |
| `src/components/layout/AppWrapper.tsx` | Auth routing, public vs protected routes |
| `src/app/api/ai/generate/route.ts` | AI text generation endpoint |
| `src/app/api/ai/optimize-prompt/route.ts` | Prompt optimization endpoint |
| `src/types/index.ts` | All TypeScript types and platform config |

## Database Tables (Supabase)
- `posts` - Social media posts (content, status, scheduled_at, media)
- `brand_profiles` - Brand DNA settings per user
- `social_accounts` - Connected platforms with OAuth tokens

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_API_KEY              # Gemini AI
```

## Public Routes (no auth required)
`/landing`, `/login`, `/privacy`, `/terms`

All other routes require authentication via `AppWrapper.tsx`.

## GitHub
- Owner: **Santboii**
- Repo: **SocialsGenie** (redirects from postpilot)
