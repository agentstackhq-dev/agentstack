# Agentstack Milestones

Validation-driven execution. **Start with the active milestone**, not the consumer readiness roadmap.

## Active milestone

**M3 implementation/live blocker**: M2 passed against live Clerk, Convex, and Vercel on 2026-06-28. M3 local
implementation and the live default-deny preview path are in place, but the real Billing grant/webhook path is blocked
because Clerk Billing is not enabled for the generated preview Clerk application. Do not start M4 or clean-machine
packaging until M3 is either validated or explicitly stopped.

## All milestones

| ID | Status | Doc |
| --- | --- | --- |
| M0 | Reference | [Hypothesis](../validation-hypothesis.md) |
| M1 | Complete | [M1-preview-e2e.md](./M1-preview-e2e.md) |
| M2 | Complete | [M2-agent-completes-m1.md](./M2-agent-completes-m1.md) |
| M3 | Implemented locally; live blocked by Clerk Billing enablement | [M3-billing-webhook.md](./M3-billing-webhook.md) |
| M4 | Locked | [M4-clean-machine-smoke.md](./M4-clean-machine-smoke.md) |

## New coding agent?

1. Read [validation hypothesis](../validation-hypothesis.md)
2. Read the [M2 lean contract and pass evidence](./M2-agent-completes-m1.md), then read the [M3 milestone](./M3-billing-webhook.md)
3. Read [operating model](../validation-operating-model.md) if unclear on scope

## Evidence

Redacted artifacts live under `docs/milestones/evidence/<milestone-id>/`. See each folder's README.
