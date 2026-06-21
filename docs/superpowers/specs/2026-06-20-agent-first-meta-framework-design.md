# Agent-First Meta-Framework Design

## Summary

The framework is an agent-first control framework for building B2B SaaS products on Convex, Clerk, React, React Native, Vercel, and Expo/EAS.

The framework's job is to keep coding agents out of vendor and configuration chaos. Agents should mostly work in lean product code: Convex functions, domain contracts, web screens, mobile screens, themeable UI composition, and app-level telemetry events. The framework owns the confusing substrate: environments, service provisioning, drift detection, auth and billing glue, mobile build profiles, deployment targets, observability wiring, and release gates.

The first golden path is:

> An agent can create a real B2B SaaS with web, backend, database, auth, billing, orgs, and mobile support, then validate and deploy it without manually coordinating Clerk, Convex, Vercel, or EAS state.

## Product Positioning

The root principle is agent-first development. The current practical motivation is a solo-founder product factory.

The product is not just a SaaS template. It is a control framework that proves itself through a B2B SaaS golden path. The framework should optimize for agents that need to bootstrap, modify, validate, build, and deploy real products without wasting time on inconsistent environment values, external dashboard drift, mobile build configuration, billing webhooks, or service-specific command trivia.

The initial stack is intentionally opinionated:

- Convex for database, backend functions, realtime, and server jobs.
- Clerk for auth, organizations, users, sessions, billing, webhooks, and entitlements.
- React on Vercel for the web application and web deployment.
- React Native with Expo/EAS for mobile applications, dev clients, preview builds, and production builds.
- OpenTelemetry for logs, traces, metrics, wide events, and provider-neutral observability.

These defaults should be wrapped behind framework adapters. The default path should be strong, but the underlying concept should remain provider-adapter based so future platforms can be added without changing the agent-facing mental model.

## System Layers

The framework has five layers.

### Manifest Layer

Wave 0 uses `agentstack.config.json` as the only Agentstack manifest format. Do not add TS-based manifest readers or alternate manifest discovery paths in this slice.

`agentstack.config.json` is the source of truth for app identity, environments, services, adapters, auth, billing, surfaces, deployment targets, enabled modules, custom environment values, and release policies.

Agents should inspect and modify declared product intent in this manifest instead of hunting through scattered `.env` files, vendor dashboards, and generated service config.

### CLI Layer

`agentstack` is the universal execution interface for humans and agents. It handles bootstrap, validation, sync, generation, build, deploy, repair, and inspection.

The CLI should be deterministic, produce agent-readable output, avoid raw secret leakage, and always express failures as actionable diagnoses with exact repair commands.

### Control-Plane Layer

The hosted control plane is optional but important. It stores connected vendor accounts, environment graphs, project state, audit logs, drift history, observability indexes, journey timelines, and production reconciliation plans.

The local CLI remains the primary agent interface. The hosted control plane gives the framework durable state, better production safety, vendor account connections, and cross-service monitoring.

### Observability Layer

The framework should rely on telemetry internally and expose observability primitives to application code and agents.

Observability is OpenTelemetry-based so events, logs, traces, and metrics can be exported to different providers later. The default model follows a wide-event philosophy: important events should carry a high-resolution, redacted snapshot of relevant system state so they can be correlated into user journeys, deployment timelines, billing timelines, and agent work timelines.

Agents should be able to add typed product events, inspect timelines, and debug behavior through framework primitives instead of stitching together raw vendor logs.

### Agent Guidance Layer

Generated repo-local docs and installable skills give agents framework-specific workflows and constraints.

The framework should not use MCP as a core integration standard. Instead, it should ship installable skills for agents that support them, plus concise repo-local instructions that work everywhere.

## Repository And Code Model

The generated repo should be a surface-first monorepo with feature-first tooling layered on top.

```txt
apps/
  web/
  mobile/
convex/
packages/
  domain/
  ui/
  theme/
  telemetry/
  config/
  agentstack-runtime/
docs/
  agentstack/
AGENTS.md
agentstack.config.json
```

The physical structure stays compatible with the underlying tools:

