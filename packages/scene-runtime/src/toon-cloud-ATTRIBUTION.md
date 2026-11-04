# Toon Cloud background attribution

- Original work: **Toon Cloud**, AntoineC / Antoine Clappier, March 2015.
- Original URL: https://www.shadertoy.com/view/4t23RR
- Original license: **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**, https://creativecommons.org/licenses/by-nc-sa/4.0/
- Local source read: `D:/ws/art/shader/shader-gallery/src/three-materials/toon-cloud-material.js`, `toon-cloud-scene.js`, `src/cases/three-toon-cloud/ATTRIBUTION.md`, and the archived `src/cases/Toon Cloud/image.glsl` notice.
- Adaptation: [toon-cloud-backdrop.ts](toon-cloud-backdrop.ts), Cyber Bless, 2026-11-04.

The cloud contour shader and its adaptation remain under CC BY-NC-SA 4.0. This is a separately licensed component, not a grant under the surrounding project's general CC BY notice. Commercial use requires separate permission. Distribution of this adaptation must retain credit, the license link, this change notice and the same license. No endorsement by the original author is implied.

The original `Func`, `FuncR` and `Layer` disk contours and layer-specific phases are retained. Shader Gallery supplied the separated Three.js plane adaptation. Cyber Bless changes their distant placement and sky depth, daylight palette, opacity, edge softness and drift speed; integrates its existing motion/lifecycle handling; and disables cloud raycasting. Three.js and the surrounding application are not relicensed by this notice.

Viewport update (2026-11-04): the cloud beauty pass uses six clip-space sky quads and CPU fitting of the visible softened contour; the initial 72-CSS-pixel upper inset was subsequently tightened to 48 at the user's request. Layer offsets and pixel-based softness are adjusted. Conservative distant world positions remain for auxiliary depth/outline passes. These are additional Cyber Bless changes under the same license. See `docs/research/2026-11-04-toon-cloud-viewport-anchor.md`.

Layer-depth update (2026-11-04): fit each layer's softened crest to an ordered CSS-pixel offset, use independent blue-to-white colours, increase opacity towards the near layers and reduce near-edge softness. Original circular contour functions and layer-dependent phases/speeds remain. These local modifications retain the same license. Evaluation is recorded in `docs/research/2026-11-04-toon-cloud-layer-depth.md`.

Airy-layout update (2026-11-04): stretch cloud contours horizontally by 1.35 with matching CPU fitting bounds, brighten the layer palette and slightly reduce opacity. The 48-CSS-pixel top inset, vertical scale and layer intervals remain. Changes are recorded in `docs/research/2026-11-04-toon-cloud-airy-layout.md` and retain the same license.

Clarification (2026-11-04): restore the original horizontal contour scale and phase speed; spread layer crests vertically at relative CSS offsets 0,22,45,69,94,120. The 48-pixel top inset, clearer palette and atmosphere remain. The preceding horizontal stretch is a superseded local experiment, not the current implementation. These changes retain the same license.

Distribution: a persistent `@license` block is retained in the compiled shader module. The same credit, source/license links and change notice are included in `assets/environments/LICENSE.txt`, which the asset preparation script copies into both Web and Expo public assets and their asset manifests. Repository-only Markdown is not the distribution notice.

Luminous-motion update (2026-11-04): supply blue-to-white daylight radiance per layer before the existing ACES mapping, increase drift by 2.75 times and add up to 1.25 CSS pixels of sinusoidal breathing to the inner five bands. The outermost crest, horizontal scale, original contour functions, lifecycle and motion preferences remain. These local modifications retain the same license; see `docs/research/2026-11-04-toon-cloud-luminous-motion.md`.

Project intent: on 2026-11-04 the developer explicitly confirmed that this first publicly released app will remain permanently free, with no paid unlock. `store/ios/content-rights.json` has been updated to supersede its earlier paid-unlock plan. The cloud component retains its original noncommercial license; this clarification does not relicense it or grant commercial rights.

Verification on 2026-11-04: the local sources and their embedded license were read. Creative Commons' official license summary was readable (Attribution, NonCommercial, ShareAlike and license-change notice requirements). The original Shadertoy page failed to fetch with HTTP 402; it was **not** recorded as read. This import relies on the local archived work and its original notice, not a newly verified grant from that page.
