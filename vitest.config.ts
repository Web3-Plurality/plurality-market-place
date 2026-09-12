import { defineConfig } from 'vitest/config';

// Standalone config so the React / node-polyfill plugins in vite.config.ts
// don't get pulled into pure-logic unit tests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
