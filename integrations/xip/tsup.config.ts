import { defineConfig } from 'tsup'

// JS is emitted per module by build.mjs; tsup only bundles the .d.ts files.
// @xip/* types are inlined because those packages are not published.
export default defineConfig({
  entry: ['src/index.ts', 'src/advanced.ts', 'src/render.ts', 'src/test.ts'],
  format: ['esm'],
  dts: { only: true, resolve: [/^@xip\//] },
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  noExternal: [/^@xip\//],
  clean: false,
})
