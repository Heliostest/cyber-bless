# Toon Water source record

- Original title: **Water Toon Torrent**.
- Original author: Leon Denise; the archive metadata uses `leon`.
- Original source: https://www.shadertoy.com/view/dlScDt
- Original embedded date: 2023/08/19.
- Local archive read on 2026-11-04: `D:/ws/art/shader/shader-gallery/src/cases/Water Toon Torrent/image.glsl`, its `ATTRIBUTION.md`, and the Three.js adaptation `src/three-materials/water-material.js` plus `src/cases/three-toon-water/{ATTRIBUTION.md,docs/usage.md}`.
- Gallery repository HEAD at inspection: `1513a483a35f8e8ce1d03388638f93f3c6643e8d` (the file hash below identifies the actual read input).
- Adaptation input SHA-256: `d9124db6fd5e7ddd3750efc9df9c2e39eb56a198880cfa8ebde44683aa74ffa6`.
- Archived original GLSL SHA-256: `8b60aaec243e4ccf91b615c77a32f9062518b53adfc76eb2eb6115c7e57b08aa`.

The Gallery adaptation retains the original six-octave gyroid/fbm field, moving phase, alternating depth bands and stepped foam colors on mesh UVs. Cyber Bless ports that pattern locally into `toon-water-material.ts`; it adds optional local XZ projection for geometry without UVs, authored-opacity handling and Three.js fog. It disables Gallery's optional vertex displacement to preserve the authored water level and interaction geometry. Time comes from the existing scene lifecycle; no new animation loop is created.

**License status:** the archived original contains no explicit license grant. Neither the archive nor this adaptation asserts additional redistribution rights or invents a license. Retain the original attribution and this status. On 2026-11-04 the original Shadertoy URL failed to open through the web tool; it is **not** recorded as read or as a newly verified license grant. The implementation was inspected against the supplied local Gallery archive.

The persistent `@license` comment preserves the attribution/status in compiled shader code. A matching notice is included in `assets/environments/LICENSE.txt`, distributed by the existing Web/Expo asset preparation step. Existing original shallow-water shaders keep their own project authorship; the Toon Water pattern is a separate third-party-derived debug alternative.
