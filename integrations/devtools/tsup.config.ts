import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  outExtension: () => ({ js: '.mjs' }),
  clean: true,
  sourcemap: false,
})
