import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Fixtures are deliberately broken test files that test-critic analyses.
    // They must never be executed by our own test runner.
    exclude: ['test/fixtures/**', 'node_modules/**', 'dist/**'],
  },
});
