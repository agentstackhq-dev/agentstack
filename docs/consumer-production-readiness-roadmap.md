# Agentstack Consumer Production Readiness Roadmap

## Verdict

Agentstack is roughly 30-35% of the way toward consumer production readiness.

The prototype has a strong command-contract foundation: generation works, the CLI surface is broad, local structural validation is coherent, provider command planning exists, and the test suite currently passes at 25 files / 309 tests. It is not yet a consumer-ready production framework. The weak areas are live runtime behavior, real provider reconciliation, truthful validation gates, installability from public packages, hosted control-plane state, and production observability.

The current phase is best described as a local command-contract and rehearsal prototype. It can teach agents the intended workflow, but it cannot yet reliably create, validate, deploy, observe, and operate a real Clerk-authenticated, Convex-backed, Vercel-hosted, Expo/EAS-built SaaS product without manual provider coordination.

## Source Of Truth

| Source | Role | Current implication |
| --- | --- | --- |
| `docs/superpowers/specs/2026-06-20-agent-first-meta-framework-design.md` | Authoritative product and architecture spec | Defines Agentstack as an agent-first control framework, not a template. The golden path requires real B2B SaaS creation, validation, deployment, provider coordination, telemetry, and release gates. |
| `docs/provider-resource-ledger.md` | Provider resource accounting policy | Establishes that every real external provider resource must be tracked, cleaned up, and evidenced. The ledger currently records no real provider resources. |
| `packages/cli/src/run.ts` and `packages/cli/src/run.test.ts` | Current CLI contract and command tests | CLI includes validate, inspect, doctor, dev, sync, deploy, provider, prod, build, theme, skills, env, add, init, and observe surfaces. |
| `packages/adapters/src/*` | Provider adapter implementation surface | Convex provider execution is most advanced; Clerk, Vercel, and EAS are partial and uneven. |
| `templates/b2b-saas/` and `packages/create-agent-stack/templates/b2b-saas/` | Generated app behavior | Generated app is a runnable workspace-status shell with metadata, docs, local telemetry, and anchors, not a complete SaaS runtime. |
| `tests/e2e/prototype.test.ts` | End-to-end prototype evidence | Proves the local workflow and rehearsal loop, including local-cloud sync, preview deploy rehearsal, mobile build rehearsal, production release rehearsal, and local observability artifacts. |
| `package.json` and package manifests | Packaging and release state | Packages remain private, 0.0.0, source-first, and not yet a public npm-ready consumer distribution. |

## Source Spec Mismatch

The source spec names `agentstack.config.ts` as the manifest source of truth. The current repository consistently uses `agentstack.config.json` across templates, CLI context loading, tests, generated docs, and mobile config.

This must be resolved as a deliberate product decision, not treated as compatibility work. Because this is green-field, Agentstack should choose one manifest format and replace the other coherently across code, templates, docs, tests, package-local mirrors, generated guidance, and validation. Do not add dual readers, deprecated aliases, migration shims, or fallback behavior unless a named compatibility reason is explicitly approved.

## Source-Spec Capability Coverage Matrix

The roadmap is directionally faithful to the source spec, but the source-spec coverage audit shows several capabilities that need earlier or clearer placement.

