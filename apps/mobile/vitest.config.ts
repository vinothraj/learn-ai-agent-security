import { defineConfig } from 'vitest/config';

// Pure-logic tests only (no React Native runtime): theme contrast, routing guards, helpers.
export default defineConfig({
  // The app tsconfig extends expo/tsconfig.base via package exports, which the transformer can't
  // resolve; these tests need no tsconfig settings.
  oxc: { tsconfig: false } as Record<string, unknown>,
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
