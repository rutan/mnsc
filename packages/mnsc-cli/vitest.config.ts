import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/*.config.ts', '**/dist/**', '**/test/**', '**/*.test.ts', '**/*.spec.ts'],
    },
  },
});
