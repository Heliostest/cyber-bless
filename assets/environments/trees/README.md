# KayKit broadleaf trees

## Optional developer tree styles (2026-11-05)

Current default (2026-11-05): use the approved scene recommendation when present, otherwise retain the original KayKit/Kenney scenery. The shared palette defaults to Sunny village. Developer source comparisons remain available, and shares use the approved defaults. This supersedes the earlier preview-only status below; [scope and validation](../../../docs/research/2026-11-05-environment-defaults.md).

The KayKit trees remain the content default. The developer console can replace shared environment trees with locally bundled alternatives:

- [Quaternius Stylized Nature MegaKit](quaternius/README.md): two authentic CC0 free Standard broadleaf models, with embedded source leaf/bark textures and authored normals.
- [Just a simple tree](simple-tree/README.md): two deterministic oaks generated offline from pinned MIT source, retaining leaf cards, cluster normals, generated textures and vertex AO; no editor music/sounds.

Selection is App-scoped and session-only. Collapsing keeps the preview; reset or console teardown restores originals. Models load on selection from local assets. Failed/cancelled/late loads release their owned resources. Day and night shared backgrounds support the alternatives; coastal scenery without trees and cultural tree subjects are not replaced. General landscape props imply no cultural species identity.

The current preview uses a closer, under-tree composition: two trees frame the sides with partial trunks/boughs and crowns entering the upper picture, while the remaining trees keep background depth. Actual source geometry determines clearance around the central work area. Broadleaf trees can lean gently inward; columnar cypress and tiered conifers retain upright growth. Planting is calculated for the current camera and reframed on projection changes, without following authored camera walks. No source model bytes or scene subjects are changed. See [framing and validation](../../../docs/research/2026-11-05-under-tree-preview.md).

Both hosts ship the eighteen alternative GLBs and complete CC0/MIT notices through `prepare-app-assets.mjs`. Source hashes, conversion commands and limits are in the linked READMEs. Host motion adds restrained foliage sway, respecting paused/reduced motion, without reproducing the editors' full animation or LOD. Imported leaves cast shadows but do not receive dense card self-shadows, preserving soft crown visibility; source and documented product palettes are retained. Official shares keep the approved scene default and then restore the live debug comparison. Verify with `node scripts/verify-tree-debug.mjs` (`WBR_URL` supported).

The Simple Tree preview preserves its outward clump normals on both faces of a card, reduces the baked vertex shading contrast, and uses a gentle wrapped diffuse response for continuous-lit materials. This host shader treatment makes leaf clusters read as round volumes; ink styles retain deliberate lighting bands. Selected tree previews use broader, lower-strength PCF shadows, restoring the previous shadow settings for original scenery, official captures and teardown. Source GLBs, masks, normals and palette data remain unchanged. See [softness checks](../../../docs/research/2026-11-05-soft-tree-preview.md).

## Regional forms in the developer preview

The user chose preview-only species selection. The console also offers scene suggestions and manual flowering cherry, columnar cypress, weeping willow and tiered conifer forms. Nine explicit scene/season suggestions are documented in [regional evidence](../../../docs/research/2026-11-05-regional-tree-evidence.md); unverified settings keep their original scenery. No country-name rule or claim of ritual plant requirements is used.

All seven specialty forms use the pinned MIT generator. Cypress/willow/conifer retain its source species paths; its internal `pine` key is documented as fir-like, hence the generic conifer UI name. Flowering cherry is a product adaptation of its oak branching and foliage pipeline, with spreading branches, flatter flower clumps and a procedural five-petal blossom atlas. New manual comparisons add Chinese toon, green maple and autumn maple, each with its own procedural leaf atlas and branch parameters. The product adaptations are not upstream built-in botanical species or cultivar identifications. The [previous external cherry](regional/README.md) remains an attributed source archive and is no longer selected or shipped. Free Quaternius Standard does not include the promoted full-pack cherry/birch/palm; the [source inventory](quaternius/README.md) records that boundary. Current defaults and cultural subjects are retained; the [three new forms](../../../docs/research/2026-11-05-toona-maple-previews.md) add no regional mapping.

## Original KayKit assets

Two fuller, asymmetric broadleaf variants from **KayKit Forest Nature Pack 1.0** by **Kay Lousberg**, under **CC0 1.0**.

- Creator and license statement: https://kaylousberg.itch.io/kaykit-forest
- CC0: https://creativecommons.org/publicdomain/zero/1.0/
- Original creator license: [source/License.txt](source/License.txt)
- Exact retrieval and SHA-256 hashes: [source-manifest.json](source-manifest.json)

The local network reset the creator's itch download connection. The original glTF, binary buffers, gradient atlas and creator license were retrieved from the pinned GitHub mirror of the **Complete KayKit Collection v6**, commit `d5e6c73284e9385a389ac7181dec3d0dc9e9021d`. We do not assert that these exact variants are in the creator's free-tier archive. The retained creator license explicitly covers commercial use under CC0. No asset was purchased, and no runtime third-party requests are made.

## Selected source files

- `Tree_1_B_Color1`: rounded asymmetric broadleaf silhouette.
- `Tree_1_C_Color1`: fuller branching tree with four overlapping crown masses.
- `forest_texture.png`: original shared gradient atlas, unchanged.

`node scripts/prepare-tree-props.mjs --report artifacts/meadow-water/trees/validation.json` checks all source hashes, traverses glTF transforms, bakes the atlas to linear vertex colors, gently shifts greens and wood into the sunny meadow palette, separates wood/canopy, and grounds each model at y=0 with a total height of 1. Git attributes preserve the original source notice bytes, including its vendor whitespace, so hash validation works across platforms. Source normals and original crown geometry are retained. The runtime batches the two variants into at most four draws and moves only the canopy by less than 0.5% of its height. Every mount owns and disposes its geometry, material and instance buffers.

These are source-derived imported models, not generated substitute trees. Candidate evaluation also checked Kenney Nature Kit and the primary Quaternius Stylized Nature MegaKit page; neither supplies geometry to this module.
