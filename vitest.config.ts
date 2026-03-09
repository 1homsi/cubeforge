import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
    include: [
      'packages/*/src/**/__tests__/**/*.test.{ts,tsx}',
      'packages/create-cubeforge-game/templates/__tests__/**/*.test.{ts,tsx}',
      'integrations/*/src/**/__tests__/**/*.test.{ts,tsx}',
    ],
  },
})
