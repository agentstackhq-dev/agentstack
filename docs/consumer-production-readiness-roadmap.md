# Agentstack Consumer Production Readiness Roadmap

## Verdict

Agentstack is about 40-42% of the way toward consumer production readiness.

The current repository is a local command-contract and rehearsal prototype with credible generated guidance, local telemetry, provider command planning, aggregate preview reconciliation plan artifacts, preview provider proof contracts with provider-specific identity read-plan metadata, a sanitized `identityCandidates` artifact boundary, Vercel preview candidate guidance from structured preview env-list evidence and local project-link state, a shared sanitized exact identity decision contract, and partial Vercel/EAS drift evidence that still refuse readiness until real exact proof exists, ledger-gated supported mutations, local provider inventory/link/adopt boundaries, and a first non-mutating live validation command that truthfully refuses readiness. It is not yet a consumer-ready production framework. A consumer still cannot run `npx create-agent-stack`, connect real Clerk/Convex/Vercel/EAS resources, prove live readiness, deploy preview, build mobile, provision production, and operate the app without manual provider coordination.

The consumer-facing truth is:

- Strong: bootstrap generation, manifest-driven command routing, local validation of Agentstack-owned anchors, generated docs/skills, local wide-event telemetry, provider command plans, aggregate preview reconciliation plan artifacts, preview proof-contract gating, provider-specific identity read-plan metadata, sanitized candidate artifact boundaries, ledger-gated supported Convex/Vercel mutations, and local provider inventory/link/adopt discipline.
- Partial: live provider reads, provider apply coverage, generated domain/runtime contracts, local observability inspection, release rehearsal, and package/runtime boundaries.
- Missing: exact provider identity parsers/read commands, exact drift/live coherence proof, exact live readiness proof, complete provider discovery/adoption/provisioning, real SaaS auth/org/billing/webhook runtime, end-to-end generated Convex API usage from web/mobile, functional UI primitives, real OTel export and hosted observability, preview smoke evidence, production gates, hosted control plane, and public installability.

## Source Of Truth

| Source | Role | Current implication |
| --- | --- | --- |
| `docs/superpowers/specs/2026-06-20-agent-first-meta-framework-design.md` | Authoritative product and architecture spec | Defines Agentstack as an agent-first control framework for real B2B SaaS creation, provider coordination, validation, deployment, telemetry, and release gates. |
| `docs/provider-resource-ledger.md` | Provider resource accounting policy | Every real external provider resource must be tracked, evidenced, and cleaned up. No real provider resources are recorded or changed in the current session. |
| `packages/cli/src/run.ts` and tests | Current command contract | Broad CLI routing exists, including `validate`, `inspect`, `doctor`, `dev`, `sync`, `deploy`, `provider`, `prod`, `build`, `theme`, `skills`, `env`, `add`, `init`, and `observe`. |
| `packages/adapters/src/*` | Provider and local-cloud boundaries | Provider plans exist for Clerk, Convex, Vercel, and EAS; sanitized identity candidate artifacts now exist for provider-specific candidate parsers; supported live mutation is narrow and ledger-gated; local-cloud remains rehearsal state. |
| `templates/b2b-saas/` and package-local mirror | Generated app behavior | Generated app is a runnable workspace-status vertical with docs, anchors, local telemetry, and provider scripts, not a complete production SaaS runtime. |
| `docs/superpowers/plans/2026-06-21-agentstack-wave-2-provider-inventory-link-adopt.md` | Current provider inventory/link/adopt execution plan | Clarifies the local-control-plane semantics: inventory writes no files, link writes only `.agentstack/provider-links.json`, and adopt is print-only. |

## Source-Spec Capability Matrix

