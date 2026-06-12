import { defineConfig } from 'vitest/config'

const sourceAliases = {
  '@cubeforge/audio': new URL('./packages/audio/src/index.ts', import.meta.url).pathname,
  '@cubeforge/context': new URL('./integrations/context/src/index.ts', import.meta.url).pathname,
  '@cubeforge/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname,
  '@cubeforge/devtools': new URL('./integrations/devtools/src/index.ts', import.meta.url).pathname,
  '@cubeforge/editor': new URL('./integrations/editor/src/index.ts', import.meta.url).pathname,
  '@cubeforge/gameplay': new URL('./integrations/gameplay/src/index.ts', import.meta.url).pathname,
  '@cubeforge/input': new URL('./packages/input/src/index.ts', import.meta.url).pathname,
  '@cubeforge/net': new URL('./packages/net/src/index.ts', import.meta.url).pathname,
  '@cubeforge/physics': new URL('./packages/physics/src/index.ts', import.meta.url).pathname,
  '@cubeforge/renderer': new URL('./packages/renderer/src/index.ts', import.meta.url).pathname,
  '@cubeforge/renderer3d': new URL('./packages/renderer3d/src/index.ts', import.meta.url).pathname,
  cubeforge: new URL('./integrations/cubeforge/src/index.ts', import.meta.url).pathname,
  'cubeforge/advanced': new URL('./integrations/cubeforge/src/advanced.ts', import.meta.url).pathname,
}

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
    alias: sourceAliases,
    // Force all workspace packages to use the same React instance.
    // Without this, integration packages with their own node_modules/react
    // (React 18) conflict with @testing-library/react which resolves React 19
    // from the root, causing "Multiple copies of React" errors at test time.
    dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
  },
})
