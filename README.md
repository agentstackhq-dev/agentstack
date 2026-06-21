# Agentstack

Agentstack is an agent-first control framework for B2B SaaS teams building on Convex, Clerk, React, React Native, Vercel, Expo/EAS, and OpenTelemetry.

This prototype proves the local command contract: generate a project, inspect lifecycle state, run doctor-style preflight checks, validate the framework manifest, inspect environment state, plan and apply local-cloud sync, validate a named environment, rehearse local provider env resources, rehearse local preview and production deploy flows, inspect redacted command telemetry from the CLI, and write an `OTLP-shaped JSON` local export artifact for agent handoff. It does not provision real provider resources yet.

The current cloud implementation is a filesystem-backed local-cloud adapter. `agentstack inspect --env <env>` shows provider adapter contract status and pending provider operation IDs so agents can see the provider boundary before real API calls exist. `contract-only` means a normalized provider boundary exists, while provider mutations still run as local-cloud rehearsal in this prototype. `clerk:command-plan`, `convex:command-plan`, `vercel:command-plan`, and `eas:command-plan` mean Agentstack can print real provider CLI command shapes without executing provider mutations. `agentstack env set` writes local validation values only. `agentstack sync --env <env>` refuses missing or invalid custom env values before planning or applying provider env resources. Applied sync reconciles local provider env resource rehearsal into `.agentstack/local-cloud.json` with redacted/hash-only metadata, never raw env values. Provider operation IDs are stable and redacted; env operations expose variable names only, never values or hashes. An `env.set` operation can appear before a local value is available; sync remains the actionability gate. Provider command output labels values as coming from `.agentstack/env-values.json`, Clerk Dashboard, or provider-owned env commands and never prints raw env values. Real Stripe and hosted telemetry adapters will implement the same validation, sync, deploy, and inspection contracts later.

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
node scripts/agentstack.mjs add billing-plan pro --entitlements feature.auditLog,feature.advancedReports --seats 10
node scripts/agentstack.mjs add event billing.subscription.updated --journey billing --surfaces web,convex --state plan:string,seatCount:number
node scripts/agentstack.mjs env set --env preview --surface convex --name STRIPE_MODE --value sandbox
pnpm run inspect
pnpm run skills:inspect
pnpm run validate
pnpm run env:inspect
pnpm run preview:plan
pnpm run preview:apply
pnpm run validate:cloud
pnpm run doctor
pnpm run dev
pnpm run preview:deploy
pnpm run preview:deploy:apply
pnpm run provider:convex:preview
pnpm run provider:clerk:preview
pnpm run provider:vercel:preview
pnpm run provider:eas:preview
pnpm run prod:prepare
pnpm run prod:provision
pnpm run prod:provision:apply
pnpm run prod:validate
pnpm run prod:deploy
pnpm run prod:deploy:apply
pnpm run provider:convex:production
pnpm run provider:clerk:production
pnpm run provider:vercel:production
pnpm run provider:eas:production
pnpm run mobile:build:preview
pnpm run mobile:build:preview:apply
pnpm run telemetry:export:preview
pnpm run telemetry:export:production
node scripts/agentstack.mjs observe timeline --env preview --journey deployment
node scripts/agentstack.mjs observe timeline --env production --journey deployment
node scripts/agentstack.mjs observe timeline --env production --journey production-release
node scripts/agentstack.mjs observe timeline --env preview --journey mobile-build
node scripts/agentstack.mjs observe timeline --env development --journey billing
node scripts/agentstack.mjs observe timeline --env development --journey telemetry-generation
pnpm run observe:timeline
```

Expected smoke output includes:

```text
Created acme-crm
CREATED feature invoices
CREATED billing-plan pro
CREATED event billing.subscription.updated
PASS env set preview convex.STRIPE_MODE
WARN inspect acme-crm
PASS skills inspect
PASS validate
PASS env inspect preview
PLAN preview
APPLIED preview
PASS validate --cloud
PASS doctor preview
PASS dev preflight preview
PLAN deploy preview
APPLIED deploy preview
PLAN provider convex preview
PLAN provider clerk preview
PLAN provider vercel preview
PLAN provider eas preview
PASS prod prepare production
PLAN prod provision production
APPLIED prod provision production
PASS validate --release production
PLAN deploy production
APPLIED deploy production
PLAN provider convex production
PLAN provider clerk production
PLAN provider vercel production
PLAN provider eas production
PLAN mobile build preview
APPLIED mobile build preview
EXPORTED observe otlp-json preview <event-count>
.agentstack/exports/telemetry-preview-otlp.json
EXPORTED observe otlp-json production <event-count>
.agentstack/exports/telemetry-production-otlp.json
agentstack.deploy.completed
agentstack.mobile.build.completed
agentstack.billing-plan.added
agentstack.event.added
```

## Prototype Commands

- `create-agent-stack <app-name>` copies the B2B SaaS template into a new project directory.
- Generated apps now carry a runnable local `workspace status` vertical across shared domain, Convex, web, mobile, and unstyled `@app/ui` primitives. This is intentionally small product behavior, not only metadata anchors.
- Generated apps include a typed SaaS spine in `packages/domain/src/saas-spine.ts`, `convex/saasSpine.ts`, and `docs/agentstack/saas-spine.md` for roles, memberships, billing plans, entitlements, Clerk webhooks, and audit events.
- `agentstack add billing-plan <name> --entitlements <keys> --seats <count>` creates coordinated billing-plan anchors across domain, Convex, web, mobile, telemetry, and docs.
- `agentstack add event <name> --journey <journey> --surfaces web,mobile,convex --state key:type` creates typed app telemetry event definitions and local event docs.
- `pnpm run inspect` summarizes app identity, framework and guidance versions, generated anchor counts, enabled services, preview local-cloud state, provider adapter contract status, and pending provider operation IDs.
- `pnpm run skills:inspect` checks the versioned repo-local skill pack, prints required guidance anchors, and confirms there is no MCP dependency.
- `pnpm run doctor` runs local validation plus preview local-cloud checks and prints repair commands before provider, env, build, sync, or deploy work.
- `pnpm run dev` is a local preflight for the generated app. It keeps provider mutation out of scope and points agents at validation plus the local web, mobile, and Convex workspace-status surfaces.
- `pnpm run validate` checks the local Agentstack manifest, generated anchors, env value shape, telemetry policy, and source-secret policy through an installed `agentstack` CLI, or through `AGENTSTACK_CLI_BIN` for local source prototypes.
- `.agentstack/env-values.json` can satisfy required custom env declarations for `validate` and `validate:cloud` using the environment -> surface -> variable JSON shape. It is local validation state, not provider state.
- `pnpm run env:inspect` prints expected preview services and declared environment bindings.
- `pnpm run preview:plan` plans preview local-cloud changes without writing state.
- `pnpm run preview:apply` applies preview local-cloud state, including local provider env resource rehearsal, through the same CLI delegation path.
- `pnpm run validate:cloud` compares the project manifest with local-cloud state for the preview environment, including linked services and provider env resource presence or drift.
- `pnpm run preview:deploy` plans the local preview deploy rehearsal without writing `.agentstack/deployments/preview.json`.
- `pnpm run preview:deploy:apply` applies the local preview deploy rehearsal, writes `.agentstack/deployments/preview.json`, and records `agentstack.deploy.completed` telemetry.
- `pnpm run provider:convex:preview` prints a Convex command plan without running provider mutations. Generated projects include the Convex package so `pnpm exec convex` resolves locally. Preview planning requires `CONVEX_DEPLOY_KEY`, plans `pnpm exec convex deploy --preview-name <app-slug>-preview`, labels env values as coming from `.agentstack/env-values.json`, and leaves preview env commands scoped to `convex env --deployment <preview-deployment-name>` until the preview deployment exists.
- `pnpm run provider:clerk:preview` prints a Clerk command plan without running provider mutations. Generated projects include the Clerk CLI package so `pnpm exec clerk` resolves locally. Preview planning includes `clerk init -y`, `clerk doctor --mode agent`, `clerk env pull --mode agent`, and `clerk config pull --mode agent`.
- `pnpm run provider:vercel:preview` prints a Vercel command plan without running provider mutations. Generated projects include the Vercel package so `pnpm exec vercel` resolves locally. Preview planning requires `VERCEL_TOKEN`, requires a linked project from `vercel link` or `.vercel/project.json`, plans `pnpm exec vercel deploy --target=preview`, and labels env values as coming from `.agentstack/env-values.json`.
- `pnpm run provider:eas:preview` prints an EAS command plan without running provider mutations. Generated projects include `eas-cli` so `pnpm exec eas` resolves locally. Preview planning requires `EXPO_TOKEN`, plans `eas project:init --non-interactive`, `eas env:list --environment preview`, `eas build -p all -e preview --json --non-interactive`, and redacted EAS env create/update/delete commands.
- `pnpm run prod:prepare` checks production release readiness and reports repair commands before provision or deploy work.
- `pnpm run prod:provision` plans production local-cloud state without writing state.
- `pnpm run prod:provision:apply` applies local production state.
- `pnpm run prod:validate` runs release validation for the production release lane.
- `pnpm run prod:deploy` plans the local production deploy rehearsal without writing a deployment artifact.
- `pnpm run prod:deploy:apply` applies the local production deployment artifact only and requires explicit production confirmation through the generated script.
- `pnpm run provider:convex:production` prints a Convex production command plan without running provider mutations. It requires `CONVEX_DEPLOY_KEY`, plans `pnpm exec convex deploy`, scopes env commands to production, and marks production confirmation as required for a future provider apply slice.
- `pnpm run provider:clerk:production` prints a Clerk production command plan without running provider mutations. It requires `CLERK_SECRET_KEY`, includes the same Clerk inspection commands plus `clerk deploy --mode agent`, and marks production confirmation as required for a future provider apply slice.
- `pnpm run provider:vercel:production` prints a Vercel production command plan without running provider mutations. It requires `VERCEL_TOKEN`, requires the linked Vercel project, plans `pnpm exec vercel --prod`, and marks production confirmation as required for a future provider apply slice.
- `pnpm run provider:eas:production` prints an EAS production command plan without running provider mutations. It requires `EXPO_TOKEN`, plans store-distribution EAS builds with production confirmation, and leaves app-store submission as future provider coverage.
- `pnpm run mobile:build:preview` plans the local mobile/EAS preview build rehearsal without writing `.agentstack/builds/mobile-preview.json`.
- `pnpm run mobile:build:preview:apply` applies the local mobile build rehearsal, writes `.agentstack/builds/mobile-preview.json`, and records `agentstack.mobile.build.completed` telemetry.
- `pnpm run observe:timeline` queries redacted local command telemetry.
- `pnpm run telemetry:export:preview` and `pnpm run telemetry:export:production` write an `OTLP-shaped JSON` local export artifact from redacted store query output. Local JSONL remains the source for local inspection, and no network export or hosted provider is configured by default.
- Generated apps use `createAppTelemetry(runtime)` with `identify`, `event`, `span`, `journey`, and `redact` to create provider-neutral local envelopes. State is redacted before it appears in generated telemetry envelopes. Local CLI inspection still reads `.agentstack/events.jsonl`; this prototype writes only local export artifacts and does not configure hosted telemetry, network export, or provider ingestion.

Preview and production release commands are local rehearsals only. They do not deploy to real provider APIs.
