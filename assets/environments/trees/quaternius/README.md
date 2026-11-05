# Quaternius Standard broadleaf trees

Two authentic models from **Stylized Nature MegaKit [Standard FREE]** by **Quaternius**, released under **CC0 1.0 Universal**. No purchase or paid-tier assets were used.

- Creator: <https://quaternius.com/packs/stylizednaturemegakit.html>
- Creator's download page: <https://quaternius.itch.io/stylized-nature-megakit>
- Actual retrieval: the [author's OpenGameArt upload](https://opengameart.org/content/stylized-nature-megakit), published 2025-04-16, checked 2026-11-05.
- Original license: [LICENSE.txt](LICENSE.txt), copied byte-for-byte from `License_Standard.txt` in the archive; the original is also retained in `source/`.
- Exact original filenames, byte ranges, CRC32 and SHA-256: [source-manifest.json](source-manifest.json).

| Runtime asset | Original model | Vertices | Triangles | GLB bytes |
| --- | --- | ---: | ---: | ---: |
| `round.glb` | `glTF/CommonTree_1.gltf` + `.bin` | 9,458 | 6,265 | 841,608 |
| `cluster.glb` | `glTF/CommonTree_5.gltf` + `.bin` | 4,873 | 3,182 | 658,036 |

The first has a fuller contiguous crown; the second shows more individual branch clusters. These names are product variant keys, not species identifications. They are imported creator geometry, not generated silhouette substitutes. Root transforms and original dimensions are retained; the runtime grounds and normalizes the models.

## Species availability in this free source

The debug-preview species request was checked on 2026-11-05 against **all 459 original ZIP directory entries**, including every format and texture. This pinned Standard archive has exactly 20 tree glTFs: `CommonTree_1–5`, `DeadTree_1–5`, `Pine_1–5`, and `TwistedTree_1–5`.

| Requested species | Evidence in the pinned free Standard archive | Delivery |
| --- | --- | --- |
| Cherry / cherry blossom | No entry containing `cherry` or `blossom`; no creator-identified cherry model or map | No cherry GLB exported |
| Birch | No entry containing `birch`; no creator-identified birch model or map | No birch GLB exported |
| Palm | No entry containing `palm`; no creator-identified palm model or map | No palm GLB exported |
| Cypress | No entry containing `cypress`; the available conifers are named Pine | No cypress GLB exported |
| Pine | Original `glTF/Pine_1–5.gltf` and matching binary buffers exist | Available for a future authentic-source import; not part of the current two-model export |

The full kit's promotional variety is not evidence that a species is present in the free Standard subset. This result applies to the exact pinned archive, not all releases or the full kit. Generic CommonTree geometry is not relabeled or recolored to impersonate cherry, birch or palm. Existing `round.glb` and `cluster.glb` hashes remain unchanged. The manifest records this availability result; preparation parses the original binary ZIP directory and checks its inventory and absent species names on every run.

## Reproduce and verify

From the repository root, with its locked dependencies installed:

```sh
node scripts/prepare-quaternius-trees.mjs
node scripts/prepare-quaternius-trees.mjs --check
```

The command verifies every retained vendor source SHA-256, embeds all textures into each portable GLB, and writes `validation.json`. `--check` independently regenerates the bytes in memory and compares each GLB and the license copy. No network request is made unless `--download` is explicitly supplied. `--download` re-fetches the pinned selected ZIP records and refuses changed source bytes. A changed upstream archive must be reviewed and recorded as a new acquisition, not silently accepted.

The original archive is 104,088,529 bytes. Only required ZIP records were fetched through HTTP Range; the complete archive was neither retained nor hashed. The original central-directory bytes are retained and pinned. The manifest records the server's archive ETag and Last-Modified and each selected record's size, offset, CRC32 and SHA-256. The bark base-color record was retrieved from `Textures/` (the archive contains a byte-identical `glTF/` copy); its local `glTF/` path matches the original glTF URI.

## Material preparation and limits

- Original positions, normals, UVs and indices remain byte-identical, with no mesh decimation, leaf removal or normal recomputation. Authored RGBA vertex colors, which contain trunk AO and white leaves, are quantized from FLOAT32 to normalized UINT8 (maximum channel error `0.5/255`).
- Every GLB contains the same three 512×512 textures: bark base color (JPEG quality 85, 4:4:4), bark tangent-space normal (PNG), and leaf color plus alpha (PNG). Originals remain unmodified in `source/glTF/`. Bark originals are 2048×2048; leaf original is 1024×1024. Resizing uses Lanczos3; PNG channels remain lossless after resize. There is no external texture or decoder dependency.
- `Leaves_NormalTree` retains the source `alphaMode: MASK`, cutoff `0.20000000298023224`, double-sided rendering, original UVs and normals. `transparent` is false after Three.js import; alpha masking cuts individual leaf shapes out of the cards. The resized leaf map still contains both alpha 0 and 255 (194,250 fully transparent pixels and 36,617 fully opaque pixels).
- The source exported **bark** as MASK too, although all 4,194,304 original alpha samples are 255. We correct bark to `OPAQUE` without changing its appearance, keep double-sided rendering, normal mapping and AO, and preserve the `Bark_NormalTree` material name. This also keeps alpha-test-based foliage wind from moving trunks.
- The author's paid Source edition supplies engine-specific stylized shaders and wind. Those shaders are **not included** here. These GLBs use standard glTF PBR materials; the host's lighting and wind are product adaptations and will not exactly reproduce promotional Source-edition shading.
- The original opaque leaf RGB is uniformly `88,123,0` (`#587b00`), a dark olive. Leaf vertex colors are white, not baked dark AO. The browser import confirms `SRGBColorSpace` for base-color maps and `NoColorSpace` for the bark normal map; linear vertex-color semantics are preserved. Even the shadows-off contact render shows the source palette's dark PBR response. Any host fill, translucency approximation or reduced foliage self-shadowing is a lighting adaptation, not a repair of source color-space data.

`render-validation.json` records a real Three.js 0.170 `GLTFLoader` import and WebGL render: two meshes per tree, correct masks and normal maps, all image dimensions 512×512, no page errors, and five draws / 9,449 triangles including a two-triangle ground. [preview.png](preview.png) is the inspected contact view; [preview.html](preview.html) can be served from the repository root to repeat it. This is an asset/material check, not a phone frame-rate measurement.

## Source and cultural-claim audit

Scope: meadow environment vegetation for the existing product scene. This change adds no traditional object, ritual, cultural origin, sequence, meaning, qualification or festival claim. Existing scene provenance remains unchanged; see the [project provenance rules](../../../../docs/scene-provenance.md) and [tree-options research](../../../../docs/research/2026-11-05-tiny-glade-style-trees.md). No cultural source card is created from an asset license or an aesthetic resemblance.

Evidence actually read on 2026-11-05:

| Source and relevant body | Access status | Supported scope and limits |
| --- | --- | --- |
| Creator page, Features and Standard / Pro / Source version descriptions | Relevant body read through web tool | CC0 personal/commercial asset use, glTF availability, free Standard is a subset; Source shaders target Unity/Unreal/Godot. Does not establish cultural provenance or promise Three.js appearance. |
| Creator itch page, Features and Download list; purchase page's included-file list | Relevant body read through web tool | `Stylized Nature MegaKit[Standard].zip` is free; paid Pro / Source are separate. No payment submitted. |
| Author `quaternius` OpenGameArt page, author/date fields, license, description's Standard paragraph and actual file link | Relevant body downloaded directly with curl and read; web tool was robots-blocked. Exact retrieved HTML retained in `source/opengameart-page.html`. | The offered file is the author's Standard edition with 68 models and a CC0 license, rather than an unverified third-party mirror. No cultural claim is supported or inferred. |
| Archive `License_Standard.txt` | Original bytes extracted and read | Explicit FREE Standard identity, 68/116 subset, CC0 1.0, author Quaternius. Does not include the paid engine project/shader implementation. |

Checklist: actual imported tree geometry and materials inspected; no new cultural claims or source-card bindings; source facts separated from product material/wind changes; exact license and retrieval evidence retained; deterministic byte check and loader/render verification completed. Broader host integration, catalog and mobile validation are handled with the runtime changes.
