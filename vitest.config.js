import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.{test,spec}.js'],
    globals: true,
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: [
        'src/**/__tests__/**',
        'src/fingerprint/**',
        'src/inject/**',
        'src/manifest.json',
      ],
    },
  },
});