| Capability | Status | Current truth | Consumer production gap |
| --- | --- | --- | --- |
| Single manifest source of truth | Implemented | `agentstack.config.json` is the active manifest across templates, docs, CLI context, and generated guidance. | Needs production-hardening of schema ergonomics, policy coverage, and package/runtime contracts. |
| Bootstrap generation | Implemented | `create-agent-stack` copies the B2B SaaS template, rewrites app tokens, and validates generated anchors. | Public npm installability and clean-machine smoke evidence are still missing. |
| CLI command vocabulary | Partial | Broad routing exists for core workflows, provider commands, add/generate-like surfaces, env, prod, mobile build rehearsal, and observe. | Final public command vocabulary and help/docs stability are not release-grade. |
| Local validation | Partial | Bare `agentstack validate` checks manifest/env/guidance/theme/source-secret/generated anchors and prints `Evidence: local-structure`. `agentstack validate --quality` adds configured local package commands, currently `pnpm typecheck` and `pnpm test`, and prints `Evidence: local-quality`. | It does not yet run lint, format, Convex checks, or full runtime validation beyond the configured local quality commands. |
| `validate --cloud` | Local rehearsal | It truthfully labels `Evidence: local-rehearsal` and checks local-cloud state only. | Remains separate from live provider validation and does not prove external provider state. |
| `validate --live` | Truthful refusal | It runs local validation first, then bounded read-only live provider inventory with `Evidence: live-validation`, `Mutation: none`, and per-provider `Evidence: live-read-inventory`. It refuses readiness today with `Readiness: refused` because exact identity proof is not implemented. | Needs provider-specific exact identity proof and exact drift/live coherence proof before it can become a readiness pass. |
| Provider command plans | Partial | Clerk/Convex/Vercel/EAS command plans exist with redacted output and evidence labels. Aggregate preview planning exists through `agentstack provider plan --env preview --all`. Aggregate preview reconciliation plan artifacts exist through `agentstack provider reconcile --env preview --plan` with `Evidence: provider-reconciliation-plan`, `Provider execution: none`, `Mutation: none`, `Readiness: not-claimed`, `Live state: not-read`, `Local-cloud state: not-read`, and `Operations: not-evaluated`. | Plans do not yet cover full provider-specific create/provision/apply lifecycle or exact live reconciliation proof. |
| Provider proof contracts | Partial | `packages/adapters/src/provider-proof-contracts.ts` exports a provider-neutral proof-contract layer. `agentstack provider proof --service <clerk\|convex\|vercel\|eas> --env preview --resource-type <type> --name <name>` runs local validation, checks the requested resource against the manifest before ledger/inventory/live reads, requires a matching planned ledger row, may run bounded read-only inventory/live inspection, and reports proof requirements while refusing readiness. `getProviderIdentityReadPlan` now provides provider-specific identity read-plan metadata for Clerk, Convex, Vercel, and EAS. `evaluateProviderIdentityProof` is fail-closed and only returns unavailable or ambiguous, never exact. `evaluateProviderIdentityCandidateProof` can aggregate sanitized provider-specific candidate labels from successful matching-provider reads and reduce missing-proof guidance, but candidate proof remains ambiguous and does not produce `identity=matched`, exact identity, live readiness, or production readiness. Clerk has conservative read-only `apps list --json` candidate parsing: matching app rows can emit sanitized `stable-provider-identity`, `provider-owner-identity`, and `provider-environment-scope` labels, while `provider-resource-id` requires `resourceId` or `resource_id` and is never inferred from Clerk `id`. Vercel preview live inventory can emit `provider-environment-scope` from structured preview env-list evidence and `provider-project-link-proof` from valid local `.vercel/project.json` link state; the local link candidate is not provider existence proof or exact identity proof, and raw project IDs, org IDs, env values, and provider output are not printed. `evaluateProviderExactIdentityProof` is the shared sanitized exact decision contract: failed reads are unavailable, successful reads without exact parser artifacts keep exact candidates/evaluator unavailable, successful reads with some sanitized exact labels are ambiguous through the provider-exact evaluator, and exact can only come from sanitized `exactIdentityProof` artifacts with parser evidence plus every required exact-proof label. Current real provider adapters emit no exact proof artifacts. `evaluateProviderDriftProof` can return sanitized partial drift evidence only for gated Vercel/EAS preview env-list read results; those proof outputs print `Drift proof: partial` and `Drift evaluator: env-list-preview` but still exit nonzero with `Readiness: refused`. It is preview-only, fail-closed, read-only, and performs no provider, local, ledger, or local-cloud mutations. | Needs provider-specific exact identity parsers/read commands and exact drift/live coherence proof before proof contracts can confirm real exactness or feed live-safe link/adopt/readiness. |
| Live provider reads | Partial | Clerk, Convex, Vercel preview, and EAS preview have live-read inspect paths. Successful Clerk diagnostics/env/config reads and Convex env-list reads can emit sanitized command-level partial facts that prove bounded read access only. Clerk `apps list --json` can emit conservative sanitized candidate labels when rows match expected owner/environment shape, but those labels remain candidate evidence rather than exact proof. Vercel/EAS preview env-list partial facts require structurally parsed rows that pair an expected env name with the preview environment. | Production and broad provider reads are still limited; exact identity, drift, and permissions are not yet proven across the full provider surface. |
| Live provider mutation | Partial | Only ledger-gated Convex apply and Vercel preview deploy apply exist. | Clerk create/update, Convex full provisioning, Vercel env/domain/production, and EAS init/env/build/release are missing. |
| Provider inventory | Partial | Inventory defaults to local manifest/link/ledger evidence. Explicit bounded live inventory via `--source live` or `--live` reuses read-only inspect primitives and reports redacted live-read evidence plus sanitized missing-proof labels without adoption, provisioning, reconciliation, or broad discovery. | Needs provider-specific identity parsers that can prove exact identity, full discovery/provisioning, and broad production reads. |
| Provider link | Partial | Link is ledger-gated and writes only `.agentstack/provider-links.json`; it does not mutate providers, telemetry, local-cloud state, or the ledger. Live source currently refuses ambiguous identity and prints sanitized identity proof requirements. | Needs exact live identity confirmation and drift-safe reconciliation into the future hosted/resource registry. |
| Provider adopt | Partial | Adopt prints a redacted ledger proposal only and writes no files. Live source currently refuses ambiguous identity and prints sanitized identity proof requirements instead of a proposal. | Needs operator-reviewed ledger workflow plus eventual exact live adoption confirmation. |
| Generated SaaS runtime | Missing | The only real vertical is local workspace-status. | Needs Clerk auth, orgs, memberships, billing, webhooks, entitlements, audit, and protected Convex data paths. |
| Convex generated API path | Partial | Domain contracts and Convex workspace status functions exist. | Web/mobile do not consume a complete Convex-generated API for real SaaS workflows. |
| Web runtime | Prototype | Web renders workspace-status surfaces. | No real Clerk/Convex SaaS runtime. |
| Mobile runtime | Prototype | Expo/EAS anchors and workspace-status surfaces exist. | No real auth/org/billing/entitlement/Convex mobile flow or EAS build execution. |
| UI primitives | Missing | `packages/ui` is primitive metadata/theme-oriented, not a functional component library. | Needs unstyled accessible auth, org, billing, data-state, settings, audit, loading, empty, and error primitives. |
| Observability | Partial | Local JSONL wide events, observe query/timeline/trace/journey/errors/webhook/component/compare, and OTLP-shaped local export exist. | No real OTel SDK/network exporter, hosted indexing, access controls, provider log joins, or production telemetry proof. |
| Preview deploy/build | Prototype | Deploy and mobile build flows mostly rehearse and write local artifacts; Vercel preview apply is bounded. | Needs live Vercel/Convex/Clerk preview deploy, EAS build, smoke evidence, and telemetry proof. |
| Production release gates | Missing | Production prepare/provision/deploy are local rehearsal gates. | Needs live production provider state, domains, webhooks, billing, rollback, smoke tests, audit, and release evidence. |
| Hosted control plane | Missing | Spec describes account connections, durable state, audit, drift history, and observability indexes. | No hosted state, RBAC, provider-account connection, hosted ledger, or cross-service incident timeline exists. |
| Public packaging | Missing | Packages remain prototype/source-oriented. | Needs public package versions, provenance, install smoke tests, upgrade policy for named releases, and supportable docs. |

