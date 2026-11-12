import { defineConfig } from 'vitest/config'

/**
 * Unit tests for the mobile app's PURE business-logic helpers (lib/status,
 * lib/models, lib/errors). These modules import only from @kroex/api and have
 * no React Native dependency, so they run under a plain node environment.
 * Screen components and RN-coupled modules (confirm, stream, client) are
 * verified by tsc + manual/device testing, not here.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
  },
})