- `convex/` owns schema, queries, mutations, actions, webhooks, and Convex-generated API types.
- `packages/domain/` owns shared validators, business types, entitlement helpers, feature contracts, and cross-surface primitives.
- `apps/web/` owns React/Vercel screens and routes.
- `apps/mobile/` owns React Native/Expo screens and navigation.
- `packages/ui/` provides unstyled, functional primitives.
- `packages/theme/` defines the shared theme contract and styling adapters.
- `packages/telemetry/` defines typed event schemas, correlation helpers, redaction rules, journey primitives, and provider-neutral OpenTelemetry exports.
- `packages/config/` exposes typed app and environment config without leaking raw secret handling into product code.

The framework should use a hybrid generated/runtime model:

- stable substrate lives in versioned framework packages;
- product-facing modules generate readable source;
- generated boundaries are marked and validated;
- agents are encouraged to edit product files, not vendor glue or generated substrate.

Feature tooling should let agents work feature-first even though the filesystem remains surface-first:

```bash
agentstack add feature invoices --surfaces web,mobile --backend convex
agentstack add module notifications
agentstack add billing-plan pro
```

## Service Control And Environments

The framework treats external services as managed infrastructure, not manual setup steps.

The framework owns a typed environment graph across services:

```txt
development
  clerk dev app
  convex dev deployment
  vercel preview env
  eas development profile

preview
  clerk staging/preview app
  convex preview deployment
  vercel preview target
  eas preview profile

production
  clerk production app
  convex production deployment
  vercel production target
  eas production profile
```

Agents should run commands against named environments:

```bash
agentstack env inspect --env preview
agentstack env sync --env preview
agentstack validate --cloud
agentstack sync --env prod --plan
agentstack sync --env prod --apply
```

Secrets are minimized and redacted by default. Agents see secret presence, ownership, validation state, and repair commands. Raw secret access requires an explicit break-glass workflow.

### Custom Environment Values

Users must be able to define custom environment values for one or more surfaces and one or more environments without falling back to unmanaged `.env` sprawl.

Custom env values should be declared in the manifest with scope and validation:

```ts
env: {
  custom: {
    STRIPE_TAX_MODE: {
      surfaces: ["web", "convex"],
      environments: ["preview", "production"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live"
    },
    OPENAI_API_KEY: {
      surfaces: ["convex"],
      environments: ["development", "preview", "production"],
      required: false,
      secret: true
    }
  }
}
```

The framework handles:

- which surfaces receive each value;
- which environments require each value;
- whether a value is secret or public;
- whether a value can be read by an agent;
- whether a value needs cloud sync;
- whether missing or invalid values block validation or release;
- whether intentionally different web, mobile, and backend values are allowed.

### Drift Policy

Drift handling is policy-based:

- development and preview can auto-reconcile;
- production generates a plan first;
- production changes require explicit apply;
- all production mutations are audited by the hosted control plane when connected.

Example commands:

```bash
agentstack validate --cloud
agentstack sync --env preview
agentstack sync --env prod --plan
agentstack sync --env prod --apply
```

### Bootstrap Flow

Bootstrap is staged:

```bash
npx create-agent-stack my-app
cd my-app
agentstack init cloud      # development + preview
agentstack prod prepare    # domains, names, billing, mobile IDs
agentstack prod provision  # production vendor state
```

The first command gets an agent to a working full-stack dev/preview loop. Production is an explicit milestone with stronger prompts and validation.

## Validation And Agent Feedback

`agentstack validate` is the main feedback contract between the framework and coding agents.

Validation is tiered:

```bash
agentstack validate
agentstack validate --fix
agentstack validate --cloud
agentstack validate --release preview
agentstack validate --release prod
```

Default local validation is fast:

- lint;
- formatting;
- typecheck;
- tests;
- Convex schema and function checks;
- generated boundary checks;
- telemetry schema and redaction checks;
- theme and token checks;
- agent doc and framework version alignment;
- manifest shape validation;
- custom env declaration validation.

Cloud validation checks live service coherence:

- Clerk app, auth, billing, and webhook state;
- Convex deployment and env state;
- Vercel project, env, and deployment state;
- EAS project, profile, and build config;
- OpenTelemetry exporter and collector state;
- webhook URLs and signing secrets;
- public/private env exposure;
- cross-surface env parity;
- custom env presence and drift.

Release validation is deploy-blocking:

- environment graph complete;
- production drift plan clean or approved;
- billing plans and entitlements coherent;
- auth redirects and domains correct;
- mobile bundle IDs and profiles correct;
- web production envs synced;
- production telemetry export configured or explicitly disabled;
- event redaction policy active;
- generated files not manually corrupted;
- no raw secrets leaked into the repo;
- no forbidden direct vendor mutations pending.

