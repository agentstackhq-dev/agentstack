# Agentstack

Agentstack is an agent-first control framework for B2B SaaS teams building on Convex, Clerk, React, React Native, Vercel, Expo/EAS, and provider-neutral local telemetry.

This prototype proves the command contract: generate a project, inspect lifecycle state, run doctor-style preflight checks, validate the framework manifest, inspect environment state, plan and apply local-cloud sync, validate a named environment, rehearse local provider env resources, rehearse local preview and production deploy flows, inspect or apply supported provider operations explicitly, inspect redacted command telemetry from the CLI, and write an `OTLP-shaped JSON` local export artifact for agent handoff.

The current cloud implementation is a filesystem-backed local-cloud adapter plus explicit provider wrappers. `agentstack inspect --env <env>` shows provider wrapper contract status and pending provider operation IDs so agents can see the current provider boundary. `provider plan` prints deterministic provider CLI command plans without executing provider commands. `provider inspect` performs explicit read/diagnostic provider interaction for Clerk and Convex in preview or production; development is rejected. `provider apply` performs explicit Convex provider execution in preview or production; production requires `--confirm-production`, and Clerk apply is unavailable. Vercel and EAS remain command-plan/rehearsal surfaces. `agentstack env set` writes local validation values only. `agentstack sync --env <env>` refuses missing or invalid custom env values before planning or applying local provider env resources; it does not execute provider CLIs. Applied sync reconciles local provider env resource rehearsal into `.agentstack/local-cloud.json` with redacted/hash-only metadata, never raw env values. Provider operation IDs are stable and redacted; env operations expose variable names only, never values or hashes. Provider command output labels values as coming from `.agentstack/env-values.json`, Clerk Dashboard, or provider-owned env commands and never prints raw env values. Convex provider inspect/apply requires `CONVEX_DEPLOY_KEY`. Clerk provider inspect requires an authenticated Clerk CLI or `CLERK_SECRET_KEY`, depending on local setup. Stripe is represented by local billing-plan anchors and validation values, not live Stripe API integration. Telemetry currently uses local JSONL inspection and local OTLP-shaped artifact export; provider inspect/apply records redacted `agentstack.provider.inspect.completed` and `agentstack.provider.apply.completed` events.

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
pnpm run provider:convex:inspect:preview
pnpm run provider:convex:apply:preview
pnpm run provider:clerk:preview
pnpm run provider:clerk:inspect:preview
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
INSPECT provider convex preview
APPLIED provider convex preview
PLAN provider clerk preview
INSPECT provider clerk preview
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
agentstack.provider.inspect.completed
agentstack.provider.apply.completed
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
- `pnpm run provider:convex:preview` prints a deterministic Convex command plan without running provider commands. Generated projects include the Convex package so `pnpm exec convex` resolves locally. Preview planning requires `CONVEX_DEPLOY_KEY`, plans `pnpm exec convex deploy --preview-name <app-slug>-preview`, labels env values as coming from `.agentstack/env-values.json`, and leaves preview env commands scoped to `convex env --deployment <preview-deployment-name>` until the preview deployment exists.
- `pnpm run provider:convex:inspect:preview` performs explicit Convex preview read/diagnostic provider interaction and records redacted `agentstack.provider.inspect.completed` telemetry. It requires `CONVEX_DEPLOY_KEY`.
- `pnpm run provider:convex:apply:preview` performs explicit Convex preview provider execution and records redacted `agentstack.provider.apply.completed` telemetry. It requires `CONVEX_DEPLOY_KEY`; production apply requires `--confirm-production`.
- `pnpm run provider:clerk:preview` prints a deterministic Clerk command plan without running provider commands. Generated projects include the Clerk CLI package so `pnpm exec clerk` resolves locally. Preview planning includes `clerk init -y`, `clerk doctor --mode agent`, `clerk env pull --mode agent`, and `clerk config pull --mode agent`.
- `pnpm run provider:clerk:inspect:preview` performs explicit read-only Clerk preview diagnostics and records redacted `agentstack.provider.inspect.completed` telemetry. It requires an authenticated Clerk CLI or `CLERK_SECRET_KEY`, depending on local setup. Clerk apply is unavailable.
- `pnpm run provider:vercel:preview` prints a deterministic Vercel command plan without running provider commands. Generated projects include the Vercel package so `pnpm exec vercel` resolves locally. Preview planning requires `VERCEL_TOKEN`, requires a linked project from `vercel link` or `.vercel/project.json`, plans `pnpm exec vercel deploy --target=preview`, and labels env values as coming from `.agentstack/env-values.json`.
- `pnpm run provider:eas:preview` prints a deterministic EAS command plan without running provider commands. Generated projects include `eas-cli` so `pnpm exec eas` resolves locally. Preview planning requires `EXPO_TOKEN`, plans `eas project:init --non-interactive`, `eas env:list --environment preview`, `eas build -p all -e preview --json --non-interactive`, and redacted EAS env create/update/delete commands.
- `pnpm run prod:prepare` checks production release readiness and reports repair commands before provision or deploy work.
- `pnpm run prod:provision` plans production local-cloud state without writing state.
- `pnpm run prod:provision:apply` applies local production state.
- `pnpm run prod:validate` runs release validation for the production release lane.
- `pnpm run prod:deploy` plans the local production deploy rehearsal without writing a deployment artifact.
- `pnpm run prod:deploy:apply` applies the local production deployment artifact only and requires explicit production confirmation through the generated script.
- `pnpm run provider:convex:production` prints a deterministic Convex production command plan without running provider commands. It requires `CONVEX_DEPLOY_KEY`, plans `pnpm exec convex deploy`, scopes env commands to production, and marks production confirmation as required for the command-plan surface.
- `pnpm run provider:clerk:production` prints a deterministic Clerk production command plan without running provider commands. It requires `CLERK_SECRET_KEY`, includes the same Clerk inspection commands plus `clerk deploy --mode agent`, and marks production confirmation as required for the command-plan surface.
- `pnpm run provider:vercel:production` prints a deterministic Vercel production command plan without running provider commands. It requires `VERCEL_TOKEN`, requires the linked Vercel project, plans `pnpm exec vercel --prod`, and marks production confirmation as required for the command-plan surface.
- `pnpm run provider:eas:production` prints a deterministic EAS production command plan without running provider commands. It requires `EXPO_TOKEN`, plans store-distribution EAS builds with production confirmation, and keeps app-store submission outside the generated framework boundary.
- `pnpm run mobile:build:preview` plans the local mobile/EAS preview build rehearsal without writing `.agentstack/builds/mobile-preview.json`.
- `pnpm run mobile:build:preview:apply` applies the local mobile build rehearsal, writes `.agentstack/builds/mobile-preview.json`, and records `agentstack.mobile.build.completed` telemetry.
- `pnpm run observe:timeline` queries redacted local command telemetry through the `agentstack observe` namespace.
- `pnpm run telemetry:export:preview` and `pnpm run telemetry:export:production` write an `OTLP-shaped JSON` local export artifact from redacted store query output. Local JSONL remains the source for local inspection, and no network export or hosted provider is configured by default.
- Generated apps use `createAppTelemetry(runtime)` with `identify`, `event`, `span`, `journey`, and `redact` to create provider-neutral local envelopes. State is redacted before it appears in generated telemetry envelopes, and wide events carry correlation fields such as actor, org, journey, trace, release, surface, and component. Local CLI inspection still reads `.agentstack/events.jsonl`; this prototype writes only local export artifacts and does not configure hosted telemetry, network export, or provider ingestion.
- `agentstack observe` returns structured inspection objects for timeline, journey, errors, and compare modes. Agent-facing output includes a summary, timeline entries, pivots, risks, and next queries. Journey and errors modes also support JSON rendering for automation.

Preview and production release commands are local rehearsals only. Provider execution is explicit only through `agentstack provider inspect/apply`; Vercel and EAS still stay command-plan/rehearsal surfaces.
