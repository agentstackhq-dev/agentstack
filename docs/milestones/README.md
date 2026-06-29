# Agentstack Milestones

Validation-driven execution. **Start with the active milestone**, not the consumer readiness roadmap.

## Active milestone

**M4 local-pack clean-machine smoke passed** on 2026-06-29. The framework packed local Agentstack workspace packages,
installed the packed public `agentstack` package into a clean temp consumer workspace, generated a lean app from the
tarball-provided `agentstack` bin, installed the generated app from tarball specs plus `pnpm.overrides`, and passed
`validate` plus `dev:check` without monorepo source `link:` dependencies. Do not start M5, public npm publishing,
hosted control-plane work, production gates, or live provider mutation from M4.

## All milestones

| ID | Status | Doc |
| --- | --- | --- |
| M0 | Reference | [Hypothesis](../validation-hypothesis.md) |
| M1 | Complete | [M1-preview-e2e.md](./M1-preview-e2e.md) |
| M2 | Complete | [M2-agent-completes-m1.md](./M2-agent-completes-m1.md) |
| M3 | Live billing path passed; cleanup hardening pending | [M3-billing-webhook.md](./M3-billing-webhook.md) |
| M4 | Complete | [M4-clean-machine-smoke.md](./M4-clean-machine-smoke.md) |

## New coding agent?

1. Read [validation hypothesis](../validation-hypothesis.md)
2. Read the [M2 lean contract and pass evidence](./M2-agent-completes-m1.md), then read the [M3 milestone](./M3-billing-webhook.md)
3. Read the [M4 local-pack clean-machine smoke](./M4-clean-machine-smoke.md)
4. Read [operating model](../validation-operating-model.md) if unclear on scope

## Evidence

Redacted artifacts live under `docs/milestones/evidence/<milestone-id>/`. See each folder's README.
