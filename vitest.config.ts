import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        // Use jsdom for DOM testing
        environment: 'jsdom',
        // Enable global test functions (describe, it, expect)
        globals: true,
        // Setup file for environment config
        setupFiles: ['./tests/setup.ts'],
        // Test file patterns
        include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
        // Exclude node_modules
        exclude: ['node_modules', '.next'],
        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.ts', 'src/**/*.tsx'],
            exclude: ['src/**/*.d.ts'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
