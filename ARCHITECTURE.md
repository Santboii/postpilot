# Architecture Overview
This document serves as a critical, living template designed to equip agents with a rapid and comprehensive understanding of the codebase's architecture, enabling efficient navigation and effective contribution from day one. Update this document as the codebase evolves.

## 1. Project Structure
This section provides a high-level overview of the project's directory and file structure, categorised by architectural layer or major functional area. It is essential for quickly navigating the codebase, locating relevant files, and understanding the overall organization and separation of concerns.

```
social-media-copilot/
├── src/
│   ├── app/              # Next.js App Router (Frontend Pages & Backend APIs)
│   │   ├── api/          # Backend API endpoints (Next.js Route Handlers)
│   │   ├── (auth)/       # Authentication related pages (login, etc.)
│   │   ├── (dashboard)/  # Main authenticated application pages
│   │   └── layout.tsx    # Root layout
│   ├── components/       # Reusable React components
│   │   ├── ui/           # Generic UI components (Modal, Button, etc.)
│   │   ├── composer/     # Post creation/editing specific components
│   │   ├── calendar/     # Calendar view components
│   │   └── ai/           # AI-specific UI components (Modals, Generators)
│   ├── lib/              # Shared utilities and service configurations
│   │   ├── supabase/     # Supabase client initialization (Server & Client)
│   │   └── ai/           # Google Gemini AI service wrappers
│   ├── hooks/            # Custom React hooks
│   │   └── queries/      # TanStack Query hooks for data fetching
│   ├── types/            # TypeScript definitions (DB schema, App types)
│   └── styles/           # Global styles and CSS variables
├── public/               # Static assets (images, icons)
├── supabase/             # Supabase configuration and migrations
├── .env.local            # Environment variables (API keys, secrets)
├── next.config.ts        # Next.js configuration
└── package.json          # Project dependencies and scripts
```

## 2. High-Level System Diagram

```mermaid
graph TD
    User([User]) <--> Client[Next.js Client (Browser)]
    Client <-->|API Calls| NextAPI[Next.js API Routes (Serverless)]
    Client <-->|Realtime/Auth| Supabase[Supabase (Auth & DB)]
    
    NextAPI <-->|Query/Mutate| Supabase
    NextAPI <-->|Generate Content| Gemini[Google Gemini AI]
    
    Supabase <--> Postgres[(PostgreSQL Database)]
```

## 3. Core Components

### 3.1. Frontend

**Name**: SocialsGenie Web App

**Description**: The main user interface for the Social Media Copilot. It allows users to manage their social media accounts, create and schedule posts using AI assistance, view their content calendar, and manage content libraries.

**Technologies**: 
- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **styling**: CSS Modules with global design tokens (`globals.css`)
- **State/Data Fetching**: TanStack Query
- **Icons**: Lucide React

**Deployment**: Vercel (Auto-deployed from GitHub)

### 3.2. Backend Services

#### 3.2.1. Next.js API Routes

**Name**: Backend API (`src/app/api`)

**Description**: Serverless functions that handle business logic, secure database operations, and external API integrations. Acts as a middleware between the client and third-party services like Google AI to protect API keys.

**Technologies**: Next.js Route Handlers (Node.js runtime), Supabase SSR Client, Google Generative AI SDK.

**Key Endpoints**:
- `/api/ai/*`: Handles AI content and image generation requests.
- `/api/libraries/*`: CRUD operations for content libraries.
- `/api/posts/*`: Post management.
- `/api/schedule/*`: Calendar slot management.
- `/api/auth/*`: Authentication callbacks and management.

## 4. Data Stores

### 4.1. Primary Database

**Name**: Supabase Postgres

**Type**: PostgreSQL

**Purpose**: Stores all application data including user profiles, posts, schedules, and configuration.

