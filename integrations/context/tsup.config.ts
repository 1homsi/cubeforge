import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  external: [
    '@cubeforge/core',
    '@cubeforge/input',
    '@cubeforge/physics',
    '@cubeforge/renderer',
    'react',
  ],
  outExtension: () => ({ js: '.mjs' }),
  clean: true,
  sourcemap: false,
})