Failures should be agent-actionable instead of raw tool dumps:

```txt
FAIL env.preview.CLERK_WEBHOOK_SECRET
Convex preview expects a Clerk webhook secret, but Clerk preview has no matching webhook.
Fix: agentstack env sync --env preview --service clerk
Blocks: validate --cloud, validate --release preview
```

This creates a short correction loop: change code, run validate, apply the suggested command, re-run validate.

## Telemetry, Logging, And Journeys

Telemetry is a core substrate concern. The framework should use it internally and expose it as a first-class application primitive.

The foundation is OpenTelemetry:

- traces for request, action, job, deploy, build, and agent-command flows;
- logs for structured diagnostic events;
- metrics for counters, gauges, durations, queue depth, build times, and release health;
- OTLP export as the default provider-neutral path;
- provider adapters added later without changing application event code.

The event model should follow a wide-event philosophy. Instead of emitting many tiny, disconnected log lines, important events should carry a high-resolution snapshot of relevant state:

```ts
telemetry.event("billing.subscription.updated", {
  journey: "billing",
  actor: currentActor(),
  org: currentOrg(),
  entitlementState,
  clerkSubscriptionId,
  convexMutation: "billing.applySubscriptionUpdate",
  environment: "preview",
  surface: "convex",
  correlationId,
  redaction: "billing-safe"
})
```

Wide events should be:

- typed and versioned;
- correlated across web, mobile, Convex, Clerk webhooks, deploys, builds, and CLI commands;
- redacted by default;
- safe to inspect in agent workflows;
- exportable through OpenTelemetry;
- presentable as timelines and journeys.

Core correlation concepts:

- `traceId` for technical execution flow;
- `correlationId` for cross-service operation grouping;
- `journeyId` for user or workflow journeys;
- `actorId` for the human, system, or agent initiating work;
- `orgId` for tenant context;
- `environment` for development, preview, or production;
- `surface` for web, mobile, convex, clerk, vercel, eas, cli, or control-plane;
- `releaseId` for deploy/build lineage.

The framework should provide built-in journeys:

- authentication journey;
- onboarding journey;
- billing journey;
- entitlement journey;
- webhook journey;
- feature usage journey;
- deployment journey;
- mobile build journey;
- environment sync journey;
- validation journey;
- agent command journey.

Agents should be able to use observability without learning a vendor-specific logging product:

```bash
agentstack observe timeline --journey billing --env preview
agentstack observe user --id user_123 --env production --redacted
agentstack observe release --release latest --surface web
agentstack observe validate --env preview
```

The agent-facing observability interface should be broad enough to dissect the state of the system in any environment, including production. When something goes wrong, an agent should not need direct access to five vendor dashboards or a provider-specific query language before it can form a useful hypothesis.

The inspection surface should support flexible filters:

- environment: development, preview, production;
- surface: web, mobile, convex, clerk, vercel, eas, cli, control-plane;
- component: route, screen, Convex function, webhook, build profile, deployment, adapter, module;
- actor: user, org, system, agent, service account;
- time window;
- event name or event family;
- trace ID, correlation ID, journey ID, release ID, build ID, deployment ID;
- error class, validation check, or command name.

Example inspection commands:

```bash
agentstack observe query --env production --surface convex --event billing.*
agentstack observe trace --id trace_123 --env production
agentstack observe journey --id journey_123 --include-state
agentstack observe errors --env production --since 2h --group-by component
agentstack observe webhook clerk --env production --since 24h
agentstack observe component convex:billing.applySubscriptionUpdate --env production
agentstack observe compare --env preview,production --journey onboarding
```

Production inspection should be safe but useful:

- redacted by default;
- scoped by role and project permissions;
- able to require an access reason for sensitive production views;
- audited by the control plane when connected;
- explicit about hidden/redacted fields so agents know when data is unavailable;
- able to produce shareable incident timelines without exposing secrets or sensitive personal data.

The output should be optimized for agent reasoning:

- chronological timelines;
- grouped error summaries;
- correlated spans, events, logs, metrics, and state snapshots;
- likely-cause hints when validation or known adapter checks match the symptoms;
- exact next commands for deeper inspection or repair;
- links or references to raw provider records when available and permitted.

Application-facing primitives should be lean:

