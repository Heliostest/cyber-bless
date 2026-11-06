# Komorebi Environment Implementation Plan

**Goal:** Reuse the current Komorebi meadow, leafy trees and grading through independent debug choices.

**Architecture:** Extend existing app-scoped registries and shared environment; freeze reusable source inputs and export local tree GLBs. Keep existing defaults and capture isolation.

**Tech Stack:** Three.js, React, Vitest, Playwright; existing offline Node tooling.

**Spec:** ../specs/2026-11-06-komorebi-environment-design.md

## Constraints and review focus

- No Babylon runtime or sibling-path dependency; preserve upstream MIT notice and source hashes.
- Clear river/workbench/path space, including the full grass tuft radius.
- Asynchronous tree failure/cancellation retains existing transaction behavior.
- New palettes must restore exact original colors and not flatten Komorebi baked foliage.
- Reduced motion, capture defaults, unmount disposal and mobile controls remain functional.

## Tasks

- [x] Add failing behavior coverage for grass isolation/capture/reset and new tree/tone choices.
- [x] Freeze Komorebi source and deterministic export inputs; export reusable tree models and color curves.
- [x] Adapt the meadow geometry, ground tint and wind to shared garden placement masks.
- [x] Wire grass registry, tree source, grading and console choices with proper capture restoration.
- [x] Run affected runtime/app tests and production build; render day/night/river/mobile comparisons and inspect screenshots.
- [x] Record source provenance, cultural impact, validation and remaining limits.
