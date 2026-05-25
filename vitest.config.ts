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
  resolve: {
    // Force all workspace packages to use the same React instance.
    // Without this, integration packages with their own node_modules/react
    // (React 18) conflict with @testing-library/react which resolves React 19
    // from the root, causing "Multiple copies of React" errors at test time.
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
})
