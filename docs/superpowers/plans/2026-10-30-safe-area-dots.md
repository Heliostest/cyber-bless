# Safe-area dots implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this single scoped task.

**Goal:** Extend the existing mint polka-dot ground through the native status-bar and home-indicator areas.

**Architecture:** Preserve the SafeAreaView and opaque WebView geometry. Bundled 24pt native Images paint the safe-area bands behind the transparent SafeAreaView. Align the tile origin with the inset WebView at its initial scroll position.

**Tech Stack:** React Native Image, safe-area-context, Sharp PNG generation.

**Spec:** The approved proposal in this conversation: fill the whole screen with dots while keeping content and buttons inside the safe area.

## Global constraints

- No new dependencies or scene/cultural-content changes.
- Preserve existing storage, bridge, keyboard, status-bar text and page layout behavior.
- Reuse the 24pt CSS pattern, with bundled 1x/2x/3x assets.
- Preserve unrelated working changes; no release or cloud build is requested.

## Review focus

- Fractional/different safe-area insets: pattern phase matches the initial content origin.
- Screen density: repeat at 24pt, with crisp corners and no solid strip.
- Input: the decoration cannot intercept taps or enter accessibility navigation.
- Cold start and WebView recovery: native ground exists independently of DOM readiness.
- Scrolling: native bands remain stationary; the existing DOM pattern still scrolls with the document.

## Task 1: Native background

**Files:** `apps/mobile-expo/App.tsx`, `apps/mobile-expo/SafeAreaBackground.tsx`, `apps/mobile-expo/assets/island-dots*.png`, `scripts/generate-island-dots.mjs`, `docs/mobile-app.md`.

- [x] Generate density-aware tile assets from the existing CSS colors and dot geometry.
- [x] Add decorative Images behind a transparent SafeAreaView, preserving WebView dimensions and safe padding.
- [x] Check image density, initial pattern alignment and tap/accessibility behavior in source and a visual approximation.
- [x] Run mobile type checking, relevant existing bootstrap tests and local iOS/Android embedded exports.
- [x] Review the scoped diff; record actual verification and device limitations.

Review ruling: Android's repeat postprocessor uses bitmap pixels without normalizing resource density. Use explicit 24pt Image tiles with stretch resizing on both platforms; draw only tiles intersecting the safe-area bands. This preserves the CSS period at fractional device densities without adding dependencies.

## Verification — 2026-10-30

- `npm run typecheck -w @wbr/mobile`: passed for the final explicit-tile component.
- `node --test scripts/expo-dom-bootstrap.test.mjs scripts/validate-mobile-embed.test.mjs scripts/mobile-build-guard.test.mjs`: 8/8 passed. Sandbox loopback restrictions required rerunning outside the sandbox.
- `node scripts/check-mobile-framework.mjs`: final Android and iOS native/DOM exports passed, including 14 offline asset hashes and 477 iOS widget cover hashes. The 1x/2x/3x native PNGs were also confirmed in both export structures.
- Local `artifacts/safe-area-dots/check.mjs`: compared all three PNG densities against the CSS pattern; rendered the actual SafeAreaBackground through React Native Web for four screen/inset configurations at 2.625x, 3x and 4x. All 12 visual comparisons passed, including fractional insets. Decoration uses a noninteractive, accessibility-hidden wrapper.
- `git diff --check` passed for the scoped changes.
- No signed/cloud build, publication or native-device visual acceptance was performed. Browser component rendering and bundle validation do not replace a device check. The native bands stay fixed while the existing DOM pattern scrolls with its document.
