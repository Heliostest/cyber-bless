# Ritual optics surface-detail assets

Actual read/download date: **2026-10-28**. Providers and assets: **ambientCG / Paper001** and **Poly Haven / rough_linen**. Both assets are **CC0 1.0 Universal**. The complete unmodified legal code is saved in [CC0-1.0.txt](CC0-1.0.txt); its official source is https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt.

## Primary evidence actually read

| Primary source | Read status and supported scope |
| --- | --- |
| ambientCG asset manifest, https://ambientcg.com/api/v2/full_json?id=Paper001&include=downloadData,mapData | HTTP 200 JSON read on 2026-10-28. Identifies Paper 001, its roughness map, and the official 1K JPG archive. The archive directory and selected original roughness member were read. |
| ambientCG license, https://docs.ambientcg.com/license/ | Relevant license body read on 2026-10-28. Downloadable assets are CC0 1.0; modification and redistribution, including raw asset files in games, are allowed without mandatory attribution. |
| Poly Haven asset manifest, https://api.polyhaven.com/files/rough_linen | HTTP 200 JSON read on 2026-10-28. Its `Rough.1k.png` entry supplies the exact original map URL, size, and MD5; downloaded bytes match that MD5. |
| Poly Haven license, https://polyhaven.com/license | Asset License and Intellectual Property sections read on 2026-10-28. Assets are CC0; commercial use and redistribution are allowed without mandatory attribution. Website copy, logos, and example renders are excluded from this asset permission. |
| Creative Commons CC0 legal code, https://creativecommons.org/publicdomain/zero/1.0/legalcode.en and its plain-text link above | Relevant legal code read and official complete plain text saved on 2026-10-28. Includes waiver, fallback, limitations, and disclaimers. |

Public asset pages for attribution: https://ambientcg.com/view?id=Paper001 and https://polyhaven.com/a/rough_linen. The acquisition and license evidence above uses provider manifests and primary license bodies, not search snippets or visual similarity.

## Downloaded maps and retained derivatives

The original maps were decoded during acquisition, then only their small derivatives were retained. Exact original and retained-file SHA-256, original dimensions, download sizes, URL, selected ZIP member, and transformation are recorded in [sources.json](sources.json).

- **Paper:** the official `https://ambientcg.com/get?file=Paper001_1K-JPG.zip` redirected to the archive URL in `sources.json`. HTTP byte ranges downloaded only its directory, selected local header, and `Paper001_1K-JPG_Roughness.jpg` bytes (437,667 bytes). No color, normals, displacement, Blender file, or complete archive was downloaded. The actual member decodes to 1024×600, one channel.
- **Linen:** downloaded only `https://dl.polyhaven.org/file/ph-assets/Textures/png/1k/rough_linen/rough_linen_rough_1k.png` (2,045,070 bytes). Actual dimensions are 1024×1026, one channel. Its MD5 is `e9107cbc7aae80fe39d140a7fe592c79`, matching the provider manifest.
- Retained files are `paper001-roughness-512.png` (196,875 bytes) and `rough-linen-roughness-512.png` (200,703 bytes). Both are lossless 8-bit grayscale PNGs, 512×512, without alpha or embedded color profiles. Acquisition extracted channel zero as scalar data and used Lanczos3 to resample the entire map to a square tile. **This deliberately changes the source aspect ratio**, especially the rectangular paper map. No gamma operation or sRGB conversion was requested; colors, normal maps, or preview renders were not used as roughness.

The source maps were downloaded, not generated or replaced by procedural noise. The saved 512px images are modified derivatives, not byte-identical originals. Reacquiring originals requires the recorded provider URLs; normal generation/build does not require network access.

## Offline runtime transformation

Run `node scripts/prepare-ritual-optics-assets.mjs` from the repository root. The script verifies retained-file SHA-256, reads only the saved PNGs, downsamples to 64×64 with Lanczos3, and computes a periodic 7×7 local mean. Fine detail is `pixel − localMean + 0.25 × (localMean − overallMean)`. After centering, the signal is normalized to standard deviation 10, clipped to ±32, offset by 128, and rounded to integer bytes. Thus runtime values stay within **96–160** and preserve gentle, source-derived surface variation. Broad source gradients are reduced; the exported scalar values are **artist-normalized detail, not calibrated physical roughness**.

Output: `packages/scene-runtime/src/ritual-fibers.data.json`, with exactly two keys, `paper` and `linen`; each has `width: 64`, `height: 64`, and 4096 integer bytes. Runtime consumption uses scalar `RedFormat`, `NoColorSpace`, and repeat wrapping. This adds no async loader and does not require a browser image decoder. The texture can be sampled by the material's local-position projection when mesh UVs are absent. Each base-level texture occupies 4096 bytes before any renderer-specific mipmaps or object overhead.

Check reproducibility and source integrity with `node scripts/prepare-ritual-optics-assets.mjs --check`; run asset checks with `node --test assets/materials/ritual-optics/assets.test.mjs`. The existing installed `sharp` is used; no dependency was installed.

## Cultural and physical scope

Reviewed [scene provenance rules](../../../docs/scene-provenance.md) and the [optics research asset section](../../../docs/research/2026-10-28-open-source-optics-materials.md). This changes only subtle surface detail. It does not establish washi manufacture, historic linen usage, a place, a community, a ritual, an origin, a meaning, or any new material identity for a scene. CC0 permission establishes reuse rights only. These roughness-derived maps are **not thickness, transmission, normal maps, or measured fiber geometry**. Existing colors, printed marks, cultural sources, titles, actions, metadata, and save identifiers are outside this asset change.

Provenance checklist: actual maps and transformations inspected; primary license bodies read; no new cultural claims; no tradition/source-card binding added; retained and runtime data verified separately from cultural review. Scene registry/source-card/host/metadata changes are not applicable to this isolated asset preparation.
