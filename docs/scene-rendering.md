# Scene render styles

All procedural scenes use the shared renderer in `packages/scene-runtime/src/render-style.ts`. The default `CEL_STYLE` is `toon-soft`; the cozy environment also selects that default. `packages/app/src/render-style.ts` is a re-export, not a second renderer.

## Presets

| Preset | Surfaces | Contours |
| --- | --- | --- |
| `original` | Authored scene materials and lighting | No style postprocessor |
| `toon-soft` | Five soft cel bands for diffuse subjects; smooth surroundings; authored metal and physical finishes | Restrained warm outline, strength 0.45 |
| `toon-ink` | Existing three hard cel bands | Stronger warm outline, strength 1.8 |

The shared subject pipeline uses Three.js materials, gradient textures, and pmndrs `postprocessing` for ACES tone mapping and outlines. The soft gradient has broad plateaus and narrow smooth transitions to avoid the hard, noisy band edges seen on grooves and rounded surfaces with the ink preset. Decorative water and meadow effects additionally use local GLSL, described below; they preserve their own materials through the style adapter.

The soft preset preserves `MeshPhysicalMaterial` subclasses (including clearcoat), source metal finishes at metalness 0.3 or higher, and glossy surfaces at roughness 0.4 or lower. Explicit mesh finish hints override the source material values. Transparent water and particles keep their original materials. Other opaque lit subject surfaces use `MeshToonMaterial`; the environment opts into smooth shading. This separates subject form from background detail while retaining metal and coated surface reflections.

## Per-mesh direction

Daylight environments use a high side sun, a clear blue sky, and restrained sky fill. The key light is stronger than the combined ambient, hemisphere, and secondary directional lights so that form and contact shadows remain readable. Daylight shadows use a 2048-pixel PCF map; night scenes retain their previous light directions, softer 1024-pixel shadows, and animated flame lights. The painted backdrop is separate from the HDR environment used by physical finishes.

Craft staging should follow the object: knitting sits directly on a broad worktop, shell threading uses a shallow oval tray, and paper cutting uses a thin gridded mat. These three scenes use a close overhead camera instead of repeating a miniature four-legged table and raised display board. Functional supports, such as the pottery wheel, remain part of the craft.

`mesh.userData.toonSurface` may contain:

- `color`, `simplifyMap`, `aoIntensity`: existing painted-model controls; original maps are never modified or disposed by this adapter.
- `metalness`, `roughness`: explicit physical finish values in soft mode.
- `outline: false`: omit a mesh from the contour selection, for example a thin wire or a curved bowl whose geometry already defines its edge.
- `shading: "smooth"`: keep continuous matte lighting in soft mode, used for the surrounding world. It does not disable outlines by itself or change ink mode.

Materials are temporarily swapped only while rendering, cached per mesh and restored afterward. Source color, emissive intensity, opacity and visibility remain live. The adapter owns its derived materials and gradient texture; scene-owned textures remain with the scene. Failed style passes fall back to original materials and restore renderer state.

## Compare and verify

Open the Web app with `?debug=1`, enter a scene, then open **SHADER LAB**. Switching among the three presets affects the same canvas. Overrides are local to the browser and active only in debug mode; **恢复内容默认** clears an override.

Before accepting a shared style change, compare a rounded diffuse object, flat paper/wood, a physical or metallic finish, and a lit night scene. Check the actual style label for fallback, source material restoration, transparent effects, interaction cues, mobile framing, and GPU cleanup on exit. Offline mobile export is a separate gate from device rendering; headless Chromium is not evidence of phone GPU performance.

2026-10-14 evidence: `artifacts/toon-render-audit/`. The earlier soft preset became continuous matte PBR in commit `b5598b1` on 2026-10-12; the current adjustment restores soft cel form while preserving physical finishes and the smooth environment.

The subsequent sunny daylight and work-surface comparison is in `artifacts/sunny-rendering/`, with the all-scene style and GPU audit in `artifacts/cozy-scenes/sunny-final/`.

The first environment refinement in `artifacts/garden-polish/` uses a curated CC0 Kenney Nature Kit subset. `garden-layout.ts` supplies stable edge plantings for gardens, courtyards, verandas and riverbanks. Shared geometry and instanced batches keep repeated foliage inexpensive; instances have their own disposal path. Model bounds must stay outside the central interaction space. Asset provenance and the evaluated alternatives are recorded in `assets/environments/README.md` and `LICENSE.txt`.

