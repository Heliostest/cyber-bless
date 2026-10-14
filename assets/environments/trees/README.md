# KayKit broadleaf trees

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
