import { defineConfig } from 'vitest/config'

const sourceAliases = {
  '@xip/audio': new URL('./packages/audio/src/index.ts', import.meta.url).pathname,
  '@xip/context': new URL('./integrations/context/src/index.ts', import.meta.url).pathname,
  '@xip/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname,
  '@xip/devtools': new URL('./integrations/devtools/src/index.ts', import.meta.url).pathname,
  '@xip/editor': new URL('./integrations/editor/src/index.ts', import.meta.url).pathname,
  '@xip/gameplay': new URL('./integrations/gameplay/src/index.ts', import.meta.url).pathname,
  '@xip/input': new URL('./packages/input/src/index.ts', import.meta.url).pathname,
  '@xip/net': new URL('./packages/net/src/index.ts', import.meta.url).pathname,
  '@xip/physics': new URL('./packages/physics/src/index.ts', import.meta.url).pathname,
  // Subpath first: Vite matches aliases by prefix, in order.
  '@xip/renderer/canvas2d': new URL('./packages/renderer/src/canvas2dRenderSystem.ts', import.meta.url).pathname,
  '@xip/renderer': new URL('./packages/renderer/src/index.ts', import.meta.url).pathname,
  // Subpaths before the bare name: Vite matches aliases by prefix, in order.
  'xipjs/advanced': new URL('./integrations/xip/src/advanced.ts', import.meta.url).pathname,
  'xipjs/render': new URL('./integrations/xip/src/render.ts', import.meta.url).pathname,
  'xipjs/test': new URL('./integrations/xip/src/test.ts', import.meta.url).pathname,
  xipjs: new URL('./integrations/xip/src/index.ts', import.meta.url).pathname,
}

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
    // Audio state lives on globalThis (so it survives HMR and <Game> remounts);
    // isolate it between tests.
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'packages/*/src/**/__tests__/**/*.test.{ts,tsx}',
      'packages/create-xip-game/templates/__tests__/**/*.test.{ts,tsx}',
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
