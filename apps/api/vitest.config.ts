import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each test file boots an embedded Postgres (PGlite); allow for slow CI machines.
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});
