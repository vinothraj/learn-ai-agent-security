import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each test file boots an embedded Postgres (PGlite); allow for slow CI machines.
    hookTimeout: 60_000,
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/db/migrate-cli.ts'],
      reporter: ['text-summary', 'html'],
      // Floors just under the measured levels so coverage can only go up.
      thresholds: { lines: 82, functions: 80, branches: 68, statements: 80 },
    },
  },
});
