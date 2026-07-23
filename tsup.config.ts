import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['index.ts', 'operators/index.ts'],
  format: ['esm'],
  // Bundle the canonical operator registry INTO the dist (see
  // operator-arity.ts — runtime resolution breaks either the plain-node or
  // the browser consumer class).
  noExternal: [/@almadar\/std\/canonical-operators\.json$/],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
});