| Capability | Source-spec intent | Current capability | Roadmap implication |
| --- | --- | --- | --- |
| Manifest source of truth | One agent-readable manifest drives generation, validation, provider plans, telemetry, and runtime boundaries. | `agentstack.config.json` is used throughout the repo while the source spec names `agentstack.config.ts`. | Wave 0 must make the manifest format decision once and update code, templates, docs, tests, and generated guidance coherently. |
| Command vocabulary | Agents need a stable final command language for generating, adding, validating, syncing, deploying, observing, and releasing. | Broad CLI routing exists through `validate`, `inspect`, `doctor`, `dev`, `sync`, `deploy`, `provider`, `prod`, `build`, `theme`, `skills`, `env`, `add`, `init`, and `observe`. Feature, billing, and event generators currently live under `add`. | Wave 1 must decide the final vocabulary, including whether the source-spec `generate` language replaces or complements current `add` semantics. Do not add compatibility aliases without an approved public-compatibility reason. |
| Runtime vs generated package boundary | Framework packages and generated app code need a clear ownership boundary. | Generated templates, package-local mirrors, and source-first package wiring exist, but public package installability and runtime package contracts are not final. | Wave 1 must define package/runtime/generated boundaries before installability and validation are treated as consumer-ready. |
| Provider inventory, link, and adopt | Agents should discover and connect to existing resources before mutation. | Provider command planning exists. Bounded Convex/Vercel provider apply exists. Clerk, Convex, and EAS inspect are read-only or partial. | Provider inventory/link/adopt remains ahead of broad mutation. Apply paths should expand only after resource identities are ledger-tracked and evidence-labeled. |
| Hosted control-plane account connections | Durable account connection design should support provider identity, audit, drift, access control, and evidence. | Hosted control plane and account connection flows are missing. | Keep hosted control plane as a later durable-state milestone, but define account connection design constraints during provider inventory work so local state does not paint the platform into a corner. |
| Agent-facing observability contract | Agents need early, explicit observability semantics for commands, provider plans, generated runtime events, preview, and production. | Local telemetry JSONL and OTLP-shaped export artifacts exist. Hosted telemetry and real production export are not implemented. | Move preview/runtime observability decisions earlier than hosted control plane. Wave 1 defines telemetry manifest policy; Waves 3-4 make generated runtime and preview telemetry real. |
| Telemetry manifest policy | Manifest should declare OTel/OTLP destinations, sampling, redaction, retention, and production export semantics. | Local telemetry definitions and export artifacts exist, but no real OTel network export or production policy is enforced. | Wave 1 must decide telemetry manifest fields and production export rules before release gates depend on telemetry evidence. |
| Generated SaaS runtime | Generated products should be real Clerk-authenticated, Convex-backed, billing-aware SaaS apps. | Template generation and generated docs are truthful, but runtime SaaS behavior, billing, webhooks, and most production apply paths are rehearsal/local-only. | Real SaaS runtime must come before production release gates. Wave 3 remains a blocker before Wave 5 can claim production readiness. |
| UI primitives beyond auth/billing/settings | The platform should expose functional primitives for agent-built SaaS workflows, not only shell metadata. | Primitive metadata and theme contracts exist; functional primitives are not yet a broad component/module library. | Treat UI primitives as platform work inside Wave 3 and Wave 7, not polish. Add auth, org, billing, state, data, audit, and mobile-safe primitives as runtime contracts. |
| Typed module ecosystem | Agent-added modules should be typed, validated, documented, observable, and package-boundary aware. | Feature, billing-plan, and event generators coordinate anchors across generated surfaces, but a typed module ecosystem is not established. | Introduce module-system design in Wave 1 and implement the first real module contracts alongside the generated SaaS runtime in Wave 3. |

## Current Capability Map

