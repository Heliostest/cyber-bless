# Fixed feedback tunnel implementation plan

> **For agentic workers:** Execute inline using test-driven development and verification-before-completion. The user explicitly requested implementing the previously selected fixed-domain approach, configuring autostart, and proving actual receipt.

**Goal:** Serve the existing authenticated feedback intake at `https://feedback.heliosoft.win/api/feedback` with a persistent Cloudflare Tunnel and Windows login recovery.

**Architecture:** Retain the existing Windows scheduled task, Node supervisor, intake on loopback 4318 and local dashboard on 4319. An optional external `tunnel.json` selects a named tunnel; credentials stay in a separate external token file and never in command arguments or Git. Without configuration, the existing Quick Tunnel behavior remains available.

**Tech Stack:** Node.js, cloudflared, Windows Task Scheduler, existing Node test runner.

**Spec:** User request in this chat, plus `docs/testflight-feedback.md` for receipt and lifecycle behavior.

## Constraints and review focus

- Preserve the invitation and all retained feedback. Keep port 4319 local.
- Refuse malformed fixed configuration rather than silently issuing a changing URL.
- Publish the configured origin only after a connector registration; clear readiness on exit.
- Track exactly the configured hostname; reject unrelated addresses.
- Keep credentials outside the repository and application/supervisor logs.
- A login task requires the Windows user to be logged in; no reboot or 24/7 availability claim.

## Implementation

- [x] Add failing configuration, readiness/restart and configured-origin tests in `tunnel.test.mjs` and `supervisor.test.mjs`; run them and observe failure.
- [x] Add `loadTunnelConfig(file)` and `startFeedbackTunnel(options)` in `tunnel.mjs`. Wire the optional configuration into `cli.mjs`, `supervisor.mjs`, and Windows status output. Run the backend tests.
- [x] Connect the previously created `cyber-bless-feedback` tunnel and add its published application route to loopback 4318.
- [x] Restart the existing scheduled task, verify its login/minute recovery definition, and verify the fixed hostname survives a controlled restart.
- [x] Send an authenticated public synthetic feedback report, compare its receipt and persisted content, verify unauthorized requests and public administration are rejected, and mark the test report as a resolved synthetic sample.
- [x] Update operational documentation and retain small non-secret verification receipts. Run the relevant feedback checks and inspect the final diff.
- [x] Review correction: acquire the exclusive supervisor lock before clearing stale readiness, validate configuration inside the guarded lifecycle, and clear both runtime files on startup failure. Regressions cover malformed configuration, lock release, and a competing process preserving the live owner's state.
