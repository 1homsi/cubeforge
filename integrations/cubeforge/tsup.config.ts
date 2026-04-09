import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/advanced.ts'],
  format: ['esm'],
  dts: true,
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  outExtension: () => ({ js: '.js' }),
  esbuildOptions(options) {
    options.jsx = 'automatic'
    options.jsxDev = false  // production JSX → react/jsx-runtime, not react/jsx-dev-runtime
  },
  clean: true,
  sourcemap: false,
})
