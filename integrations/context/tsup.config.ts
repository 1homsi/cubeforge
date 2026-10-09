import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  external: [
    '@xip/core',
    '@xip/input',
    '@xip/physics',
    '@xip/renderer',
    'react',
  ],
  outExtension: () => ({ js: '.mjs' }),
  clean: true,
  sourcemap: false,
})
