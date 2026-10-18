import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      reporter: ['text-summary', 'html'],
      // Floors just under the measured levels so coverage can only go up.
      thresholds: { lines: 80, functions: 75, branches: 65, statements: 75 },
    },
  },
});