## What We Have Now

- A generated monorepo shape with `apps/web`, `apps/mobile`, `convex`, shared packages, `docs/agentstack`, generated skills, and `agentstack.config.json`.
- A broad CLI router and generated package scripts for inspection, validation, env, sync, aggregate preview provider planning, provider plan/inspect/apply/inventory/link/adopt, preview rehearsal, production rehearsal, mobile build rehearsal, and observability.
- Aggregate preview provider reconciliation plan artifacts through `agentstack provider reconcile --env preview --plan`. The command is aggregate, preview-only, and plan-only; uses local validation, manifest service order, enabled services, sanitized ledger summaries, and command-plan counts from empty-operation plans; prints per-service unknown/ambiguous/unproven rows with `Operations: not-evaluated`; rejects missing `--plan`, `--service`, and production before provider executor use; reads no live provider, local-cloud, or provider-link state; calls no provider executor or provider CLI; writes no telemetry, local-cloud, provider-link, provider resource, or ledger state; and does not claim exact identity, drift proof, provisioning, adoption/link confirmation, live coherence, mutation, or readiness.
- Preview provider proof-contract requests through `agentstack provider proof --service <clerk|convex|vercel|eas> --env preview --resource-type <type> --name <name>`. The command is preview-only, fail-closed, read-only, and non-mutating; validates locally before unsupported-shape output; checks the requested resource against the manifest before ledger, inventory, or live reads; requires a matching planned ledger row; may run bounded read-only inventory/live inspection; reads no local-cloud state; writes no provider, local, telemetry, provider-link, or ledger state; exposes provider-specific identity read-plan metadata for Clerk/Convex/Vercel/EAS; has a separate sanitized `identityCandidates` artifact boundary and `evaluateProviderIdentityCandidateProof` for missing-proof guidance only; reports sanitized exact-proof unavailability; keeps Vercel/EAS environment-scope and project-link proof as missing requirements; can report sanitized partial drift evidence for gated Vercel/EAS preview env-list reads; and always refuses readiness today while exact identity and exact drift/live coherence remain unproven.
- Local validation for Agentstack-owned structural contracts: manifest, environment declarations, generated anchors, docs/guidance, theme/source-secret boundaries, and generated guidance alignment.
- Local env graph rehearsal through `.agentstack/local-cloud.json`, with explicit `Evidence: local-rehearsal` semantics.
- Provider command plans for Clerk, Convex, Vercel, and EAS with redacted, agent-readable diagnostics.
- Read-only live inspect paths for Clerk, Convex, Vercel preview, and EAS preview, with sanitized partial facts for successful bounded reads, conservative Clerk `apps list --json` identity candidate parsing, and production/broad-read limitations still explicit.
- Ledger-gated supported live mutations for Convex apply and Vercel preview deploy apply.
- Provider inventory/link/adopt:
  - inventory defaults to local manifest, provider-link, and ledger evidence, writes no files, and does not call provider CLIs;
  - explicit live inventory via `--source live` or `--live` is bounded read-only evidence that calls only existing inspect primitives, prints `Evidence: live-read-inventory`, `Mutation: none`, sanitized partial facts where bounded read access is proven, and sanitized `missing=` proof labels, and remains neither adoption, provisioning, reconciliation, nor broad discovery;
  - link writes only `.agentstack/provider-links.json` and does not mutate telemetry, local-cloud state, providers, or the ledger;
  - adopt prints a safe ledger proposal only and writes no files;
  - live link/adopt currently refuse ambiguous identity and print sanitized identity proof requirements, not exact confirmation.
