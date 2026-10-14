# Shallow stylized water

Researched on 2026-10-14. The runtime implementation is original project code in
`packages/scene-runtime/src/stylized-water.ts`. No third-party shader code,
textures, dependencies, or runtime network requests are included.

## Primary-source references

| Project | Verified license | Useful approach | Integration decision |
| --- | --- | --- | --- |
| [boona13/threejs-grass-water-shaders](https://github.com/boona13/threejs-grass-water-shaders) | [MIT; copyright 2026 boona13](https://github.com/boona13/threejs-grass-water-shaders/blob/main/LICENSE) | Animated normal layers, procedural sky reflection, sparse shore foam; targets Three 0.170/WebGL | Compatible technical reference. Its terrain masks, noise LUT and terrain-specific wrapper are unnecessary for our authored water meshes. |
| [norio/three-stylized-water](https://github.com/norio/three-stylized-water) | [MIT; copyright 2025 MatrixRex, 2026 norio](https://github.com/norio/three-stylized-water/blob/main/LICENSE) | Translucent stylized water, shallow coloration and restrained foam | Visual reference. WebGPU/TSL renderer prevents direct use in this WebGL application without a renderer migration. |
| [martinRenou/threejs-caustics](https://github.com/martinRenou/threejs-caustics) | [BSD-3-Clause; copyright 2020 Martin Renou](https://github.com/martinRenou/threejs-caustics/blob/master/LICENSE.txt) | Separates water surface, refracted illumination and receiving surfaces | Technical reference for placing caustics on a submerged receiver. A physical refracted-light simulation and additional render passes exceed the scope of these small mobile scenes. |
| [Anime-esque Water Shader by arlez80](https://godotshaders.com/shader/anime-esque-water-shader/) | MIT, explicitly stated in the author's shader and page | Animated cellular noise with domain distortion makes procedural water patterns | Visual/algorithm reference for the Voronoi refinement. Its shader code and assets are not copied. The local implementation uses nearest/second-nearest distances, independently animated sites and derivative filtering. |
| [Absorption Based Stylized Water by Malido](https://godotshaders.com/shader/absorption-based-stylized-water/) | Published source reference; not redistributed | Water absorption, refracted receiver coordinates and distance-limited caustics | Evaluated for natural submerged illumination. Its OpenSimplex derivative implementation, screen-space refraction and reflection code are not included. |

## What ships

- A transparent Three `MeshPhysicalMaterial` retains the app's lighting,
  environment reflection and fog. Slow crossing waves animate its normals.
- A separate sandy receiver sits below the surface. Two warped Voronoi fields
  create an artistic caustic network from the nearest/second-nearest cell-distance
  gap. Bounded site motion changes the network smoothly; spatial focus modulation
  varies brightness and filament width instead of outlining every cell uniformly.
  A softer second field adds occasional overlapping light. Derivatives filter thin
  lines, and distance/pixel-footprint fades keep the horizon quiet. This is **not**
  a physical simulation, refraction pass or projected light onto arbitrary objects.
- The bed is tinted toward cool shallow water and the surface clearcoat is
  restrained, reducing the previous broad pale sheen while retaining transparency.
- Narrow broken shore highlights appear on the circular spring and basin.
- Water alpha blends over a visible bed; it does not implement optical refraction.
- All shader input is local. No HDR, normal-map or caustic texture is fetched by
  the water effect. The existing shared environment supplies lighting as before.

## Scene integration

`createStylizedWater({ geometry, normal, depth, ... })` owns the supplied geometry,
the returned `surface`, its non-interactive child `bed`, and both materials.
The default local normal is `z` for CircleGeometry; pre-rotated horizontal plane
geometry uses `normal: 'y'`. Transform the surface as usual and the bed follows.

Call `update(dt, reducedMotion)` only from the scene's existing active-frame loop.
Reduced motion holds the current phase; a suspended frame is capped to 0.1s.
`dispose()` is idempotent and removes the effect before the enclosing scene tree
is disposed. Surface topology and raycasts remain authored; the receiver does
not participate in raycasting.

The spring uses an actual hole in the shared meadow and a bed at y=-0.18. The
basin bed is y=0.06, above the shared courtyard. River beds are y=-0.24 (wreath)
and y=-0.285 (leaf float), above the shared environment ground at roughly -0.355.
The existing small leaf-float water target and all cue anchors remain unchanged.

## Voronoi refinement evidence

`artifacts/voronoi-water/` contains the before/after comparison against commit
`b82fc4c`, real canvas motion clips, production screenshots and interaction checks.
The public comparison is `production/water-audit.html`. Both the spring and river
freeze with reduced motion enabled. The effect adds no geometry, textures or draw
passes relative to the previous water implementation; its extra work is in the
receiver fragment shader. Browser checks do not establish phone GPU performance.
