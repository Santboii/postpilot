/**
 * Vitest Test Setup
 * 
 * This file runs before each test file.
 * Use it to set up environment variables, mocks, and global test utilities.
 */

import { beforeAll, vi, afterEach } from 'vitest';

// Set test environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.X_CLIENT_ID = 'test-x-client-id';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Mock fetch globally if needed
// global.fetch = vi.fn();

// Cleanup after each test
afterEach(() => {
    vi.restoreAllMocks();
});
