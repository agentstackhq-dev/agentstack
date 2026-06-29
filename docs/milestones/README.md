# Agentstack Milestones

Validation-driven execution. **Start with the active milestone**, not the consumer readiness roadmap.

## Active milestone

**M3 live pass**: M2 passed against live Clerk, Convex, and Vercel on 2026-06-28. M3 local implementation, live
default-deny preview path, Clerk Billing feature/plan verification, webhook bootstrap, real Billing grant webhook,
allowed preview UI smoke, Svix replay idempotency, and M3 evidence check passed on 2026-06-29. The repeatable
subscription step is now `billing:fixture -- subscribe`; see
[../references/m3-clerk-billing-fixture.md](../references/m3-clerk-billing-fixture.md). Do not start M4 or clean-machine
packaging until the active M3 test subscription/payment source cleanup approach is acknowledged or completed.

## All milestones

| ID | Status | Doc |
| --- | --- | --- |
| M0 | Reference | [Hypothesis](../validation-hypothesis.md) |
| M1 | Complete | [M1-preview-e2e.md](./M1-preview-e2e.md) |
| M2 | Complete | [M2-agent-completes-m1.md](./M2-agent-completes-m1.md) |
| M3 | Live billing path passed; cleanup hardening pending | [M3-billing-webhook.md](./M3-billing-webhook.md) |
| M4 | Locked | [M4-clean-machine-smoke.md](./M4-clean-machine-smoke.md) |

## New coding agent?

1. Read [validation hypothesis](../validation-hypothesis.md)
2. Read the [M2 lean contract and pass evidence](./M2-agent-completes-m1.md), then read the [M3 milestone](./M3-billing-webhook.md)
3. Read the [M3 Clerk Billing fixture workflow](../references/m3-clerk-billing-fixture.md) before touching live billing
4. Read [operating model](../validation-operating-model.md) if unclear on scope

## Evidence

Redacted artifacts live under `docs/milestones/evidence/<milestone-id>/`. See each folder's README.