| Area | Status | Evidence | Production-readiness interpretation |
| --- | --- | --- | --- |
| CLI command contract | Solid | Broad command surface exists and is tested through unit and e2e paths. | Strong prototype foundation for agent workflows. |
| Template generation | Solid | Generator copies B2B SaaS template and validates required anchors. | Good local scaffolding, but generated app is not yet a real SaaS runtime. |
| Local structural validation | Solid | Manifest, generated anchors, docs, env declarations, theme anchors, telemetry definitions, and local-cloud state are checked. | Useful for prototype drift, insufficient as a release gate. |
| Feature, billing-plan, event generators | Solid | `agentstack add` surfaces create coordinated anchors across domain, Convex, web, mobile, docs, and telemetry. | Good workflow shape; generated output still needs real runtime integration. |
| Local-cloud preview and production rehearsal | Solid | Sync, deploy, build, prod prepare/provision, and observe flows write local artifacts and telemetry. | Valuable rehearsal surface, but not evidence of live provider coherence. |
| Convex provider inspect/apply | Partial | Convex command planning and explicit execution are the most advanced provider path. | Needs adoption/linking, schema/runtime checks, env reconciliation, ledger integration, and production-grade rollback/audit. |
| Clerk provider support | Prototype/local-only | Clerk command planning and read-only inspect exist; apply is unavailable. | Missing auth, organizations, billing, webhook, and entitlement provisioning. |
| Vercel provider support | Prototype/local-only | Preview deploy apply exists; env mutations and production apply are unavailable. | Missing full project linking, env reconciliation, production deploy/release, domain checks, and smoke evidence. |
| EAS provider support | Prototype/local-only | Preview env-list inspect exists; apply, project init, env mutation, and build execution are unavailable. | Missing mobile build control path and production mobile release readiness. |
| `validate --cloud` | Prototype/local-only | Checks local-cloud rehearsal state rather than live provider state. | Name overstates evidence; must become truthful or be renamed/split. |
| Release validation | Prototype/local-only | Production release gates are local structural gates and artifacts. | Cannot block or approve real releases yet. |
| Generated SaaS spine | Partial | Domain metadata and docs exist; Convex schema has workspace-status and SaaS-spine anchors. | Missing complete org, membership, billing, entitlement, webhook, and audit persistence. |
| Web runtime | Prototype/local-only | Web renders workspace-status surfaces. | Does not yet run real Clerk auth or Convex-backed SaaS workflows. |
| Mobile runtime | Prototype/local-only | Expo/EAS anchors and workspace-status surfaces exist. | Does not yet run real auth, org, billing, entitlement, or Convex flows. |
| UI primitives | Partial | Primitive metadata and theme contracts exist. | Behavior and accessibility primitives are not yet functional component libraries. |
| Telemetry | Partial | Local JSONL store and OTLP-shaped export artifact exist. | Missing real OTel network export, traces, metrics, hosted indexing, access control, and provider log joins. |
| Hosted control plane | Missing | Spec describes durable state, audit, drift history, and observability indexes. | No hosted state or connected provider account model yet. |
| Public installability | Missing | Packages are private/0.0.0/source-first; generated CLI forwarding depends on local/source env vars unless an installed binary exists. | Not ready for consumer install, upgrade, or reproducible support. |

## Critical Gaps By Blocker Impact

1. Provider resource accounting is not enforced at mutation boundaries. The new ledger sets the policy, but provider commands do not yet require ledger records, resource ownership, cleanup status, or evidence before and after external mutations.
2. Validation is not truthful enough for consumers. `agentstack validate` does not run real lint, format, typecheck, tests, or Convex checks, and `validate --cloud` checks local-cloud rehearsal state rather than live provider coherence.
3. Live provider provisioning and reconciliation are missing or partial. Convex is furthest along, Clerk is read-only, Vercel can only apply preview deploys, and EAS can only inspect preview env lists.
4. The generated app is not a production SaaS runtime. It is runnable as workspace-status surfaces, but not as a Clerk-authenticated, Convex-backed SaaS with real orgs, memberships, billing, webhooks, entitlements, and audit trails.
5. Release gates are local structural gates. They do not prove live domains, provider envs, webhook delivery, auth redirects, deployment health, mobile builds, telemetry export, or rollback readiness.
6. Observability is local and artifact-shaped. There is no real OTel export path, hosted indexing, production access control, metrics/traces, or joins across CLI, Convex, Clerk, Vercel, and EAS logs.
7. Packaging is not consumer-ready. The framework is private, version 0.0.0, and source-first, with generated scripts relying on local prototype env vars unless a real binary is installed.
8. Manifest format is unresolved. `agentstack.config.ts` in the spec and `agentstack.config.json` in the repo represent a product choice that must be made once and enforced everywhere.

## Prioritized Roadmap

### Wave 0: Truth, Guardrails, And Resource Ledger Enforcement

