# Per-tester feedback invitations implementation plan

> **For agentic workers:** Execute inline with superpowers:executing-plans, test-driven-development and verification-before-completion. Request a fresh code review before switching the live receiver.

**Goal:** Give the owner five persistent, independent invitation codes for different testers and confirm the receiver's actual availability.

**Architecture:** Keep the legacy invitation and App protocol. Store additional labeled invitations in an external `invitations.json` beside `server.json`; load them when starting the receiver. Record only the invitation ID and label alongside newly received reports, preserving report payloads, receipt IDs and duplicate semantics. Expose the codes and attribution only in the existing loopback dashboard.

**Tech Stack:** Node.js, existing feedback HTTP server/dashboard, Windows scheduled task, Cloudflare Tunnel.

**Spec:** User request in this chat on 2026-11-08: check whether the backend stays running and provide several different invitation codes to distribute to individual testers. Five codes labeled 测试员01 through 测试员05 are an implementation choice.

## Constraints and review focus

- Keep the original shared invitation and retained reports unchanged.
- Do not put real invitation codes in Git or logs; use the local dashboard for retrieval and return the requested codes directly to the owner.
- Keep public administration disabled, and never expose invitation labels or secrets in public receipts or team aggregates.
- Persist attribution from the first successful submission; retries with another valid invitation must retain the original source and receipt.
- Refuse damaged/ambiguous invitation configuration and protect concurrent CLI edits with an exclusive lock and atomic replacement.
- Named invitations and revocations apply after receiver restart; App changes are unnecessary.
- Login auto-start does not guarantee availability while the computer is asleep, off, logged out or offline.

## Implementation and verification

- [ ] Add failing tests for independent authentication, attribution/idempotency/privacy, persisted creation/revocation and damaged configuration preservation.
- [ ] Implement external invitation storage and CLI create/revoke commands; wire the receiver and local dashboard.
- [ ] Run backend and feedback integration suites; review the diff and update operational documentation.
- [ ] Review the implementation, switch the live receiver, create five external invitations, and test each through the fixed public hostname with synthetic resolved samples.
- [ ] Confirm original reports/shared invitation are unchanged and codes remain valid after a controlled restart; deliver the five codes and availability limits.
