# EZ Tree — offline generator

Source: https://github.com/dgreenheck/ez-tree
Pinned commit: `dcf309bd86bd521083d9c70f01f2de45fdc7c457`
Copyright Daniel Greenheck, MIT; full notice in `LICENSE`.

`tree.mjs` is an esbuild ESM bundle of `src/lib/tree.js` and its local imports, with `three` external. No textures are copied. This file is used only by `scripts/generate-tree-skeletons.mjs`; the game imports the resulting JSON and its own oval leaf geometry.

The adapter adds seeded per-limb orientation/length variation without changing this pinned bundle. Generated data includes transformed twig tangents for the game's three-dimensional leaf-spray frames.

Rebuild the bundle from the pinned upstream checkout with esbuild (`bundle: true`, `format: 'esm'`, `platform: 'node'`, `external: ['three']`). Regenerate committed tree data with:

```sh
node scripts/generate-tree-skeletons.mjs
```