| Field | Plan |
| --- | --- |
| Goal | Align the repository with a single truthful contract for manifest format, validation language, provider mutation rules, and external resource accounting. |
| Why now | Further provider mutation without ledger enforcement creates unmanaged external state and weakens the framework's core promise. Misleading command names also teach agents the wrong safety model. |
| Deliverables | Choose `agentstack.config.ts` or `agentstack.config.json` and replace the losing path everywhere. Wire provider operations to require a provider-resource ledger entry before mutation. Add ledger status checks to provider plan/apply output. Update docs so local-cloud is always described as rehearsal, not real cloud validation. Define a provider mutation policy that refuses untracked resources. |
| Acceptance evidence | `rg "agentstack.config.ts|agentstack.config.json"` shows one deliberate manifest path except historical spec references. Provider apply commands refuse mutation when the ledger has no matching planned or active entry. Docs distinguish local rehearsal from live provider validation. Tests cover missing-ledger refusal and successful ledger-backed dry-run planning. |
| Provider-resource implications | Every external Clerk, Convex, Vercel, EAS, or telemetry-provider resource must have a ledger row with owner, environment, purpose, cleanup procedure, current status, and evidence path before apply can proceed. |

### Wave 1: Consumer Installability And Truthful Validation Gate

| Field | Plan |
| --- | --- |
| Goal | Make the core agent contract stable enough for installed use: manifest format, command vocabulary, package boundaries, telemetry policy, and truthful validation language. |
| Why now | Consumers cannot trust a framework whose command vocabulary, manifest format, generated/runtime ownership, telemetry policy, and validation meaning are still implicit. These choices shape every generated project and must be settled before broader provider mutation or public installability. |
| Deliverables | Create a public package posture for CLI, create-agent-stack, core, adapters, telemetry, runtime, and generated template packages. Remove source-only forwarding assumptions from generated apps. Decide the final command vocabulary, including `generate` versus current `add` semantics, and update templates, docs, tests, and generated guidance coherently. Define the runtime-vs-generated package boundary and the first typed module contract shape. Define telemetry manifest fields for OTel/OTLP destinations, sampling, redaction, retention, and production export semantics. Implement validation orchestration for lint, format check, TypeScript, tests, Convex schema/function checks, generated boundary checks, theme checks, telemetry checks, secret scanning, and manifest validation. Split or rename local-cloud checks if they are not live provider checks. |
| Acceptance evidence | A clean machine can create a project through the packaged CLI without source env vars. Command help, generated docs, tests, and templates use one final vocabulary. The manifest declares package/runtime boundaries and telemetry policy without ambiguous defaults. `agentstack validate` runs the real local quality stack and fails on injected lint, type, test, Convex, generated-boundary, telemetry, theme, and secret issues. `validate --cloud` either reaches real providers or clearly refuses with an actionable "not connected" diagnostic. |
| Provider-resource implications | Validation must read the ledger before any live check and must report resources as missing, planned, active, cleanup-pending, cleaned, or abandoned-with-reason without exposing secrets. |

### Wave 2: Live Provider Inventory, Link, Adopt, And Preview Control Plane

| Field | Plan |
| --- | --- |
| Goal | Build the first real provider control plane for development and preview environments before expanding mutation breadth. |
| Why now | Agentstack needs to discover, link, and adopt existing provider resources safely before it can create or mutate new ones. This avoids duplicate apps, orphaned projects, and hidden drift. |
| Deliverables | Implement provider inventory and link/adopt flows for Convex, Clerk, Vercel, and EAS. Add read-only live inspect for all four providers. Define hosted control-plane account connection requirements while keeping execution local until the hosted state milestone. Add preview-safe apply for env reconciliation where provider APIs support it. Store resource identities in the ledger and generated project state without raw secrets. Produce explicit plans for create, adopt, update, and no-op cases. |
| Acceptance evidence | On real preview resources, `agentstack provider inspect --env preview` reports linked state for Convex, Clerk, Vercel, and EAS. Link/adopt commands update the ledger and project state with evidence paths. Account connection design captures provider identity, scopes, audit needs, and redaction rules without creating external resources by default. Preview env drift produces a redacted plan, applies only after confirmation, and re-inspection proves convergence. |
| Provider-resource implications | The ledger becomes the resource registry. Adopted resources need owner, external id or URL, evidence, cleanup policy, and status. Apply must refuse resources that are absent from the ledger or marked cleaned. |

