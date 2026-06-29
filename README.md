# Agentstack

Agentstack is an agent-first meta-framework for generating and operating lean B2B SaaS apps on Convex, Clerk,
React/Vercel, React Native/Expo/EAS, and local provider-neutral telemetry.

The product boundary is deliberate: a generated consumer app is an app that depends on `agentstack`. It does not carry
copied framework docs, copied scripts, provider ledgers, or runbooks. Agentstack owns that glue through package commands,
typed config, diagnostics, hidden `.agentstack/` runtime state, and framework-repo evidence.

## Current State

Last reviewed: 2026-06-29

| Milestone | State | Evidence |
| --- | --- | --- |
| M1 Preview E2E | Complete provider-path spike | [M1](./docs/milestones/M1-preview-e2e.md) |
| M2 Lean preview | Complete live package-owned path | [M2](./docs/milestones/M2-agent-completes-m1.md) |
| M3 Billing webhook | Live billing path passed; cleanup pending | [M3](./docs/milestones/M3-billing-webhook.md) |
| M4 Clean-machine smoke | Locked until the M4 approach is discussed | [M4](./docs/milestones/M4-clean-machine-smoke.md) |

M3 has passed the live Clerk Billing webhook and `feature.auditLog` entitlement proof. The active non-M4 gap is cleanup
of retained M3 smoke billing resources and any docs/maintenance work needed to keep M1-M3 evidence usable.

## Repository Map

- [AGENTS.md](./AGENTS.md) - execution rules for coding agents in this repo.
- [ARCHITECTURE.md](./ARCHITECTURE.md) - current package, runtime, provider, and generated-app boundaries.
- [docs/README.md](./docs/README.md) - documentation index and status map.
- [docs/validation-hypothesis.md](./docs/validation-hypothesis.md) - north-star hypothesis and milestone ladder.
- [docs/milestones/README.md](./docs/milestones/README.md) - active milestone state and evidence locations.
- [docs/provider-resource-ledger.md](./docs/provider-resource-ledger.md) - required ledger for real provider resources.
- [docs/references/m3-clerk-billing-fixture.md](./docs/references/m3-clerk-billing-fixture.md) - repeatable Clerk Billing fixture workflow.

## Package Layout

```text
packages/agentstack          Public package facade and `agentstack` bin
packages/create-agent-stack  Lean app generator and B2B SaaS template
packages/cli                 Agentstack command implementation
packages/core                Manifest schema, validation, guidance, release, theme, billing contracts
packages/adapters            Provider command plans, proof contracts, ledger, and provider executors
packages/telemetry           Local wide-event telemetry store and OTLP-shaped export helpers
templates/b2b-saas           Root template mirror kept aligned with package-local template
tests/e2e                    Consumer workflow smoke against the package boundary
```

The generated app root is intentionally small:

```text
apps/mobile
apps/web
apps/convex
agentstack.config.ts
AGENTS.md
.gitignore
package.json
```

Package-manager lockfiles may appear after install. Hidden `.agentstack/` files may hold provider links, evidence,
auth fixtures, deploy metadata, billing fixture state, and smoke artifacts.

## Local Development

Install and verify from the framework repo root:

```sh
corepack pnpm install
corepack pnpm typecheck
corepack pnpm test
```

Generate a local consumer app through the product boundary:

```sh
rm -rf /tmp/agentstack-smoke
mkdir -p /tmp/agentstack-smoke
cd /tmp/agentstack-smoke
<agentstack-repo>/node_modules/.bin/tsx \
  <agentstack-repo>/packages/agentstack/src/bin.ts \
  create smoke-app \
  --package-spec link:<agentstack-repo>/packages/agentstack
cd smoke-app
corepack pnpm install
corepack pnpm run validate
```

Live preview and billing flows require authenticated provider CLIs plus explicit live-mutation confirmations. Use the
milestone docs rather than older readiness-progress logs for those commands.

## Core Generated Scripts

Generated app `package.json` scripts call the installed `agentstack` CLI:

```text
validate
dev
provider:bootstrap
provider:link
auth:user
billing:bootstrap
billing:fixture
billing:smoke
preview:deploy
preview:smoke
evidence:check
```

M3 billing subscription is repeatable with:

```sh
pnpm run billing:fixture -- subscribe --env preview --entitlement feature.auditLog --confirm-live-mutation
```

If that command requires a Clerk test payment method, follow
[docs/references/m3-clerk-billing-fixture.md](./docs/references/m3-clerk-billing-fixture.md).

## Verification Policy

For framework changes, run focused tests for touched code, then:

```sh
corepack pnpm typecheck
corepack pnpm test
git diff --check
```

If templates change, verify both template mirrors stay aligned:

```sh
diff -rq templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

For live-provider work, update the active milestone card, append redacted evidence under
`docs/milestones/evidence/<milestone-id>/`, and ledger every real provider resource before or immediately after use.
