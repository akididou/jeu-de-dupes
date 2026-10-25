import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['js/search.js', 'js/data.js', 'js/format.js', 'js/idle.js', 'js/route.js'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
