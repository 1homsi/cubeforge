import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  external: ['@cubeforge/core'],
  outExtension: () => ({ js: '.js' }),
  clean: true,
  sourcemap: false,
})