- Local wide-event telemetry in JSONL with observe inspection modes and OTLP-shaped local export artifacts.
- A runnable generated workspace-status vertical across domain, Convex, web, and mobile surfaces.

## Missing For A Consumer Production Path

A consumer path from `npx create-agent-stack` to real production environments still requires:

1. Public package installability: versioned npm packages, clean-machine `npx create-agent-stack` smoke tests, generated scripts that do not depend on prototype source paths, and release provenance.
2. Truthful validation: bare `agentstack validate` is local-structure validation; `agentstack validate --quality` runs local package quality gates; `agentstack validate --cloud` is local-cloud rehearsal; `agentstack validate --live` is bounded read-only provider validation that currently refuses readiness until exact identity proof exists.
3. Provider identity and discovery: provider-specific identity read-plan metadata and sanitized identity candidate artifacts now exist, including conservative Clerk `apps list --json` candidate parsing, but exact identity parsers/read commands, exact drift/live coherence proof, exact live-safe adoption/link confirmation, full discovery/provisioning, and broad production reads are still missing.
4. Safe link/adopt/create: existing resources must be linked or adopted before mutation, and new resources must be planned, ledger-tracked, created, inspected, and cleaned up through explicit commands.
5. Real provider provisioning: Clerk auth/org/billing/webhooks, Convex deployments/env/schema/functions, Vercel projects/env/domains/deploys, and EAS projects/env/build profiles/builds/releases.
6. Generated SaaS runtime: Clerk-backed auth, orgs, users, memberships, billing, webhooks, entitlements, audit events, protected Convex queries/mutations, and matching web/mobile behavior.
7. End-to-end type safety: domain contracts and Convex-generated APIs must flow into web/mobile without stringly-typed or metadata-only substitutes.
8. Functional UI primitives: unstyled, accessible, behavior-complete primitives for auth gates, org switching, billing gates, settings, data states, audit/event surfaces, and mobile-safe equivalents.
9. Real observability: OTel SDK wiring, network/collector export, production redaction policy, hosted or external indexing, and joins across CLI/runtime/provider events.
10. Preview evidence: live preview deploy/build smoke tests for auth, protected data, webhooks, web deployment health, mobile build metadata, and telemetry.
11. Production gates: release plans, production provider apply, domains, redirects, webhooks, billing, telemetry, rollback, audit records, and evidence bundles.
12. Hosted control plane: connected accounts, durable environment graph, hosted ledger/audit/drift state, RBAC, access reasons, and production-safe inspection.

