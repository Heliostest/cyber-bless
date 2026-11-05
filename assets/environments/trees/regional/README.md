# Regional tree debug assets: Jogoss cherry

**Archived comparison, 2026-11-05:** the user subsequently selected Just a simple tree for all specialty forms. This model is no longer selectable or bundled by either host. The source files, provenance and original CC BY 4.0 notice remain intact as a historical record. Current cherry resources and their separate MIT source adaptation are documented in [../simple-tree/README.md](../simple-tree/README.md).

`cherry.glb` is derived from **Sakura Tree 01 - Low Poly Model**, by **Jogoss** (`thejogoss9`), under **CC BY 4.0**. This is a new, independently attributed source, not a Quaternius model or a recolored generic broadleaf tree. It is for the user-authorized **debug preview only**; adding the file does not change scene defaults, subjects or cultural-source bindings.

- Original creator model: <https://sketchfab.com/3d-models/sakura-tree-01-low-poly-model-147ae7d0d332456a99ec6195e9b0cd4f>
- Author: <https://sketchfab.com/thejogoss9>
- License: <https://creativecommons.org/licenses/by/4.0/>
- Shipped attribution and adaptation notice: [LICENSE.txt](LICENSE.txt). Keep the author, original-model link and license available in the product wherever this debug asset is selected or shared. The host provides the visible attribution link.
- Exact retrieval, fixed mirror commit, original filenames, Git blob identities and SHA-256: [source-manifest.json](source-manifest.json).

## Reproduce

From the repository root with locked dependencies installed:

```sh
node scripts/prepare-regional-trees.mjs
node scripts/prepare-regional-trees.mjs --check
```

Default preparation is offline. It verifies all retained source and evidence hashes, checks creator/CC-BY identity against the original public API snapshot, preserves the complete original geometry binary, embeds resized textures and writes `validation.json`. `--check` regenerates the GLB and license in memory and compares them with the delivered files. `--download` re-fetches the five exact source files from the fixed mirror commit and refuses differing hashes; the original API/preview evidence snapshots remain pinned.

| Runtime file | Vertices | Triangles | Materials / meshes | GLB size |
| --- | ---: | ---: | ---: | ---: |
| `cherry.glb` | 7,748 | 7,007 | 2 / 2 | 683,924 bytes |

The official API's 7,007 faces agree exactly with the delivered triangle count. The API reports 7,262 vertices; the distributed glTF has 7,748 attribute vertices, including seams/attribute splits. We retain its original vertex layout. Branches account for 4,847 triangles; blossom cards account for 2,160 triangles. One authentic tree file supports both runtime variation keys through placement rotation/scale; no duplicate model files are needed.

## Appearance and preparation

The creator preview, original blossom texture and a real local Three.js render were inspected. The model has a spreading, irregular branch skeleton with twig-like flower cards carrying identifiable stylized five-petal blossoms and stamens. It is not merely an oak canopy colored pink. This establishes the creator's intended flowering-cherry depiction, not an independently certified botanical cultivar or species identification.

- Complete original `scene.bin` bytes are retained at the start of the GLB binary, with all original positions, normals, indices, four UV sets and mesh names. Original node transforms are also retained. There is no decimation, procedural substitution, recoloring or recomputed normal. Source height is about `0.4172` in its exported units; the host grounds and normalizes bounds.
- Bark source PNG `1024×2048` is resized with Lanczos3 to `256×512` and encoded JPEG quality 85, 4:4:4. Original blossom RGBA `1024×1024` is resized with Lanczos3 to `512×512` and encoded PNG. Both originals remain unmodified under `source/jogoss/`.
- Source bark material remains opaque/double-sided. Original blossom material `Sakura_Mat` is **BLEND**; the exported material deliberately uses **MASK 0.3**, double-sided, for reliable instancing, depth and shadow cutouts. This adaptation is recorded in the shipped license. The blossom image retains alpha 0–255, including 220,175 fully transparent and 30,343 fully opaque pixels at 512px. No RGB or alpha silhouette is substituted.
- The loaded GLB has two standard PBR materials, both color maps correctly marked sRGB, normals on both meshes and no external texture/decoder dependencies. There is no supplied normal map or vertex AO/color attribute in this source; authored geometric normals remain intact.
- The host's lighting, wind and shadow policy are separate product adaptations. Phone frame rate and transparent-card fill cost require the host's device tests; source triangle count alone does not prove performance.

`render-validation.json` records real Three.js 0.170 GLTFLoader/WebGL results: two orientations of the same file, both meshes and masks loaded correctly, five draws / 14,016 triangles including the two-triangle ground, no page errors. [preview.png](preview.png) is the inspected rendering; [preview.html](preview.html) can be served from the repository root to repeat it.

## Retrieval evidence and scope

Checked 2026-11-05. Sketchfab's model webpage returned **403** to the browsing tool and is not recorded as read. The Blender/Sketchfab connector was unavailable because Blender was not connected. The original creator's **public Sketchfab API JSON was actually fetched and read**, confirming title, author Jogoss, model UID, cherry description, CC Attribution 4.0, commercial-use/attribution terms, downloadable status, geometry counts and two-material count. Its exact bytes are retained as `source/jogoss-model-metadata.json`. The creator thumbnail was fetched from the URL supplied by that API, viewed and retained as `source/jogoss-creator-preview.jpeg`.

The model files came from the public mirror `amilutinovic/grafika`, fixed commit `fe25b38080b6c881948d96ddc87db68c28ef3aec`, directory `resources/objects/sakura_tree_01_-_low_poly_model`. The model-specific original `license.txt` was actually read; it names the same original model UID, author and CC-BY-4.0 license. The glTF's `asset.extras` independently retains the same attribution. All five downloaded files' Git blob SHA-1 identities match the pinned GitHub directory metadata, and SHA-256 is retained for offline checking. The original official archive was not downloaded for byte comparison; we do not claim the mirror's bytes were independently compared with that archive.

The botanical CC0 alternative **ffish.asia / floraZia.com**'s `CC0 桜🌸 ソメイヨシノ Sakura Cherry Blossom` was considered through its indexed model information but not acquired: about 1.1 million triangles makes it inappropriate for this phone-budget task without substantial remeshing. The 7k Jogoss source satisfies the actual leaf/flower-card style and phone geometry constraint directly.

## Cultural-claim checklist

This asset acquisition adds no traditional ritual, meaning, festival, geographic exclusivity or origin claim. The name reflects the creator's intended depicted plant; it does not establish a specific shrine, country or ritual's landscaping. Regional recommendations and their independent evidence belong to the host's separate research and debug controls. No cultural source card is invented from the asset's author, filename, license or appearance. See the [project provenance rules](../../../../docs/scene-provenance.md).

Actual shape/materials inspected; creator and license evidence actually read; source facts separated from mask/texture/product adaptations; model/license/hash snapshots retained; deterministic rebuild and loader/render verified. Host packaging, visible attribution, recommendation behavior and scene-level mobile checks are reviewed with the host changes.
