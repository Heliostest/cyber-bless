# Gallery visual styles implementation plan

> **For agentic workers:** use the writing-plans, test-driven-development and verification-before-completion workflows. Implementation is split between the existing preference/menu model, a surface adapter and the central renderer.

**Goal:** make eight general-purpose Gallery effects selectable in cyber-bless, with live previews, parameters and existing per-scene/global persistence.

**Architecture:** extend the existing single visual-style preset model. Keep Three r170, the existing postprocessing composer and the shared render entry point. Clone eligible authored materials temporarily and preserve original materials between frames; reuse subject-only normal/depth passes for ink and rim effects.

**Tech stack:** TypeScript, Three.js r170, postprocessing, React, Vitest, Playwright.

## Design and constraints

The user requested selectable Gallery surface and postprocessing shaders. Existing preset infrastructure already owns persistence, previews, cancellation, scope and fallback. Independent surface/postprocessing combinations would require a larger save/menu contract; this first integration adds presets. This is the implementation choice stated in chat, subject to user steering.

New presets: `gallery-toon`, `pencil-hatch`, `height-palette`, `normal-palette`, `sketch-contour`, `gallery-outline`, `space-grade`, `depth-rim`.

Water, fire and layered Egyptian/cloud backgrounds need purpose-built geometry/UVs. Do not insert their demonstration geometry into rituals. The cloud adaptation explicitly retains CC BY-NC-SA; other Gallery attribution records do not grant redistribution of original shaders. Implement general visual algorithms independently in the existing pipeline, without copying their shader source or textures.

Preserve existing uncommitted work. No dependency upgrades, scene geometry, ritual actions, completion conditions, titles, source assignments or traditional-material claims are introduced. Optional palettes and paper/ink styling are product visual expressions. Reference the existing [culture audit](../../research/2026-10-19-scene-culture-audit.md) and [optics record](../../research/2026-10-28-ritual-optics-integration.md); these technical changes do not establish cultural evidence.

## Review focus

- Transparent/transmissive/cutout and custom shader materials retain their authored rendering.
- Mapped, vertex-colored, double-sided and grouped materials retain their authored data and source animation.
- Repeated switching, removed meshes, cancellation and disposal release only adapter-owned resources.
- Normal/depth edges obey scene occlusion and exclude decorative backgrounds.
- CSS/DPR sizes, output transfer, fallback and preview restoration stay consistent with the host.

## Task 1: preferences and menu

- [x] Add failing tests for eight IDs, parameter normalization, old saves and per-scene/global restoration.
- [x] Extend core choices, content parser, menu order and localization with the agreed IDs/controls.
- [x] Run core/content/App tests and i18n validation.

## Task 2: surface adapters

- [x] Add lifecycle and authored-material preservation tests, run them red.
- [x] Add `gallery-surfaces.ts`: `isGallerySurfaceStyle`, `gallerySubjects`, `createGallerySurfaces` with `setParameters`, `apply`/`restore`, and idempotent `dispose`.
- [x] Independently implement quantized light/rim, world-space pencil hatching, normalized height and normal palettes through native material compile hooks.
- [x] Run surface tests and real WebGL compilation in representative scenes.

## Task 3: effects and shared renderer

- [x] Add failing integration tests for Gallery pass selection, parameters, restoration and fallback.
- [x] Add `gallery-effects.ts` using the existing Effect API: paper/ink contour, normal/depth outline, directional depth rim, soft diffusion/vignette/static grain.
- [x] Integrate only the active preset in `render-style.ts`, retaining the existing ACES/output pipeline and subject-only normal pass.
- [x] Run runtime tests, full project tests/build and browser checks for all new presets, cancellation, save/reload, transparent objects and native-sized previews.

## Task 4: review and delivery

- [x] Independently review the new modules and preference/menu integration; resolve actionable issues.
- [x] Record final technical results and cultural-impact checklist in `docs/research/2026-10-28-gallery-visual-styles.md`.
- [x] Report available choices and the specialized-geometry effects deferred from this general preset integration.

## Completion evidence

Full `npm.cmd test`, production build, 45/45 actual WebGL renders and the 16-thumbnail App flow passed. The independent review's two material-selection/cache findings were fixed with RED→GREEN tests. Actual WebGL found a reserved GLSL identifier; the final fresh run confirms its fix. See the linked research record and `artifacts/gallery-visual-styles-2026-10-28/report.json` for the final results. Existing uncommitted work was preserved; no changes were committed or published by this task.
