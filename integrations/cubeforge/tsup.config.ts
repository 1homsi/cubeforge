import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/advanced.ts'],
  format: ['esm'],
  dts: true,
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  // Bundle the @cubeforge/* workspace packages into dist (v0.8.x behaviour).
  // They are listed in package.json dependencies for monorepo ergonomics,
  // but tsup auto-externalises dependencies — without this, the published
  // package would import packages that don't exist on npm.
  noExternal: [/^@cubeforge\//],
  outExtension: () => ({ js: '.js' }),
  esbuildOptions(options) {
    options.jsx = 'automatic'
    options.jsxDev = false // production JSX → react/jsx-runtime, not react/jsx-dev-runtime
  },
  clean: true,
  sourcemap: false,
})
