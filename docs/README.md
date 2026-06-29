# Agentstack Docs

Last reviewed: 2026-06-29

Use this index to avoid stale-context drift. Active execution follows milestones; long readiness docs and early
superpowers plans are historical or backlog references unless a milestone points to them.

## Start Here

| Document | Status | Use for |
| --- | --- | --- |
| [../README.md](../README.md) | Current | Repo overview and local commands |
| [../AGENTS.md](../AGENTS.md) | Current | Agent execution rules and current milestone boundary |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | Current | Package boundaries, generated-app boundary, provider/evidence model |
| [validation-hypothesis.md](./validation-hypothesis.md) | Current | North-star hypothesis and milestone ladder |
| [validation-operating-model.md](./validation-operating-model.md) | Current | How to run milestone spike/unblock/runtime/documentation work |
| [milestones/README.md](./milestones/README.md) | Current | Active milestone state and next-stop rules |

## Milestones And Evidence

| Document | Status | Notes |
| --- | --- | --- |
| [milestones/M1-preview-e2e.md](./milestones/M1-preview-e2e.md) | Complete | Provider-path spike; do not revive generated docs/scripts as the product contract |
| [milestones/M2-agent-completes-m1.md](./milestones/M2-agent-completes-m1.md) | Complete | Lean generated app and package-owned CLI contract |
| [milestones/M3-billing-webhook.md](./milestones/M3-billing-webhook.md) | Live pass, cleanup pending | Clerk Billing webhook and `feature.auditLog` entitlement proof |
| [milestones/M4-clean-machine-smoke.md](./milestones/M4-clean-machine-smoke.md) | Locked | Public/local package installability proof; do not start without approach discussion |
| [milestones/evidence/](./milestones/evidence/) | Redacted evidence | Evidence files are append-only historical proof, not active runbooks unless referenced by a milestone |

## Operational References

| Document | Status | Notes |
| --- | --- | --- |
| [provider-resource-ledger.md](./provider-resource-ledger.md) | Current | Required before/after any real provider resource create/link/mutate/cleanup |
| [references/local-quickstart.md](./references/local-quickstart.md) | Current | Local source checkout generation, PATH binary checks, and package-spec repair |
| [references/m3-clerk-billing-fixture.md](./references/m3-clerk-billing-fixture.md) | Current | Repeatable M3 Clerk Billing setup, payment-method handoff, subscription, replay, cleanup |

## Backlog And Historical Rationale

| Document | Status | Notes |
| --- | --- | --- |
| [consumer-production-readiness-roadmap.md](./consumer-production-readiness-roadmap.md) | Backlog snapshot | Useful for long-term gaps; pre-M2 status details are superseded by M1-M3 milestones |
| [consumer-production-readiness-progress.md](./consumer-production-readiness-progress.md) | Archived | Do not extend slice-by-slice |
| [superpowers/specs/2026-06-20-agent-first-meta-framework-design.md](./superpowers/specs/2026-06-20-agent-first-meta-framework-design.md) | Historical design seed | Original design intent; generated surface and config format were corrected by M2 |
| [superpowers/specs/2026-06-28-agentstack-m3-clerk-billing-webhook-design.md](./superpowers/specs/2026-06-28-agentstack-m3-clerk-billing-webhook-design.md) | Implemented design | M3 design rationale; milestone doc is the current pass/fail state |
| [superpowers/plans/](./superpowers/plans/) | Historical execution plans | Preserve rationale, but verify against current code before following commands |

## Documentation Health Rules

- Keep `AGENTS.md` concise and link out to canonical docs.
- Prefer updating `README.md`, `ARCHITECTURE.md`, this index, and the active milestone card over adding new one-off docs.
- Mark historical docs explicitly when newer milestones supersede their command or generated-surface assumptions.
- Do not write secrets, raw provider stdout, cookies, smoke-user passwords, setup intent secrets, or webhook signing
  secrets into docs.
- When code or templates change, update template mirror docs and run:

```sh
diff -rq templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
corepack pnpm typecheck
corepack pnpm test
git diff --check
```