### Wave 3: Real Generated SaaS Runtime

| Field | Plan |
| --- | --- |
| Goal | Turn the generated app from workspace-status scaffolding into a working B2B SaaS runtime across web, mobile, and Convex. |
| Why now | Provider readiness has limited value unless generated products exercise real auth, org, billing, entitlement, webhook, and data paths. |
| Deliverables | Add Convex tables for users, identities, orgs, memberships, roles, subscriptions, entitlements, webhook events, audit events, and provider linkage. Implement Clerk auth and org wiring for web and mobile. Add webhook ingestion, idempotency, entitlement updates, and audit logging. Replace UI primitive metadata with functional auth gate, org switcher, account menu, billing gate, settings, empty/loading/error states, data-state primitives, audit/event surfaces, and mobile-safe equivalents. Implement the first typed module contracts so feature, billing, and event generation produce validated runtime modules rather than only coordinated anchors. |
| Acceptance evidence | A generated app supports sign-in, org selection, membership checks, protected Convex queries/mutations, entitlement gating, webhook replay/idempotency tests, audit event writes, and matching web/mobile behavior. Generated modules are typed, validated, documented, and observable across web, mobile, Convex, docs, and telemetry. Tests prove server-side enforcement, not only UI affordances. |
| Provider-resource implications | Clerk apps, webhook endpoints, Convex deployments, and billing resources must be ledger-tracked. Webhook signing secrets and provider credentials must be presence-checked and redacted, never recorded. |

### Wave 4: Live Preview Deploy And Build Path With Telemetry

| Field | Plan |
| --- | --- |
| Goal | Make preview deploys and mobile builds real, observable, and smoke-tested. |
| Why now | Preview is the proving ground for the consumer golden path. It must move beyond local artifacts before production provisioning is credible. |
| Deliverables | Execute Vercel preview deploys with linked env state. Execute EAS preview builds or development builds through EAS with project init and env handling. Deploy Convex preview functions and schema. Configure Clerk preview redirects and webhooks. Emit real OTel spans/logs/events from CLI and generated runtime according to the telemetry manifest. Add preview smoke tests for auth, protected data, webhook receipt, web deployment health, runtime telemetry, and mobile build metadata. |
| Acceptance evidence | A preview environment can be created or adopted, deployed, built, smoke-tested, and observed through Agentstack commands. Evidence includes Vercel URL, Convex deployment identity, Clerk webhook delivery status, EAS build record, redacted telemetry export or configured OTLP destination proof, and smoke-test results. |
| Provider-resource implications | Preview deployments, builds, webhooks, domains, and env resources must have ledger rows or child evidence linked to a parent project/app row. Cleanup policy must cover ephemeral preview artifacts. |

### Wave 5: Production Provisioning And Release Gates

| Field | Plan |
| --- | --- |
| Goal | Implement production provisioning, release validation, audit, and rollback as explicit high-safety workflows. |
| Why now | Production must be a separate milestone with stricter confirmation, clearer plans, and better evidence than preview. |
| Deliverables | Implement production provider plans for Clerk, Convex, Vercel, and EAS. Add production env mutation support with explicit approval and redacted diffs. Add domain, redirect, webhook, billing, entitlement, mobile bundle/profile, telemetry, and rollback checks. Add release IDs and production audit events. Require smoke evidence before marking a production release ready. |
| Acceptance evidence | `agentstack validate --release prod` blocks until live production provider state, runtime checks, telemetry policy, smoke tests, rollback plan, and ledger state are coherent. Production apply emits an audit record and evidence bundle. Rollback commands are printed and tested in rehearsal. |
| Provider-resource implications | Production resources require explicit purpose, owner, cleanup or retention policy, evidence, and approval metadata. Mutating production without an active ledger entry and release plan must be impossible through Agentstack. |

### Wave 6: Hosted Control Plane And Production Observability

