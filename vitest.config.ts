import { defineConfig } from 'vitest/config'

// Two kinds of tests:
//   src/**   plain unit tests (node)
//   convex/** backend functions, run in the Convex-like edge runtime via convex-test
export default defineConfig({
  test: {
    projects: [
      {
        test: { name: 'lib', include: ['src/**/*.test.ts'], environment: 'node' },
      },
      {
        test: {
          name: 'convex',
          include: ['convex/**/*.test.ts'],
          environment: 'edge-runtime',
          // Convex Auth checks token issuers against this; any URL works in tests.
          env: { CONVEX_CLOUD_URL: 'https://stallo-test.convex.cloud', SMS_TEST_MODE: 'true' },
          server: { deps: { inline: ['convex-test', '@convex-dev/auth', '@convex-dev/rate-limiter'] } },
        },
      },
    ],
  },
})
