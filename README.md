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
node scripts/agentstack.mjs add event billing.subscription.updated --journey billing --surfaces web,convex --state plan:string,seatCount:number
node scripts/agentstack.mjs env set --env preview --surface convex --name STRIPE_MODE --value sandbox
pnpm run validate
pnpm run env:inspect
pnpm run sync:preview
pnpm run sync:preview:apply
pnpm run validate:cloud
pnpm run preview:deploy
pnpm run preview:deploy:apply
pnpm run mobile:build:preview
pnpm run mobile:build:preview:apply
node scripts/agentstack.mjs observe timeline --env preview --journey deployment
node scripts/agentstack.mjs observe timeline --env preview --journey mobile-build
node scripts/agentstack.mjs observe timeline --env development --journey telemetry-generation
pnpm run observe:timeline
```

Expected smoke output includes:

```text
Created acme-crm
CREATED feature invoices
CREATED event billing.subscription.updated
PASS env set preview convex.STRIPE_MODE
PASS validate
PASS env inspect preview
PLAN preview
APPLIED preview
PASS validate --cloud
PLAN deploy preview
APPLIED deploy preview
PLAN mobile build preview
APPLIED mobile build preview
agentstack.deploy.completed
agentstack.mobile.build.completed
agentstack.event.added
```

## Prototype Commands

- `create-agent-stack <app-name>` copies the B2B SaaS template into a new project directory.
- Generated apps include a typed SaaS spine in `packages/domain/src/saas-spine.ts`, `convex/saasSpine.ts`, and `docs/agentstack/saas-spine.md` for roles, memberships, billing plans, entitlements, Clerk webhooks, and audit events.
- `agentstack add event <name> --journey <journey> --surfaces web,mobile,convex --state key:type` creates typed app telemetry event definitions and local event docs.
- `pnpm run validate` checks the local Agentstack manifest, generated anchors, env value shape, telemetry policy, and source-secret policy through an installed `agentstack` CLI, or through `AGENTSTACK_CLI_BIN` for local source prototypes.
- `.agentstack/env-values.json` can satisfy required custom env declarations for `validate` and `validate:cloud` using the environment -> surface -> variable JSON shape.
- `pnpm run env:inspect` prints expected preview services and declared environment bindings.
- `pnpm run sync:preview` plans preview local-cloud changes without writing state.
- `pnpm run sync:preview:apply` applies preview local-cloud state through the same CLI delegation path.
- `pnpm run validate:cloud` compares the project manifest with local-cloud state for the preview environment.
- `pnpm run preview:deploy` plans the local preview deploy rehearsal without writing `.agentstack/deployments/preview.json`.
- `pnpm run preview:deploy:apply` applies the local preview deploy rehearsal, writes `.agentstack/deployments/preview.json`, and records `agentstack.deploy.completed` telemetry.
- `pnpm run mobile:build:preview` plans the local mobile/EAS preview build rehearsal without writing `.agentstack/builds/mobile-preview.json`.
- `pnpm run mobile:build:preview:apply` applies the local mobile build rehearsal, writes `.agentstack/builds/mobile-preview.json`, and records `agentstack.mobile.build.completed` telemetry.
- `pnpm run observe:timeline` queries redacted local command telemetry.
- Generated apps use `createAppTelemetry(runtime).event(definition, state)` to create provider-neutral typed envelopes. This prototype does not export app telemetry to OTLP or a hosted provider.

Preview deploy commands are local rehearsals only. They do not deploy to real provider APIs.
