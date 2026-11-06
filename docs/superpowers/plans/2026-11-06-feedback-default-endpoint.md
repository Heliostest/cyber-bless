# App feedback default endpoint

**Goal:** Default the shared Web/iOS/Android feedback client to `https://feedback.heliosoft.win/api/feedback`, so testers do not re-enter the URL.

**Architecture:** Keep version-1 feedback storage and receiver authentication. A new client starts with the fixed public URL and an empty invitation. On load, persist migration of an empty or old Quick Tunnel address before allowing outgoing requests; preserve drafts, queue IDs, invitations and receipts, invalidate the old receiver cache, and retain explicit custom HTTPS/loopback addresses.

**Execution:** The user explicitly requested this change. Use the existing client/provider path; do not embed a receiver invitation or change any scene content or game saves. The change ships with a new App version; this task does not publish a native release.

- [x] Add failing fresh-default, migration, queue durability, write failure/retry, cache invalidation and no-URL-entry UI tests.
- [x] Implement the fixed default and durable migration in `test-feedback-client.ts`; keep invitation setup visible when an invitation is absent.
- [x] Run the targeted client/provider/overlay/status/pass regressions (56 passing).
- [x] Verify the production build, mobile checks and project test suite; update the operator instructions.

## Verification results

- Targeted feedback tests: 56 passing. Full `npm test`: exit 0.
- Web production build and mobile TypeScript: passing.
- Mobile bootstrap/embedded-content/internal-tools checks: 11 passing. Standalone Android/iOS native/DOM exports and offline asset validation: passing; both exported DOM bundles contain the fixed endpoint.
- `mobile:verify` as a whole is not green: Expo's dependency-version check reports existing patch-version mismatches in seven packages. Dependency manifests and lockfiles were unchanged. The standalone subsequent checks were run separately and passed.
- No new native application release was built or uploaded; existing installations receive this behavior with their next App update.
