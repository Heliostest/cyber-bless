# App Store build 12 materials implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this approved store refresh, with independent copy and upload-safety review.

**Goal:** Update the Chinese ASC listing, review instructions and screenshots to match 1.0.0 (12), then associate that build with the editable store version.

**Architecture:** Keep application behavior unchanged. Capture a Release simulator build from the frozen build-12 source, use fictional local records, and stage five screenshots for each of APP_IPHONE_61 and APP_IPHONE_67. Back up existing screenshot bytes/IDs/order before replacing them through the official API.

**Tech Stack:** Expo/RN, Xcode 26.6, iOS Simulator, Maestro, Node.js, sharp, ASC API.

**Spec:** The user's approved October 26 audit and instruction “搞吧”. They authorized the proposed store material refresh and opted to proceed directly.

## Global Constraints

- App 6821271597 / com.helio.cyberbless / 1.0.0 build 12 / source 7cf95e9f31eea3463c4624ad5b00cc21493245e4.
- Follow docs/scene-provenance.md; introduce no new cultural, religious-effect or medical claims.
- Describe current free build truthfully; do not advertise pending IAP.
- Do not sign agreements, alter compliance/regions/prices, or submit App Review.
- Preserve prior task changes and unrelated local build outputs.
- No new tests for copy changes; validate JSON and facts against implementation. Exercise replacement-script guards before live mutations.

## Review Focus

- Mixed old/new images: verify all remaining assets and display groups after replacement.
- Wrong app/version: validate bundle, SKU and editable version before every store operation.
- Lost screenshot bytes/order: archive and checksum old images before deletion.
- Stale or concurrent assets: stop on unknown IDs or changed checksums.
- Screenshot accuracy: use actual app/system widget rendering, validate dimensions and inspect every image.

## Tasks

- [x] Update and review store/ios/zh-Hans.json descriptions, review notes and test instructions.
- [x] Capture and visually inspect simulator screenshots from frozen build-12 source; write source/size/hash manifest.
- [x] Validate snapshot/backup/replacement guards, then replace obsolete ASC images and verify COMPLETE state/order.
- [x] Save description/subtitle/keywords/promotion and formal/Beta review notes; associate VALID build 12; read back all changes.
- [x] Update screenshot configuration and release records, save proof, and report remaining account-holder/compliance tasks.

## Execution ledger

- Copy update delegated; root reviews wording before upload.
- Screenshot strategy: medium + large current native UI, with old groups removed only after verified backups and new-image processing.
- Ruling: User's “搞吧” approves the specific audit recommendations and direct execution; no repeat design approval is requested.
- Evidence-based adjustment: the real WidgetKit preview and Home Screen widget stayed blank in the Release simulator, with CHSError1101 (empty view collection). The sixth image is omitted; the two groups use five verified app views. Public widget promotion is withdrawn, while internal test/review notes record the issue and the need to verify the production-signed IPA on a real device. No product source or production signing changes are included.
- Upload compatibility repair: the reservation GET returned no upload operations. The replacement now preserves the POST response instructions in the ignored private checkpoint. One empty new reservation was precisely canceled after readback (0 × 0 placeholder, no checksum or uploaded parts); its GET returned 404 and original target IDs/order were verified. No old asset was deleted during this repair. The regression test and the original guards passed before resuming.
- Completed at 2026-10-26T14:46:19.505Z: ten new assets COMPLETE, forty backed-up old IDs removed, both orders verified. Independent account readback at 14:47:45.015Z confirmed ten assets and VALID build 12 associated with the PREPARE_FOR_SUBMISSION / MANUAL draft. Browser proof saved to artifacts/store-refresh-20261026/asc-updated.png. Product issues and account-holder follow-ups remain documented; no review was submitted.
