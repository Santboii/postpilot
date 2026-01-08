# SocialsGenie Project Instructions

## Project Overview
SocialsGenie is an AI-powered social media management app built with Next.js 16, React 19, Supabase, and Google Gemini AI. It helps users create, schedule, and publish content across multiple platforms (Twitter/X, Instagram, LinkedIn, Facebook, Threads).

## Imperative Rules
- Always verify file paths and content within the provided context before making assertions.
- If information is missing, state the limitation clearly instead of assuming or hallucinating details.
- Ensure all generated code and logic are strictly grounded in the provided codebase context.
- Make use of context7 when in doubt
- Create workflows when you deem it worth it. Make sure to ask the user for permission before creating a workflow however.

## Current Year
**2026** - Use this for all dates and references.

## Tech Stack
Check `package.json` for current versions:
- Next.js (App Router)
- React
- TypeScript
- Supabase (auth + database)
- Google Generative AI (Gemini)
- CSS Modules with design tokens

## Key Directories
- `src/app/` - Next.js pages and API routes
- `src/components/` - React components
- `src/lib/` - Utilities (ai, supabase, social)
- `src/types/index.ts` - All TypeScript types

## Code Patterns

### Client Components
```tsx
'use client';
import styles from './Component.module.css';
export default function Component() { ... }
```

### API Routes
```typescript
// 1. Auth check first
const { data: { user }, error } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
// 2. Parse request, validate
// 3. Execute logic
// 4. Return NextResponse.json()
```

### Scheduler Logic
- **Drag & Drop**: Uses `@dnd-kit` (Core + Utilities).
- **Optimistic UI**: 
  - Update `useQuery` cache immediately via `queryClient.setQueryData`.
  - Do NOT trigger immediate refetch on success (prevents "teleporting" / stale data overwrite).
  - Only refetch on error to rollback.
  - Use `DragOverlay` with captured width to prevent visual resizing during drag.

### State Management
- **React Query**: Primary server state manager.
- **Optimistic Updates**: Use `setQueryData` for instant mutations where the "single source of truth" latency is unacceptable (e.g., drag and drop).

### Linting Compliance:
Address linting issues immediately as they arise during code modification. Do not leave new lint errors unresolved.

### Styling
Use CSS Modules with design tokens from `globals.css`:
- Colors: `var(--accent-purple)`, `var(--text-primary)`
- Spacing: `var(--space-1)` through `var(--space-16)`
- Radius: `var(--radius-sm)` through `var(--radius-full)`

## Documentation Links
When implementing features, consult the official docs for the versions in package.json:
- Next.js: https://nextjs.org/docs/app
- Supabase: https://supabase.com/docs/reference/javascript
- Gemini AI: https://ai.google.dev/gemini-api/docs

## Important Context Files
- `.agent/workflows/project-context.md` - Detailed project architecture
- `.agent/rules.md` - Coding conventions and patterns
