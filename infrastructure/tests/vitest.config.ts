import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'infrastructure',
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    globals: true,
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.config.ts'],
    },
  },
});