## Provider Resource Tracking Discipline

`docs/provider-resource-ledger.md` remains the current ledger for real external resources. No real provider resources were created, mutated, adopted, linked, or deleted in this session, so the ledger must remain unchanged.

Strict discipline:

- Inventory defaults to local-control-plane evidence. It can read manifest expectations, local provider links, and ledger rows, but it writes no files and does not prove external existence.
- Explicit live inventory via `--source live` or `--live` is read-only evidence collection. It calls existing inspect primitives, reports redacted command/result counts, live-read fields, and sanitized missing-proof labels, and must not be treated as adoption, provisioning, reconciliation, or resource management.
- Aggregate preview provider reconciliation plans are local-validation-and-ledger-only artifacts. They do not read live provider state, local-cloud rehearsal state, or provider links; they do not call provider executors or provider CLIs; and they write no `.agentstack/events.jsonl`, `.agentstack/local-cloud.json`, `.agentstack/provider-links.json`, provider resources, or ledger changes.
- Provider proof-contract requests are preview-only, fail-closed, and read-only. They may run bounded read-only inventory/live inspection only after local validation, manifest resource matching, and matching planned ledger evidence pass. They do not read local-cloud state and must not mutate provider resources, local files, provider links, telemetry, or the ledger.
- Provider identity read-plan metadata and sanitized identity candidate artifacts are requirement/candidate evidence, not exact proof. Candidate proof can reduce missing-proof guidance only; it cannot produce `identity=matched`, readiness, live-safe link/adopt confirmation, or provider mutation permission. Exact identity remains unavailable until provider-specific read commands/parsers can prove stable identity without emitting provider-shaped or secret-shaped labels. For Clerk, `id` is stable-provider-identity candidate evidence only; `provider-resource-id` requires `resourceId` or `resource_id`.
- Live validation via `validate --live` aggregates those same read-only inventory paths, writes no telemetry/local-cloud/provider-links/ledger state, and currently refuses readiness rather than proving production readiness.
- Link is local state only. It requires a matching `planned` or `active` ledger row and writes only `.agentstack/provider-links.json`.
- Adopt is print-only. It produces a redacted proposal that an operator can review before manually updating the ledger.
- Live link/adopt refusals print sanitized identity proof requirements only. They do not prove exact provider identity and must not write local, provider, telemetry, local-cloud, or ledger state.
- Supported live mutation is explicit through provider apply commands and must remain ledger-gated.
- Missing, incomplete, invalid, blocked, cleanup-pending, cleaned, or abandoned-with-reason ledger rows must block link and supported apply.
- Provider outputs must never print raw secrets, raw env values, unredacted external identifiers, or provider ledger row IDs.
- Temporary provider resources need owner, environment, purpose, cleanup procedure, cleanup trigger, evidence, current status, and cleanup evidence.