2026-10-14 garden validation: all 2,532 tests and the production build passed. `artifacts/cozy-scenes/garden-final/` records all 59 scenes using the soft style with no fallback, page errors or external asset requests; all 61 created WebGL contexts were released. Nine representative scenes passed layout checks at 320, 390 and 1280 pixels; four physical pointer flows completed. `artifacts/garden-polish/production/garden-audit.html` contains eight paired before/after captures.

## Water, meadow, trees and craft furniture

`stylized-water.ts` supplies four authored water surfaces: Celtic spring, Theravada basin, Slavic wreath river and Loy Krathong leaf float. A transparent physical surface uses crossing normal waves; a submerged sandy receiver draws a warped Voronoi caustic network. Two cellular fields use bounded site motion, varying filament widths, local focus and a quieter secondary layer. Derivative filtering plus distance/pixel-footprint attenuation prevent dense subpixel patterns at the horizon. The cooler bed and restrained clearcoat reduce broad whitening. This gives shallow coloration and an artistic caustic effect without an optical refraction pass. The surface retains its original hit topology, and the receiver cannot intercept raycasts. The spring has an actual opening in the common ground and path; river ground sits below the submerged beds. Water updates in each scene's existing frame loop and releases both layers on disposal.

`stylized-meadow.ts` provides a locally generated 256-pixel ground color map with broad light/dark patches and a single instanced grass batch. Two crossed, curved blades per tuft provide silhouette from different cameras. Root-to-tip color, received shadows and coherent wind bending make the meadow readable without adding an independent animation loop. Seeded placement excludes paths, water, decks and the central craft area. The blade lighting and wind approach adapts MIT-licensed boona13 shader work, with its complete license retained.

Daylight tree batches now use two CC0 KayKit Forest Nature Pack 1.0 broadleaf models. `scripts/prepare-tree-props.mjs` verifies pinned source hashes and bakes their original gradient atlas into linear vertex colors, producing four instanced wood/canopy batches at most. Canopies move by less than 0.5% of tree height while trunks stay fixed. Kenney still supplies understory plants, flowers, rocks and the original night vegetation. See `assets/environments/trees/` for exact source files and derived-data provenance.

`scene-motion.ts` connects the mounted host's current pause, visibility and reduced-motion preferences to decorative environments, including nested renderers. Meadow/tree time only advances while active; reduced motion fixes them at their resting phase, while water holds its current phase. Standalone environments default to stillness. All geometries, materials, generated textures and instance buffers remain owned by their mounted scene.

`packages/scenes/src/cozy-furniture.ts` replaces 21 functional craft tables with rounded planks, breadboard ends, restrained grain, pegs and varied support structures. This is original project geometry informed by open furniture references. Existing table footprints, contact heights, object positions and interaction anchors are preserved. Close-up knitting, shell threading and paper-cutting compositions keep their purpose-specific work surfaces.

Validation and captures for this iteration are in `artifacts/meadow-water/`; the complete scene audit is in `artifacts/cozy-scenes/meadow-final/`. The comparison page `production/meadow-audit.html` includes ten before/after pairs and three actual canvas motion clips. These are Chromium/WebGL checks, not a claim of measured phone GPU performance.

2026-10-14 meadow/water validation: all 2,546 tests and the production build passed. All 59 scenes used the soft style without fallback, page errors or external asset requests; all 61 created WebGL contexts were released and no tracked GPU resources remained. Twelve representative scenes passed layout checks at 320, 390 and 1280 pixels. Seven physical pointer flows completed, including all four upgraded water scenes. Motion captures confirmed moving water/grass and static reduced-motion samples. Independent review also checked furniture contact bounds, tree source hashes and resource ownership.

The subsequent Voronoi water comparison is in `artifacts/voronoi-water/`, with four before/after pairs and spring/river motion comparisons in `production/water-audit.html`. It replaces the earlier broad wave-derived bands while retaining the same geometry, ownership and interaction paths. Source research and implementation limits are recorded in `assets/environments/water/README.md`.

Voronoi validation: 96 runtime tests and 168 relevant scene tests passed, along with the production build. All four water scenes retained their soft style without page/console errors or external asset requests, and all four physical pointer flows completed. The focused style audit released all six created contexts with zero remaining GPU resources. Spring/river clips animate and their reduced-motion samples stay still. The comparison page passed image/video loading, playback preference, toggle and 320/390-pixel layout checks.
