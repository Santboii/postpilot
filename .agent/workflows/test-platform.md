---
description: How to run platform publish tests to verify integrations
---

# Platform Testing

Use this workflow to test platform publishing integrations.

## Prerequisites

// turbo
1. Dev server running (`npm run dev`)

## Run All Platform Tests

// turbo
```bash
npm run test:run
```

## Run Specific Platform Tests

// turbo
```bash
# X/Twitter tests
npm run test:run -- tests/integration/publish/x.test.ts

# LinkedIn tests (when added)
npm run test:run -- tests/integration/publish/linkedin.test.ts
```

## Watch Mode (during development)

// turbo
```bash
npm test
```

Tests will re-run automatically when you save changes.

## Coverage Report

// turbo
```bash
npm run test:coverage
```

Opens a coverage report showing which code paths are tested.

## Test Structure

```
tests/
├── setup.ts                 # Environment variables, cleanup
├── utils.ts                 # Mock factories (createMockPost, etc.)
└── integration/
    └── publish/
        └── x.test.ts        # X platform tests
```

## Adding Tests for a New Platform

1. Create `tests/integration/publish/<platform>.test.ts`
2. Import utilities from `../../utils`
3. Add mock responses for the platform's API endpoints
4. Test key flows: auth, media upload, post creation

## Example Test

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createMockPost, createMockMedia } from '../../utils';

describe('Platform Publishing', () => {
  it('should upload media and create post', async () => {
    const post = createMockPost({ content: 'Test' });
    // ... test implementation
    expect(result).toBeDefined();
  });
});
```

## When to Run

- After modifying platform publish logic
- After updating API request formats
- Before deploying to production
- When debugging platform issues
