# Interactive Scene Sharing Plan

**Goal:** A local, deployable scene page that preserves the real Three.js experience and links to the App Store; share its public URL when configured.

**Spec:** ../specs/2026-10-28-interactive-scene-sharing.md

**Constraints:** No deployment this round. No private state in URLs. Real engines/environment/shaders. Static share.html entry. Eight locale controls. Do not claim store availability or native device acceptance.

- [x] Implement and test strict share URL construction/parsing, public URL validation and native text/link bridge.
- [x] Implement and test a memory-only public scene page with real interaction, mute default, replay, lifecycle and App Store button.
- [x] Add link controls to the shared share dialog, local preview, configured public URL, copy fallback and native bridge integration.
- [x] Build Web main/share entrypoints with correct relative asset paths; register all new UI copy.
- [x] Verify real WebGL scenes and shader preservation in browser; verify App Store href, interaction, malformed links, both mobile widths and no save writes.
- [x] Run focused suites, Web build, mobile typecheck and independent review; record actual limitations.