- `telemetry.event()` for wide events;
- `telemetry.span()` for explicit work scopes;
- `telemetry.journey()` for user or workflow timelines;
- `telemetry.identify()` for safe actor/org context;
- `telemetry.redact()` for policy-backed redaction;
- framework-owned auto-instrumentation for CLI commands, Convex functions, web routes, mobile navigation, Clerk webhooks, Vercel deploys, and EAS builds.

The manifest should declare telemetry policy:

```ts
telemetry: {
  enabled: true,
  exporter: "otlp",
  environments: {
    development: { destination: "local", sampleRate: 1 },
    preview: { destination: "control-plane", sampleRate: 1 },
    production: { destination: "otlp", sampleRate: 0.25 }
  },
  redaction: {
    defaultPolicy: "strict",
    allowUserJourneyViews: true,
    forbidRawSecrets: true
  }
}
```

Validation should enforce that telemetry is useful and safe:

- event schemas are valid;
- wide events include required correlation fields;
- secret and PII redaction policies are active;
- production export is configured or explicitly disabled;
- local development has a readable sink;
- no framework-owned event is silently dropped;
- generated observability docs match framework version.

The hosted control plane can store or index telemetry where configured, but the app should not depend on the hosted control plane as the only backend. OpenTelemetry export keeps the framework provider-neutral.

## Full-Stack Type Safety And SaaS Modules

The framework should treat type safety as an agent affordance.

Convex remains the backend type anchor:

- schema defines stored data shape;
- generated Convex API types define callable backend surface;
- web and mobile consume typed queries, mutations, and actions;
- validators protect inputs at runtime;
- TypeScript catches broken cross-surface changes quickly.

`packages/domain/` adds shared product contracts:

- business validators;
- form schemas;
- entitlement helpers;
- role and permission definitions;
- feature contracts;
- shared app types that are not purely database types.

The mandatory core SaaS spine includes:

- users;
- identities;
- orgs and teams;
- memberships;
- roles;
- Clerk billing state;
- entitlements;
- webhook ingestion;
- audit events.

Optional typed modules include:

- invites and onboarding;
- notifications;
- feature flags;
- usage metering;
- file and media metadata;
- admin tools;
- activity feeds;
- background jobs.

When an agent changes product behavior, the compiler and validators should guide the change through database, backend, web, and mobile. For example, adding a billing entitlement should create or update:

- Clerk plan/product mapping;
- Convex entitlement tables and functions;
- shared domain helper;
- web gate component;
- mobile gate component;
- validation checks;
- docs or agent instructions if needed.

## UI, Theme, And Styling

The framework should provide unstyled but functionally complete UI primitives, plus a strict shared theme contract.

It should not force one visual design. Instead, it should give agents solid behavior and accessibility foundations:

- auth gate;
- org switcher;
- user/account menu;
- billing/plan gate;
- settings sections;
- data table behavior;
- forms and validation wiring;
- modals, drawers, and sheets;
- empty, loading, and error states;
- command and search patterns;
- mobile-safe lists;
- navigation shells.

Styling lives through a theme contract:

```ts
theme: {
  color: "...",
  typography: "...",
  spacing: "...",
  radius: "...",
  shadow: "...",
  motion: "...",
  density: "..."
}
```

The default strategy is shared foundations and platform-native screens:

- tokens shared across web and mobile;
- unstyled behavior primitives shared where possible;
- screen composition can differ between web and mobile;
- complex UI can be implemented separately per surface;
- accessibility and interaction expectations stay consistent.

The framework should include styling adapters behind wrappers, likely starting with a blessed default such as Tailwind for web plus an Expo-compatible mobile styling path.

Agent support should include:

```bash
agentstack theme init
agentstack theme validate
agentstack theme audit --contrast
agentstack add screen settings --surface web,mobile
```

Installable theming and styling skills should give agents concrete patterns and anti-patterns.

Validation should catch:

- missing tokens;
- contrast failures;
- accidental hardcoded colors;
- web/mobile token drift;
- inaccessible interaction states;
- text overflow in common primitives;
- unsafe generated UI edits.

## Agent Guidance And Enforcement

Every generated project should contain both instructions and mechanical guardrails.

Repo-local guidance:

```txt
AGENTS.md
docs/agentstack/
  workflows.md
  environments.md
  validation.md
  observability.md
  release.md
  theming.md
  generated-boundaries.md
```

`AGENTS.md` should stay concise:

