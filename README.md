# Agentstack

Agentstack is an agent-first control framework for B2B SaaS teams building on Convex, Clerk, React, React Native, Vercel, Expo/EAS, and OpenTelemetry.

This prototype proves the local command contract: generate a project, validate the framework manifest, inspect environment state, plan and apply local-cloud sync, validate a named environment, rehearse a local preview deploy, and inspect redacted command telemetry from the CLI. It does not provision real provider resources yet.

The current cloud implementation is a filesystem-backed local-cloud adapter. Real Convex, Clerk, Vercel, EAS, Stripe, and telemetry adapters will implement the same validation, sync, deploy, and inspection contracts.

## Local Smoke

From the repository root:

```bash
pnpm install
pnpm typecheck
pnpm test

rm -rf tmp/acme-crm
mkdir -p tmp
cd tmp
../node_modules/.bin/tsx ../packages/create-agent-stack/src/bin.ts acme-crm
cd acme-crm
export AGENTSTACK_CLI_BIN=../../packages/cli/src/bin.ts
export AGENTSTACK_TSX_BIN=../../node_modules/.bin/tsx
node scripts/agentstack.mjs add feature invoices --surfaces web,mobile --backend convex
node scripts/agentstack.mjs env set --env preview --surface convex --name STRIPE_MODE --value sandbox
pnpm run validate
pnpm run env:inspect
pnpm run sync:preview
pnpm run sync:preview:apply
pnpm run validate:cloud
pnpm run preview:deploy
pnpm run preview:deploy:apply
node scripts/agentstack.mjs observe timeline --env preview --journey deployment
pnpm run observe:timeline
```

Expected smoke output includes:

```text
Created acme-crm
CREATED feature invoices
PASS env set preview convex.STRIPE_MODE
PASS validate
PASS env inspect preview
PLAN preview
APPLIED preview
PASS validate --cloud
PLAN deploy preview
APPLIED deploy preview
agentstack.deploy.completed
```

## Prototype Commands

- `create-agent-stack <app-name>` copies the B2B SaaS template into a new project directory.
- `pnpm run validate` checks the local Agentstack manifest, generated anchors, env value shape, telemetry policy, and source-secret policy through an installed `agentstack` CLI, or through `AGENTSTACK_CLI_BIN` for local source prototypes.
- `.agentstack/env-values.json` can satisfy required custom env declarations for `validate` and `validate:cloud` using the environment -> surface -> variable JSON shape.
- `pnpm run env:inspect` prints expected preview services and declared environment bindings.
- `pnpm run sync:preview` plans preview local-cloud changes without writing state.
- `pnpm run sync:preview:apply` applies preview local-cloud state through the same CLI delegation path.
- `pnpm run validate:cloud` compares the project manifest with local-cloud state for the preview environment.
- `pnpm run preview:deploy` plans the local preview deploy rehearsal without writing `.agentstack/deployments/preview.json`.
- `pnpm run preview:deploy:apply` applies the local preview deploy rehearsal, writes `.agentstack/deployments/preview.json`, and records `agentstack.deploy.completed` telemetry.
- `pnpm run observe:timeline` queries redacted local command telemetry.

Preview deploy commands are local rehearsals only. They do not deploy to real provider APIs.
