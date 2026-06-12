import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  outExtension: () => ({ js: '.mjs' }),
  clean: true,
  sourcemap: false,
})
