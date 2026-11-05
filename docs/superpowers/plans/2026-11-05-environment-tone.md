# Environment tone implementation plan

**Goal:** Add an optional Tiny Delivery inspired background palette to the existing debug console while preserving the original look.

**Design:** Reuse existing geometry and props; coordinate background materials, foliage vertex colors, meadow colors, sky/clouds and lighting. Keep the current default, a session-scoped selection, independent tree/water controls and existing gameplay. No cultural claims or asset imports.

- [x] Add scoped session tone state and a reversible environment surface adapter; verify scope isolation and lazy props.
- [x] Connect meadow, sky and lighting to the environment; preserve subject materials, original captures and original tone restoration.
- [x] Add a localized selector and palette swatches to the existing debug console; preserve collapsed choices and release on unmount.
- [x] Run relevant runtime and UI tests, production build and browser visual checks; record provenance scope and results.

Implementation is limited to this requested preview; shared tree changes already present in the workspace are retained.
