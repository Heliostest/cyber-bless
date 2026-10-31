# Soft 3D Scene Icons Implementation Plan

> **For agentic workers:** Use the existing parallel assignments for assets, integration, and processing; preserve unrelated working changes.

**Goal:** Replace all 158 existing ritual icons with the approved soft 3D visual family.
**Architecture:** Per-subject built-in image generation, transparent PNG originals, normalized 256px WebP assets, shared SceneIcon rendering and existing cross-platform asset pipeline.
**Tech Stack:** React, Vite, Expo DOM, Node, existing sharp, Vitest.
**Spec:** `docs/superpowers/specs/2026-10-31-soft3d-scene-icons-design.md`

## Global Constraints

- No scene ID, save, engine, material identity, source or cultural-claim changes.
- Preserve all unrelated user changes and the Animal Island shell.
- No new dependencies; all known icons and historical IDs are covered.

## Review Focus

- Missing or failed image: unknown ID and failure keep a decorative leaf fallback.
- Metro versus Vite: generated resources must be packaged for both, including offline.
- Tiny image slots: retain current dimensions without shape clipping or excessive details.
- Object identity/state: one-eyed daruma, closed omamori, glass bell and paper objects stay correct.
- Transparency: no baked checkerboard, labels, card backgrounds or opaque edge halo.

### Task 1: Inventory and assets

- [x] Record all 158 IDs, titles, current-object descriptions and visibility in `assets/scene-icons/soft3d/subjects.json`.
- [x] Generate and visually inspect separate transparent assets using the approved reference.
- [x] Normalize with `scripts/prepare-scene-soft3d-icons.mjs`, retaining originals and generation records.
- [x] Verify every expected file, dimensions and alpha; assemble review contact sheets.

### Task 2: Shared component and packaging

- [x] Update relevant existing tests to assert image coverage, decorative semantics and unknown-ID behavior; observe the old implementation fail meaningful new behavior.
- [x] Replace the shared SVG presentation with soft3d assets; retain sizing and fallback.
- [x] Update existing asset-copy packaging and consumers/tests that assumed an SVG path.
- [x] Run App tests and production build.

### Task 3: Review and delivery

- [x] Check mobile pages and representative glass/wood/paper/fabric objects.
- [x] Review generated object identity against existing presentation separately from technical tests.
- [x] Record scope, source-impact checklist and verification in `docs/research/2026-10-31-soft3d-scene-icons.md`.
- [x] Deliver screenshots and report any genuine limitations without claiming unverified completion.