Cleanup flow:

1. Before creating, adopting, linking, or mutating a real provider resource, add or verify a `planned` ledger row with owner, purpose, environment, resource type, cleanup, trigger, and evidence path.
2. Run provider plan/inventory/link/apply only against the intended environment and resource type.
3. After live creation or mutation, add redacted evidence and update the ledger status to `active` or the appropriate blocked/cleanup state.
4. When a resource is no longer needed, execute the documented cleanup procedure, store cleanup evidence, and update the row to `cleaned`.
5. If cleanup cannot complete, use `abandoned-with-reason` with explicit owner and follow-up evidence; do not silently drop the resource.

## Prioritized Finish Plan

### 1. Provider Integration Truth First

Goal: turn the local provider control-plane prototype into live, accountable provider discovery and reconciliation.

Deliver:

- Provider-specific exact identity parsers/read commands for the bounded live inventory and proof-contract paths that can prove exact matches without leaking provider identifiers.
- Provider-specific identity read-plan metadata and candidate artifacts converted into exact read commands/parsers for Clerk, Convex, Vercel, and EAS.
- Exact drift/live coherence proof against manifest expectations, ledger evidence, and stable provider identity.
- Ledger-aware, live-safe link/adopt confirmation that proves provider identity and drift state without writing secrets.
- Truthful live validation that currently refuses readiness while distinguishing read evidence from identity proof, drift proof, reconciliation, and mutation readiness.
- Provider proof-contract outputs that can move from exact-proof unavailability, candidate-only proof guidance, proof requirements, and partial Vercel/EAS drift evidence to exact proof results only after provider-specific identity parsers and exact drift evaluators exist.
- Bounded provider-specific live-read semantics beyond the current partial-fact paths, designed before broad discovery or live reconciliation.
- Provider create/provision/update/no-op plans for all four services.
- Expanded apply coverage only after ledger rows and evidence contracts exist.
- Provider-specific smoke evidence for preview resources.

Acceptance evidence:

- Real preview resources can be discovered, linked/adopted, inspected, planned, and re-inspected with redacted proof.
- No command mutates a provider unless the ledger state is active/planned and the mutation is explicit.
- `docs/provider-resource-ledger.md` records every real resource touched, with cleanup evidence when removed.

### 2. Truthful Validation Runner

Goal: make validation output mean what a consumer thinks it means.

Deliver:

- `agentstack validate --quality` orchestration beyond the current `pnpm typecheck` and `pnpm test` commands, including lint, format check, Convex checks, generated anchors, theme checks, telemetry schema/redaction checks, secret scanning, and manifest validation.
- A live validation mode that reaches providers through bounded read-only inventory where supported and refuses readiness until exact identity proof exists.
- Clear separation between local rehearsal, live-read, live-mutation, preview evidence, production evidence, and hosted-control-plane evidence.

Acceptance evidence:

- Injected lint/type/test/Convex/generated-boundary/secret failures are caught.
- `validate --cloud` no longer risks implying live provider proof when only local rehearsal exists.

### 3. Runtime Completeness

Goal: make the generated app a real B2B SaaS runtime.

Deliver:

