# Object-first kite and shadow-puppet pair

The user authorized continuing the next public-craft batch. This pair extends the 59-scene catalogue to 61. Use the dispatching-parallel-agents skill for the independent scene directories; root owns shared integration and verification. Keep the existing worktree and historic preview servers. Do not touch the primary checkout's unrelated mobile changes. This batch ends with a local commit and preview; remote integration is a separate user action.

## Design and sources

- `weifang-paper-kite` / 纸鸢乘风: C / 低, `chinese-folk-and-confucian` regional index, blessing category, drag gestures. An original swallow-like paper kite with visible symmetrical bamboo spars, teal/red/ochre paper wings, a bridle and a connected wooden reel. No miniature craft table. Steps: draw a prepared paper wing onto the frame; pull the reel to raise the kite; tap to quietly watch it held in the sunshine. Grass and sky remain secondary to the object. It is a contemporary craft appreciation exercise, not a claim to teach the full heritage technique.
- `chinese-shadow-puppet` / 影偶小戏: C / 低, same regional index, wish category, drag + wishWrite. An original articulated bird in a freestanding timber theatre with warm cloth screen, joints and actual connected rods. Backstage oblique view: lamp, colourful puppet, then screen; the moving silhouette must follow the puppet on the cloth. Steps: lift main rod; move wing rod to turn the wing; quiet observation with optional explicit wish writing. No copied traditional character, ritual or efficacy claim.
- China ICH, [风筝制作技艺（潍坊风筝）](https://www.ihchina.cn/project_details/14434/): bamboo frame, paper, symmetry, bridle and line, bright simple forms.
- China ICH / 中国文化报, [潍坊风筝：手造之美 匠心绽放](https://www.ihchina.cn/art/detail/id/29081.html): 扎、绘、糊、放. The product makes its own small motif and abbreviated sequence.
- UNESCO, [Chinese shadow puppetry](https://ich.unesco.org/en/RL/chinese-shadow-puppetry-00421): leather or paper silhouettes, movable joints, rods and backlit translucent cloth screen. No music or third-party visual assets are copied.

## Shared acceptance

Follow the SceneModule contract and the latest `faroese-wool-knit` / `niue-shell-necklace` lifecycle implementations. Independent source files only; no dependencies or network-at-runtime assets. Silent checkpoints 0–3, including restoring and returning. Normal/reduced motion must reach the same pose. Actions finish before progress commits. Native 44px auxiliary buttons provide Enter/Space access, disabled during transitions and inactivity. Real opaque first-surface ray hits; cues on reachable object surfaces, not hidden hit planes. Reject wrong start, reversed/short/cross-axis/backtracked/cancelled drags. Pause/blur/capture loss/dispose and synchronous prepareFeedback/onProgress/saveWish re-entry may not advance or leak input. Every inactive boundary invalidates the input lifecycle version. Wish saves only on explicit submission, trimmed, once; observing/restore/returning never saves. Dispose all GPU and DOM resources. All subject vertices fit 284×390, 350×408 and 1280×600 views.

## Tasks

1. Kite implementer owns only `packages/scenes/src/weifang-paper-kite/` and `artifacts/kite-shadow-pair/kite-*`. Implement index, scene, source/boundary README and meaningful real-Three tests. First add tests and observe red. Record scoped test evidence and self-review. Do not register globally, commit, start Vite/build/export, or delegate.
2. Shadow implementer owns only `packages/scenes/src/chinese-shadow-puppet/` and `artifacts/kite-shadow-pair/shadow-*`. Same deliverables and constraints, with projected shadow and articulated-rod tests. Root will register it as night stage and night courtyard with warm light.
3. Root owns registry, engines, catalogue/daily placement, icons, narrative and lifecycle integration, environment profile, preview and physical-input scripts. Add targeted registration expectations before implementation. Run scoped tests, then full tests, Web build and offline mobile validation sequentially with respect to asset preparation.
4. Root obtains independent code review, verifies production at 320/390/1280 widths with keyboard and actual object pointers, native touch at 320/390, checkpoint/wish/returning behaviour, all-scene resource cleanup, and inspects screenshots. Fix defects, make a frozen pair gallery and local commit. Verify primary worktree's unrelated changes remain intact.

## Execution notes

- Independent implementers may run scoped Vitest simultaneously; build/export/Vite startup are root-only because asset preparation rewrites shared public directories.
- Prefer original procedural shapes and materials. Lighting geometry and visible line/rod attachment are part of correctness, not decorative afterthoughts.
- Review based on the actual diff and screenshots. Retain preview artifacts for the user's review.

## Completed verification

- 2,669 tests passed across eight workspaces; Web TypeScript/Vite build and Android/iOS offline validation passed.
- Frozen production: 6 keyboard/restore flows, 6 real-object mouse flows, 1 returning flow, and 4 normal-motion native-touch flows at 320/390 px. No browser errors or external requests; 66 screenshots retained.
- All 61 scenes use the soft toon style without fallback; all 63 WebGL contexts released, zero live resources.
- Real image review accepted the kite's connected line and materials, and the puppet's articulated rods and complete pierced projection inside the cloth. Independent source review passed.
- The initial development-only kite stall coincided with Vite HMR remounting the application while the shadow module changed. An unchanged-source replay and the frozen production runs passed; no speculative scene fix was introduced.
- Source hashes match the production build. Primary checkout's 67 unrelated pending files, staged index and working patch remain unchanged.
- Preview: `http://127.0.0.1:5211/scene-batch.html`; detailed local evidence: `artifacts/kite-shadow-pair/report.md` and `verification-summary.json`.