- use `agentstack validate` before completion;
- use `agentstack env` and `agentstack sync` instead of editing vendor envs manually;
- do not edit generated/vendor glue directly;
- use feature/module generators where possible;
- use framework telemetry primitives for product events and diagnostics;
- respect secret handling rules;
- release only through framework commands.

Installable skills provide deeper workflows:

- bootstrap a new app;
- add a feature;
- repair env drift;
- configure custom env values;
- add typed telemetry events and inspect user journeys;
- style and theme a product;
- run mobile dev client builds;
- prepare production;
- perform release validation;
- debug auth, billing, webhook, and journey issues.

Mechanical enforcement:

- generated boundary markers;
- source policy checks;
- secret scanning;
- telemetry schema and redaction checks;
- manifest and schema validation;
- adapter drift detection;
- release gates;
- command output designed for agents;
- optional hosted audit logs.

The agent guidance layer should be versioned with the framework. If a project uses `agentstack@0.4`, docs and skills should match `0.4`, and `validate` should warn if guidance is stale.

## Command Surface And Lifecycle

The CLI should be small, memorable, and lifecycle-oriented.

Core commands:

```bash
agentstack init cloud
agentstack dev
agentstack validate
agentstack sync
agentstack generate
agentstack add
agentstack build
agentstack deploy
agentstack observe
agentstack prod
agentstack inspect
agentstack doctor
```

Observability subcommands should provide a flexible inspection surface:

```bash
agentstack observe timeline
agentstack observe query
agentstack observe trace
agentstack observe journey
agentstack observe user
agentstack observe org
agentstack observe release
agentstack observe build
agentstack observe errors
agentstack observe webhook
agentstack observe component
agentstack observe compare
```

Expected lifecycle:

```bash
npx create-agent-stack my-app
cd my-app
agentstack init cloud
agentstack dev
agentstack validate
agentstack add feature invoices --surfaces web,mobile --backend convex
agentstack observe timeline --journey onboarding --env preview
agentstack validate --cloud
agentstack deploy preview
agentstack prod prepare
agentstack validate --release prod
agentstack prod provision
agentstack deploy prod
```

Command design rules:

- every command reads from `agentstack.config.json`;
- every cloud-mutating command supports `--plan`;
- production mutations require explicit `--apply`;
- output is structured and agent-readable;
- failures include exact repair commands;
- commands avoid leaking raw secrets;
- generated files are deterministic;
- telemetry commands return redacted, correlated timelines by default;
- vendor adapters expose normalized diagnostics.

## Design Principles

The framework should follow these principles:

- Agent-first architecture, solo-founder SaaS as the first wedge.
- Mechanistic enforcement around the substrate where mistakes are expensive.
- Normal Convex, React, and React Native product code where flexibility matters.
- Manifest-driven service state rather than dashboard-driven guesswork.
- Full-stack type safety as a core affordance for agents.
- Strong default providers wrapped by replaceable adapters.
- Fast local validation, explicit cloud validation, hard release gates.
- Custom environment values allowed only as scoped, declared, validated state.
- Secrets minimized, redacted, rotated, and validated by default.
- OpenTelemetry-based observability with wide, typed, redacted events.
- User, system, deploy, and agent journeys presentable as correlated timelines.
- Generated source where agents need to reason about product behavior.
- Runtime packages where behavior should stay stable and framework-owned.
- Shared UI foundations with platform-native screen composition.
- Repo-local instructions plus installable skills, not MCP as a core dependency.

## First Prototype Slice

The first serious prototype should prove the hardest and most differentiating workflow:

1. `npx create-agent-stack my-app` creates the monorepo, manifest, local docs, generated core SaaS spine, web app, mobile app, Convex backend, telemetry primitives, and theme foundations.
2. `agentstack init cloud` provisions or links development and preview resources across Convex, Clerk, Vercel, and EAS.
3. `agentstack validate` runs a fast local gate.
4. `agentstack validate --cloud` currently checks local-cloud rehearsal state and reports repair commands; future provider adapters can extend this into live service coherence validation.
5. `agentstack add feature <name>` generates a typed feature across Convex, domain, web, and mobile.
6. `agentstack observe timeline --journey onboarding --env preview` proves correlated, redacted journey inspection works across the generated app.
7. `agentstack deploy preview` deploys the web/backend preview and prepares the matching mobile preview path.

Production provisioning can follow once the dev/preview loop proves that the framework can make agents reliably productive across the whole stack.