**Key Schemas/Tables**:
- `users`: Managed by Supabase Auth (referencing `auth.users`).
- `posts`: Core content items with status, content, and platform metadata.
- `content_libraries`: Buckets for evergreen content organization.
- `weekly_slots`: Recurring schedule slots for auto-scheduling.
- `brand_profiles`: User-defined brand voice settings (tone, audience).
- `user_settings`: User preferences (theme, default platforms).

## 5. External Integrations / APIs

### 5.1. Google Gemini AI

**Service Name**: Google Generative AI (Gemini Flash 1.5)

**Purpose**: Powers the "Copilot" features including post text generation, rewriting/remixing, and image generation.

**Integration Method**: `@google/generative-ai` SDK via Next.js API Routes.

### 5.2. Supabase

**Service Name**: Supabase

**Purpose**: Provides Authentication (Email/Password + OAuth), Database (Postgres), and Storage (for media assets).

**Integration Method**: `@supabase/ssr` and `@supabase/supabase-js`.

## 6. Deployment & Infrastructure

**Cloud Provider**: Vercel (Frontend & Serverless API), AWS (underlying Supabase infrastructure).

**Key Services Used**:
- Vercel (Hosting, Edge Network, CI/CD)
- Supabase (Managed Postgres, Auth, Storage)

**CI/CD Pipeline**: Vercel GitHub Integration (Automatic deployments on push to main).

**Monitoring & Logging**: Vercel Analytics / Logs.

## 7. Security Considerations

**Authentication**: Supabase Auth (Cookie-based session management for Next.js SSR).

**Authorization**: 
- **RLS (Row Level Security)**: Enforced at the Supabase database level. Users can only access their own data (`user_id = auth.uid()`).
- **Server-Side Checks**: API routes verify `supabase.auth.getUser()` before processing requests.

**Data Encryption**: 
- TLS in transit (HTTPS).
- Supabase manages encryption at rest for the database.

## 8. Development & Testing Environment

**Local Setup Instructions**:
1. Clone repository.
2. `npm install`
3. Copy `.env.example` to `.env.local` and add Supabase/Google API keys.
4. `npm run dev`

**Code Quality Tools**: 
- ESLint (Next.js config)
- TypeScript (Strict mode)

## 9. Future Considerations / Roadmap

- **Multi-Platform Posting**: Currently focused on content creation/scheduling. Direct API integration with social platforms (LinkedIn, X, etc.) for auto-publishing is a key next step.
- **Analytics**: Adding a dedicated analytics service/dashboard to track post performance.
- **Teams**: Upgrading data model to support multi-user organizations/teams.

## 10. Platform Integration Documentation

Detailed platform-specific implementation guides are in `docs/platforms/`:

| Platform | Documentation | Status |
|----------|--------------|--------|
| X (Twitter) | `docs/platforms/x-twitter.md` | ✅ Complete |
| LinkedIn | `docs/platforms/linkedin.md` | ✅ Complete |
| Meta (FB/IG) | `docs/platforms/meta.md` | ✅ Complete |
| TikTok | `docs/platforms/tiktok.md` | ✅ Complete |
| Bluesky | `docs/platforms/bluesky.md` | ✅ Complete |
| Pinterest | `docs/platforms/pinterest.md` | ✅ Complete |

Additional resources:
- **Troubleshooting**: `docs/TROUBLESHOOTING.md`
- **API Quick Reference**: `docs/API-QUICK-REFERENCE.md`
- **Debug Workflow**: `.agent/workflows/debug-publishing.md`

## 11. Project Identification

**Project Name**: SocialsGenie (Social Media Copilot)

**Primary Contact/Team**: [User Name] / Antigravity Agent

**Date of Last Update**: 2026-01-06

## 12. Glossary / Acronyms

- **RLS**: Row Level Security (Postgres security feature).
- **SSR**: Server-Side Rendering.
- **Evergreen Content**: Content designed to be relevant for a long time and re-posted periodically (managed via Content Libraries).
