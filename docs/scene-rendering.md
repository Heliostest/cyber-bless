# Scene render styles

All procedural scenes use the shared renderer in `packages/scene-runtime/src/render-style.ts`. The default `CEL_STYLE` is `toon-soft`; the cozy environment also selects that default. `packages/app/src/render-style.ts` is a re-export, not a second renderer.

## Presets

| Preset | Surfaces | Contours |
| --- | --- | --- |
| `original` | Authored scene materials and lighting | No style postprocessor |
| `toon-soft` | Five soft cel bands for diffuse subjects; smooth surroundings; authored metal and physical finishes | Restrained warm outline, strength 0.45 |
| `toon-ink` | Existing three hard cel bands | Stronger warm outline, strength 1.8 |

The shared pipeline uses Three.js materials, gradient textures, and pmndrs `postprocessing` for ACES tone mapping and outlines. It does not ship application-authored GLSL. The soft gradient has broad plateaus and narrow smooth transitions to avoid the hard, noisy band edges seen on grooves and rounded surfaces with the ink preset.

The soft preset preserves `MeshPhysicalMaterial` subclasses (including clearcoat), source metal finishes at metalness 0.3 or higher, and glossy surfaces at roughness 0.4 or lower. Explicit mesh finish hints override the source material values. Transparent water and particles keep their original materials. Other opaque lit subject surfaces use `MeshToonMaterial`; the environment opts into smooth shading. This separates subject form from background detail while retaining metal and coated surface reflections.

## Per-mesh direction

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
