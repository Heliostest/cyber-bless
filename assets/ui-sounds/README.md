# Local UI feedback

The App uses **[Soft Garden v1](soft-garden-v1/README.md)**: ten original,
locally synthesized WAVs approved by the user after listening. The shared
`UI_SOUND_FILES` mapping supplies both Web and Expo offline asset copies.

- Button cues: navigate, back, select, open, close, toggleOn, toggleOff.
- Result cues: saved, collect, complete. The reserved notice cue reuses select.
- 48 kHz, mono, 16-bit PCM; 382,520 bytes total.
- App exports retain the approved timbres and timing at 0.45 times the audition amplitude.

Rebuild from checked-in source with no downloads or additional dependencies:

```powershell
node assets/ui-sounds/soft-garden-v1/build.mjs
node scripts/prepare-app-assets.mjs
```

The [generator](../../design/audio/soft-garden-v1/generate.mjs) and
[manifest](soft-garden-v1/manifest.json) preserve recipes and source/output hashes.
Material interaction sounds remain synthesized in `packages/shared/src/soft-audio.ts`.

The unused Kenney WAVs, legacy builder, license copy and manifest were removed
at the user's request. Their original source review remains in
[the historical research](../../docs/research/2026-11-03-ui-sound-sources.md);
prior published versions and their license records remain available in Git history.
