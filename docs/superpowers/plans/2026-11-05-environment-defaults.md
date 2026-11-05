# Environment defaults implementation plan

**Goal:** Make scene-recommended trees and Sunny village the production defaults, retaining developer comparisons.

**Design:** Central defaults shared by environments and debug stores. Keep approved recommendation trees resident while a second owned tree renderer handles temporary comparisons; captures restore the cached production trees and tone synchronously. Preserve existing recommendation exclusions and subject/ritual identity.

- [x] Add red/green behavior coverage for independent defaults, debug teardown and capture restoration.
- [x] Apply production defaults without requiring the console, preserving fallback and resource lifecycles.
- [x] Update reset semantics, localized errors and relevant scene/source documentation.
- [x] Complete runtime/UI, actual default-scene/share, locale, build and revision checks; record the unrelated full-repository localization blocker.
