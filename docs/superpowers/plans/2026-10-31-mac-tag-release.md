# Mac tag release implementation plan

> **For agentic workers:** Use superpowers:executing-plans for integration and independent workers for the three file-isolated modules below. Execute all tasks without another approval pause; the user approved the design and requested implementation.

**Goal:** Build official Mac releases from a pushed annotated tag, including Git LFS and the same version of all release scripts.

**Architecture:** A dependency-free bootstrap fetches and verifies Git/tag/LFS into an isolated checkout. Shared source checks bind preparation, build, verification and upload receipts to that checkout. Existing signing and ASC behavior remains behind these checks.

**Tech Stack:** Node.js built-ins and node:test, Git/Git LFS, SSH, the existing Expo/Xcode/CocoaPods toolchain.

**Spec:** docs/superpowers/specs/2026-10-31-mac-tag-release-design.md

## Global constraints

- No actual release, upload, new release tag, merge, or unrelated business-source commit in this task.
- Preserve historical build 18 receipts and existing working-tree changes.
- Mac directly fetches the pushed tag and LFS; official releases cannot fall back to dirty source archives.
- Build and upload execute scripts from the selected checkout and revalidate source identity.
- Keep secrets external; validate all filesystem boundaries before mutation.
- Work in place because the existing release tools are untracked inputs in this working directory; do not copy or reset unrelated work.

## Review focus

- A remote tag moves or refers to a commit outside master: reject before build.
- A source file, validator, execution path or receipt belongs to another version: reject before signing/upload.
- Generated native files are allowed, but tracked business changes are not hidden by the prebuild allowlist.
- Dependency installation or a concurrent invocation fails: no successful prepare receipt or unlocked overlap.
- Old source archives and missing LFS/toolchain dependencies fail explicitly rather than silently bypassing the new path.

## Task 1: Git source acquisition

- [x] Write and run failing real temporary Git/bare remote tests for annotated, pushed tags, master ancestry, moved refs and dirty/reused checkout boundaries.
- [x] Implement `git-source.mjs` and `checkout-tag.mjs` with exact tag identity, canonical paths and explicit LFS fetch/checkout/fsck.
- [x] Run `node --test scripts/ios-release/git-source.test.mjs`.

## Task 2: Source and receipt identity

- [x] Write and run failing tests for tracked/tag file manifests, LFS bytes, script paths, source mutation and mixed receipts.
- [x] Implement `source-identity.mjs` with createGitSourceManifest, assertReleaseSource, sourceReceipt, assertSourceReceipt and the narrow prebuild comparison.
- [x] Run `node --test scripts/ios-release/source-identity.test.mjs`.

## Task 3: Dependency inputs

- [x] Obtain the previous successful build's non-secret Podfile.lock and actual toolchain versions by read-only SSH.
- [x] Write failing tests and implement toolchain checks and locked Pod installation in `dependencies.mjs`.
- [x] Add the tracked dependency lock, Ruby lock if available and release input with an explicitly unallocated build number.
- [x] Run `node --test scripts/ios-release/dependencies.test.mjs`.

## Task 4: Integrate the official release path

- [x] Add failing behavioral tests for release input validation, concurrent locking, old archive rejection and stage/receipt mismatches.
- [x] Replace dirty-source preparation with the tag checkout path. Reuse existing resource and signing checks.
- [x] Require source checks in prepare/build/verify/ASC and same-checkout EAS counter operations. Bind all new receipts to source identity.
- [x] Add one serialized runner with prepare/build/verify/upload/finish stages, safe retries and configuration generation; no automatic branch merge, tag creation or upload from the checkout-only command.
- [x] Update AGENTS.md, README and current release-process documentation; keep old release-history claims unchanged.
- [x] Run all release-tool tests and relevant mobile packaging tests, then the repository test command and report any unrelated failures by name.

## Task 5: Review and verification

- [x] Get a fresh review of the complete change; fix material defects with regression tests.
- [x] Check the source diff and syntax, and perform a Mac-only toolchain/dependency preflight without signing or Apple writes where feasible.
- [x] Record all remaining deployment prerequisites and unverified Mac build behavior in the delivery message.

## Execution record

- Design approved by the user. Implementation proceeds without another plan approval request.
- Existing source and scene changes belong to other work and will not be staged or committed by this task.

- Verification: Windows release-tool suite 90/90; Mac release-tool suite 90/90; mobile packaging regression suite 8/8; all 21 JavaScript modules passed syntax checks.
- Mac actual toolchain probe passed the committed requirements. Git LFS 3.8.1 installed; a real GitHub LFS asset was downloaded and its SHA-256 matched the pointer.
- Full repository test run reached the existing app/hourly-scene-lifecycle.test.ts failures: 43 failed, 1270 passed in app; subsequent workspaces were not run because the command uses &&. No scene code was changed by this task.
- Review fixes verified RED to GREEN: master-only source; fixed official build root; EAS context only after dependency installation; fresh native generation and native input/write-path checks.
- Ruling: rebuild intentionally reuses an old build number without uploading or syncing counters; it remains distinct from a new official build.
- Deferred minor: interrupted archive/export recovery requires reviewing logs and preserving/moving the old generated output; no automatic resume-export or destructive overwrite was added.
- Runtime prerequisites for the next real release: commit/review/merge/push the chosen inputs and tools, allocate the build number before tagging, and authenticate the existing Expo account on Mac if continuing EAS counter sync. No production tag, signing build or Apple upload was performed.
