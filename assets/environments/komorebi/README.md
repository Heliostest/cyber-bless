# Komorebi environment snapshot — 2026-11-06

Direct reuse of the user's local `komorebi` project. `source-manifest.json` identifies the actual copied file bytes with SHA-256. The snapshot was taken from a working tree; its Git HEAD is context, not a claim that those bytes were committed there. Cyber Bless does not import the neighbouring checkout.

- `source/src/meadow-grass.ts` and `meadow-field.ts`: original ribbon geometry, growth/pigment noise and instance tint, reused in `packages/scene-runtime/src/komorebi/`. The only meadow source adaptations replace the layout import with its two renderer-free definitions and remove `.ts` import extensions.
- `source/src/leafy-tree.ts`, tree skeleton JSON and generator: original Komorebi oval leaves, branched trunks and baked canopy light. The skeleton generator uses pinned MIT EZ Tree `dcf309bd86bd521083d9c70f01f2de45fdc7c457`; complete notice and source are preserved under `source/scripts/vendor/ez-tree/`.
- `source/src/tree-wind.ts`: original GPU wave/flutter values, adapted to Three.js color, directional-depth and point-distance materials in `komorebi-tree-wind.ts`.
- `source-manifest.json` also records the copied source lighting/curve parameters. Runtime `komorebi/color-curves.json` contains the three uniform vectors evaluated by the locally installed Babylon `ColorCurves` class with those parameters. Babylon's notice and Apache 2 license are included here and in both app asset bundles. No Babylon runtime dependency is added.

Run from the Cyber Bless root:

```sh
node scripts/prepare-komorebi-trees.mjs
node scripts/prepare-komorebi-trees.mjs --check
```

The exporter evaluates the frozen leaf generator with an offline immutable math adapter and existing TypeScript/Three.js tools. It exports source variants 0 (round) and 3 (asymmetric crown) into `../trees/komorebi/{round,cluster}.glb`, using the source's lower-detail 140 sprays for both hosts. The complete six-variant skeleton snapshot is retained. Mesh shape, authored normals, pigment and leaf wind anchors are preserved. Vertex floats retain the source's legacy pigment values. The runtime adapter clamps diffuse illumination before multiplying those pigments, then performs the source StandardMaterial's explicit `toLinearSpace` conversion after lighting; raw pigment floats must not be mistaken for linear PBR albedo.

Host adaptations: existing garden/workbench/river masks with full tuft clearance, local instancing, reversible tone treatment, existing camera-aware under-tree composition, softer shadows, paused/reduced-motion clock, and explicit ownership/disposal. `komorebi-surface.ts` uses a matte Phong adapter to the source diffuse response, without PBR sky reflection; source materials remain intact across visual styles. Komorebi daylight uses the source .64 sky / 1.12 sun strengths with Three.js's Lambert normalization, its actual sky direction, and no ACES or extra host light softening. The post effect applies source exposure, contrast and curves, then converts display RGB to the host composer's linear sRGB exactly. Night retains the host night lights and ACES with reduced curve strength. Different cameras, fog, mesh detail and composition mean this is not a pixel-identical scene port. No real-world botanical identity, location or cultural role is asserted.

`reference-colors.json` records eighteen real Babylon renderer samples: three tree pigments and three grass pigments under up, side and downward normals, with specular/shadows/fog disabled to isolate the color pipeline. Captured on 2026-11-06 from the current local Komorebi shader and main.ts settings. `node scripts/verify-komorebi-colors.mjs` tests both original and toon-soft host paths against these fixed samples; current maximum channel error is 1/255, with a 2/255 regression tolerance. This measures this controlled case, not whole-scene similarity or performance. No neighbouring checkout or Babylon runtime is required for the regression.

Current behavior and visual evidence: [integration record](../../../docs/research/2026-11-06-komorebi-environment.md).
