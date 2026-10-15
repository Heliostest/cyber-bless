# Ebru and Angklung public craft pair

Continue the authorized batches from a02bc0a, taking the catalogue from 61 to 63. Work in the existing managed checkout. Main checkout has 67 unrelated mobile files and must remain untouched. Finish with a local commit and preview; no remote merge or push requested this turn.

## Design

- turkish-ebru-paper / 浮彩成笺: C / 低; new public craft card turkish-ebru; wish category; drag + wishWrite. Original teal/coral/ochre marbling on a shallow horizontal tray. A stylus/comb draws floating pigment; a real sheet contacts the prepared liquid before peeling up with exactly the same pattern. Steps: drag the visible comb right to draw the pattern; pull the visible paper edge upward to transfer and lift the sheet; tap to observe or explicitly submit a wish. Paper may be set onto the surface during the first accepted settling animation, after the comb clears. No print before contact. Keep paper visible and accessible in portrait. No miniature table or slanted display board.
- indonesian-angklung / 竹音轻摇: C / 低; new public craft card indonesian-angklung; blessing category; drag. Original bamboo frame, 2 hollow slotted bamboo tubes of differing lengths, actual rattan suspension and rail contacts. Steps: hold the visible frame grip and gently draw left; draw right to complete the shake; tap to listen quietly. The tubes lag/swing relative to the frame with restrained original single-pitch/octave feedback (no copied music). A discrete object study in a sunny veranda, no repeated table. Ensure frame/tube suspension endpoints remain joined throughout both motions.

These new cards describe public crafts independently; do not mislabel them under the restrictive Sunda Wiwitan card or Mevlevi Sema. UNESCO references:
https://ich.unesco.org/en/RL/ebru-turkish-art-of-marbling-00644
https://ich.unesco.org/en/RL/indonesian-angklung-00393
Only broad facts inform original procedural art: pigment on prepared liquid transfers to paper; suspended bamboo tubes sound when a frame shakes, usually one note/chord per instrument. This is abbreviated contemporary appreciation, not full instruction or ritual reenactment.

## Acceptance and ownership

Use the latest weifang-paper-kite and chinese-shadow-puppet implementations for contract, native auxiliary buttons, lifecycle and meaningful real-Three tests. Normal/reduced motion identical final pose; silent restore 0–3 and returning; commit progress only after settling. Actual opaque nearest-surface hits, visible reachable cues, valid deliberate 60px directional moves; reject wrong start, short, reverse, cross-axis, backtracked, cancelled gestures. Both shake halves are individually deliberate directional drags. Clear at every inactive boundary, blur, cancel and disposal; guard synchronous host callback reentry and lifecycle version changes. Explicit wish saves trimmed once; quiet/restore/return never saves drafts. Dispose every GPU and DOM resource. All subject vertices fit 284x390, 350x408 and 1280x600.

Two independent module owners via dispatching-parallel-agents skill, fresh context:
1. Ebru owner: packages/scenes/src/turkish-ebru-paper/** and artifacts/ebru-angklung-pair/ebru-* only.
2. Angklung owner: packages/scenes/src/indonesian-angklung/** and artifacts/ebru-angklung-pair/angklung-* only.
Root: shared registries, app integration, cards, icons, environment, browser scripts and reports. Owners add tests before implementation and record red/green. No global edits, commits, dependencies, subdelegation, build/export/Vite startup.

Root runs targeted integration RED then GREEN; tests/build/mobile validation; independent source review; actual browser mouse/keyboard at 320/390/1280 and native touch at 320/390; visual checkpoints, returning/wish, all-scene GPU cleanup. Freeze production before input verification (HMR can remount app during pointer tests). Asset-preparing build/export/Vite startups are sequential. New dev 5212 and frozen preview 5213 if free; leave existing 5211 preview intact. Retain evidence and a two-scene gallery.

## Completed verification

- 2,781 tests passed across eight workspaces. Web TypeScript/Vite build and Android/iOS offline exports passed; each platform retained all 14 offline assets and 67 DOM scripts.
- Frozen production passed six keyboard/restore flows, six real-object mouse flows, one returning flow, and four normal-motion native-touch flows at 320/390 px. All 66 screenshots were retained; no browser errors or external requests.
- All 63 scenes retained the soft toon style without fallback. All 64 WebGL contexts were released, with zero live resources.
- Actual visual review accepted the pigment transfer, gradual paper peel, connected bamboo/rattan and full portrait framing. The original render-cache/contact-depth defects were repaired and covered by real-adapter regressions.
- Independent review accepted both modules after regressions repaired Ebru callback lifecycle invalidation and Angklung terminal-release backtracking. Current module suites contain 45 and 49 tests respectively.
- All 19 changed code-source hashes match the frozen build. The primary checkout's 67 unrelated pending files, index and working patch remain unchanged.
- Legacy documentation-map publication is outside this app-scene batch. The new public craft cards are connected through app metadata; curated map geography remains a separate task.
- Frozen preview: http://127.0.0.1:5213/scene-batch.html. Detailed local evidence: artifacts/ebru-angklung-pair/report.md and verification-summary.json. Browser touch emulation and offline exports do not constitute physical-device GPU testing.
