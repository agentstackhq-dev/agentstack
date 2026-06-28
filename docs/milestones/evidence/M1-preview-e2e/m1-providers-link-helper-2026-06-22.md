# M1 Providers Link Helper - 2026-06-22

Target checkbox: Connect

Status: support path improved; checkbox remains open until real preview Clerk, Convex, and Vercel resources are ledgered and linked.

## What Changed

- Added generated `scripts/m1-providers-link.mjs`.
- Added package script `m1:providers:link`.
- The helper runs the existing ledger-gated `provider link` command for the M1 preview Clerk application, Convex deployment, and Vercel project.
- The helper writes only `.agentstack/provider-links.json`.
- It does not call provider CLIs, mutate provider resources, mutate the provider ledger, or append telemetry.
- Generated M1 docs now place `m1:providers:link` immediately after `m1:ledger:record`.

## Redacted Verification

Focused commands:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts that execute from the generated project"
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
```

Result: pass.

Assertions covered:

- A generated app exposes `m1:providers:link`.
- The helper runs after generated M1 ledger rows exist.
- It links Clerk, Convex, and Vercel preview rows into `.agentstack/provider-links.json`.
- Provider-link state contains planned local links and does not contain raw external IDs.
- The helper does not append telemetry.
- Generated docs mention `m1:providers:link`.

## Blocker

No real provider links were written in the root Agentstack project. The next acceptance step still needs real owner/account/resource values, then `m1:ledger:record` and `m1:providers:link` from a generated app.