- Convex schema/functions for users, identities, orgs, memberships, roles, subscriptions, entitlements, webhook events, audit events, and provider linkage.
- Clerk auth/org integration for web and mobile.
- Billing/webhook ingestion with idempotency, entitlement updates, replay tests, and audit logs.
- End-to-end generated Convex API usage from web/mobile.
- First typed module contracts for feature, billing, and event generation.

Acceptance evidence:

- Generated app supports sign-in, org selection, protected queries/mutations, entitlement gates, webhook replay/idempotency, audit writes, and matching web/mobile behavior.

### 4. Library And UI Completeness

Goal: move from metadata and anchors to reusable production primitives.

Deliver:

- Functional unstyled primitives for auth, org, billing, settings, data states, audit/event views, loading/empty/error states, and mobile equivalents.
- Stable package/runtime/generated ownership boundaries.
- Typed extension contracts for modules and app-level telemetry.

Acceptance evidence:

- Agents can compose real SaaS workflows from package primitives without editing provider glue or generated substrate.

### 5. Preview Platform Evidence

Goal: make preview deploy/build real and observable.

Deliver:

- Vercel preview deploys, Convex preview deploys, Clerk preview redirects/webhooks, and EAS preview/dev builds.
- Smoke tests for auth, protected data, webhooks, deployment health, mobile build metadata, and telemetry.
- Real OTel SDK/network exporter path or clearly configured external collector proof.

Acceptance evidence:

- A preview environment has redacted evidence for provider identities, deploy URL, Convex deployment, Clerk webhook delivery, EAS build record, smoke results, and telemetry export.

### 6. Production Gates And Hosted Control Plane

Goal: make production a high-safety workflow with durable state.

Deliver:

- Production provider plans/apply for Clerk, Convex, Vercel, and EAS.
- Release IDs, approval metadata, audit records, rollback plans, production smoke evidence, and telemetry policy enforcement.
- Hosted account connections, resource registry, audit/drift history, RBAC, access reasons, hosted observability indexing, and provider log joins.

Acceptance evidence:

- `agentstack validate --release prod` blocks until live provider state, runtime checks, telemetry, smoke tests, rollback, ledger, and audit evidence are coherent.

### 7. Public Framework Release

Goal: make Agentstack installable, supportable, and honest for consumers.

Deliver:

- Public packages with real versions, exports, provenance, changelogs, release notes, CI, package smoke installs, docs link checks, source-policy checks, generated template mirror checks, and named-release upgrade guidance.
- Public docs and generated skills aligned to the implemented command contract only.

Acceptance evidence:

- A consumer can install, generate, validate, deploy preview, prepare production, inspect observability, and follow cleanup guidance using documented commands whose gates are actually implemented.

## Immediate Next Actions

1. Finish provider integration gaps first: implement exact provider identity parsers/read commands from the new read-plan metadata, exact drift/live coherence proof, live-safe link/adopt confirmation, truthful live validation, and bounded provider-specific live-read semantics.
2. Build the truthful validation runner and split local rehearsal from live provider validation wherever the command output could be misunderstood.
3. Start the real generated SaaS runtime only after provider identity and validation semantics are hard enough to support real environments.

## Non-Negotiables

| Rule | Enforcement expectation |
| --- | --- |
| No untracked external resources | Every real Clerk, Convex, Vercel, EAS, telemetry, billing, or hosted-control-plane resource is ledger-tracked before use. |
| No mutation without explicit ledger state | Supported provider apply refuses absent, incomplete, invalid, blocked, cleanup-pending, cleaned, or abandoned rows. |
| No legacy shims | This is green-field. Replace changed paths coherently across code, templates, docs, tests, and generated guidance. |
| No fake readiness claims | Docs must distinguish local rehearsal, live-read, live-mutation, preview evidence, production evidence, and hosted evidence. |
| No fake provider IDs | Plans and docs may specify evidence requirements but must not invent provider IDs, URLs, app IDs, tokens, or deployment identities. |
| No raw secrets | Logs, telemetry, ledgers, docs, evidence bundles, and diagnostics must record presence/redacted metadata only. |