| Field | Plan |
| --- | --- |
| Goal | Add durable hosted state for connected provider accounts, audit logs, drift history, observability indexes, and production-safe inspection. |
| Why now | Local files can prove a prototype, but they cannot support multi-project provider account connections, production auditability, hosted drift history, or cross-service incident timelines. The preview/runtime observability contract should already exist before this wave; this wave makes it durable, permissioned, and multi-project. |
| Deliverables | Build account connection flows, project registry, environment graph storage, resource ledger sync, audit log storage, drift snapshots, role-based access controls, access-reason prompts, OTel ingestion or indexing, and provider log joins. Keep the app capable of exporting to external OTel providers without depending exclusively on the hosted control plane. |
| Acceptance evidence | Agents can inspect production journeys, releases, webhooks, provider drift, and errors through Agentstack without raw dashboard spelunking. Production access is redacted, permissioned, audited, and correlated across CLI, Convex, Clerk, Vercel, EAS, and runtime events. |
| Provider-resource implications | The hosted control plane becomes the durable authority for external resource records, while repo-local ledger snapshots remain inspectable and reviewable. Hosted and local state must reconcile and report drift. |

### Wave 7: Public Package, Library, Docs, Skills, CI, And Release Hardening

| Field | Plan |
| --- | --- |
| Goal | Make Agentstack a public, supportable framework/library with versioned packages, docs, skills, CI, and release discipline. |
| Why now | Once the runtime and provider path are real, consumer trust depends on install stability, upgrade clarity, documentation accuracy, and repeatable releases. |
| Deliverables | Publish packages with real versions, exports, provenance, changelogs, release notes, and an explicit support policy for named public releases. Harden generated docs and installable skills against the final command contract. Add CI for unit, e2e, template mirror alignment, generated app validation, source-policy checks, secret scanning, package smoke installs, and docs link checks. Add versioned upgrade guidance only for explicit supported releases. |
| Acceptance evidence | A public consumer can install, generate, validate, deploy preview, prepare production, and inspect observability from documented commands. CI proves package install smoke tests and generated template alignment. Docs do not claim production readiness beyond gates that are actually implemented and passing. |
| Provider-resource implications | Public examples and demos must use ledger-tracked resources or clearly documented mock/local resources. Release demos must include cleanup evidence for temporary provider assets. |

## Immediate Next Slice Recommendation

Build provider inventory, link/adopt, and ledger enforcement before any broader provider mutation, then implement the truthful validation runner.

Rationale:

| Priority | Slice | Reason |
| --- | --- | --- |
| 1 | Provider inventory and link/adopt | Agentstack needs to know what exists before it creates or changes anything. This prevents duplicate provider resources and gives agents a real environment graph. |
| 2 | Ledger enforcement at provider mutation boundaries | The ledger is the new operational invariant. Enforcing it before mutation keeps the external world accountable while the provider adapters mature. |
| 3 | Truthful validation runner | Once resources can be linked and accounted for, validation can become an honest contract that runs local quality gates and distinguishes local rehearsal from live provider coherence. |

This order protects the product promise. It creates a safe read/adopt baseline, prevents untracked external changes, and then makes validation output worth trusting.

## Non-Negotiables

| Rule | Enforcement expectation |
| --- | --- |
| No untracked external resources | Every external provider resource used for Agentstack testing is recorded in `docs/provider-resource-ledger.md` or its future hosted equivalent with status, owner, purpose, cleanup procedure, and evidence. |
| No provider mutation without a ledger entry | Provider apply commands refuse mutation unless a matching planned or active ledger row exists and the command can append evidence without exposing secrets. |
| No legacy or backward-compatibility shims | This is green-field. Replace changed paths coherently across code, templates, docs, tests, and generated guidance instead of preserving old paths. |
| No marketing claims before gates pass | Docs must not claim consumer production readiness until live provider validation, generated SaaS runtime checks, preview deploy/build evidence, production gates, telemetry, ledger/audit, and packaging gates pass. |
| No fake provider identifiers | Plans and docs may describe required evidence, but must not invent provider IDs, URLs, tokens, app IDs, or deployment identities. |
| No raw secrets in repo artifacts | Logs, ledgers, validation output, telemetry, docs, and evidence bundles record presence, ownership, hashes, or redacted labels, never raw secret values. |
