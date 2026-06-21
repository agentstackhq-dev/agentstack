# Agentstack Consumer Production Readiness Progress

Date: 2026-06-21

This file is the canonical resume and progress artifact for Agentstack consumer production readiness work. Update it before ending every roadmap work turn so the next worker can resume from current truth without reconstructing state from scattered notes.

## Current State

Current phase: sanitized partial live inventory identity facts are the latest substantive implementation checkpoint, building on bounded live provider inventory, Vercel preview provider live-read inspect, failure-diagnostic redaction hardening, and provider inventory/link/adopt; this file intentionally avoids self-referencing its containing commit hash. Use `git log --oneline -n 5` for exact HEAD.

Overall status: not complete. Agentstack is about 38-40% of the way toward consumer production readiness from a consumer perspective. The current product state is a local command-contract and rehearsal prototype with credible local telemetry and provider boundaries, not a consumer-ready production framework.

Agentstack now has bootstrap generation, `agentstack.config.json`, broad CLI routing, local env graph rehearsal, structural validation, generated guidance/skills, local wide-event telemetry, OTLP-shaped local export, provider command plans for Clerk/Convex/Vercel/EAS, Clerk/Convex/Vercel preview/EAS preview live-read inspect, ledger-gated Convex and Vercel preview apply, local provider inventory/link/adopt, explicit bounded live provider inventory via `--source live` or `--live`, and sanitized partial live identity facts for Vercel preview and EAS preview env-list reads. It still lacks a truthful live validation runner, broad provider discovery/adoption, broad real provider provisioning, a real generated SaaS runtime, real OTel/network/hosted observability, preview deploy/build smoke evidence, production release gates, hosted control-plane state, and public package installability.

## Recent Completed Commits

- `b8a316f` docs: record identity facts checkpoint.
- `07f824a` feat: add sanitized live inventory identity facts.
- `04bbbbf` fix: redact vercel inspect failure diagnostics.
- `4fb2881` fix: classify vercel inspect failures truthfully.
- `661d108` feat: add vercel provider live inspect.
- `7e3dbeb` docs: repair progress head reference.
- `4ac7d86` docs: record latest progress head.
- `7c6fecc` docs: align progress checkpoint with head.
- `7e6c244` docs: update readiness progress checkpoint.
- `07f23d8` docs: refresh consumer production readiness plan.
- `ee12b8b` Make provider inventory and link telemetry-free.
- `2ae435a` docs: expose provider inventory link workflows.
- `e1a51c4` feat: add provider inventory link adopt commands.
- `d5c351d` feat: add provider control-plane intents.
- `95a3262` docs: plan provider inventory link adopt.
- `e2f3aa1` feat: gate provider mutations with ledger evidence.
- `f38e341` docs: plan wave 0 provider readiness.
- `1a8fd1f` docs: add consumer readiness progress log.
- `e3bb39c` docs: add consumer production readiness roadmap.
- `d366e33` feat: execute bounded vercel and eas provider actions.
- `2d0bdbb` feat: require explicit provider env ownership.
- `2f9c6b4` feat: add credential-safe provider execution.
- `ab40312` feat: add structured telemetry inspector.

Because this file is committed after it is edited, the commit containing the latest progress-only wording may appear above this list in git log.

## Provider Ledger State

The provider resource ledger exists at `docs/provider-resource-ledger.md`.

No real external provider resources are recorded in the ledger. No real Clerk, Convex, Vercel, EAS, telemetry, billing, hosted-control-plane, or similar provider resources were created, mutated, adopted, linked, or deleted in this progress update. `docs/provider-resource-ledger.md` should remain unchanged.

## Latest Truth

- Provider inventory defaults to local-control-plane only. It derives rows from the manifest, `.agentstack/provider-links.json`, and matching provider ledger rows. Local inventory writes no files, does not call provider CLIs, and does not treat `.agentstack/local-cloud.json` as external provider truth.
- Live provider inventory is explicit with `--source live` or `--live`. It starts from local inventory, calls only existing read-only inspect primitives, prints `Evidence: live-read-inventory`, `Mutation: none`, command/result counts, and redacted live-read fields. Provider command success is treated as read evidence, not exact existence proof. Vercel preview `env ls preview` and EAS preview `env:list --environment preview` can now produce sanitized partial proof labels (`identity-scope=partial`, `facts=expected-env-names,preview-environment,env-list-read`) while still keeping `identity=ambiguous`; actual env names, provider IDs, URLs, tokens, raw output snippets, ledger row IDs, and exact project/app identity are not printed or stored in inventory. Generic Clerk/Convex successful reads remain `identity-scope=none` and ambiguous. Provider read failures print `FAIL provider inventory <service> <env>` and return nonzero while preserving summary and row diagnostics. Vercel and EAS production live inventory fail before executor use.
- Provider link is local state only. It requires a matching `planned` or `active` ledger row and writes only `.agentstack/provider-links.json`. It does not mutate providers, telemetry, local-cloud state, or `docs/provider-resource-ledger.md`.
- Provider adopt is print-only. It prints a redacted ledger proposal and writes no files.
- Provider plan prints `Evidence: provider-command-plan`.
- Clerk inspect, Convex inspect, Vercel preview inspect, and EAS preview inspect have live-read semantics where implemented.
- Supported live mutation remains narrow: ledger-gated Convex apply and ledger-gated Vercel preview deploy apply. Clerk apply, Vercel env/production apply, EAS init/env/build/apply, and broad provider provisioning are still unavailable.
- `agentstack validate` validates manifest/env/guidance/theme/source-secret/generated anchors. It does not yet run lint, format, typecheck, tests, Convex checks, or full runtime checks.
- `agentstack validate --cloud` is honest local rehearsal. It checks local-cloud state and prints `Evidence: local-rehearsal`; it is not live provider validation.
- Local telemetry is a redacted wide-event JSONL store with observe query/timeline/trace/journey/errors/webhook/component/compare/export commands and OTLP-shaped local export artifacts. There is no real OTel SDK/network exporter, hosted indexing, provider log join, or production observability platform.
- The generated runtime has one real vertical: workspace-status. Web and mobile do not use Clerk or Convex runtime SDKs for production SaaS flows. Convex schema only materializes `workspaceStatuses`. `packages/ui` is primitive metadata, not a functional UI component library.

## Completed Work This Documentation Turn

- Refreshed `docs/consumer-production-readiness-roadmap.md` from the authoritative source spec and current committed state.
- Updated the readiness estimate to 38-40% and described the product as a local command-contract/rehearsal prototype, not consumer production-ready.
- Added a source-spec capability matrix with implemented, partial, missing, and misleading-risk statuses.
- Clarified what exists now versus what is still missing for a consumer path from `npx create-agent-stack` to real production environments.
- Documented strict provider-resource tracking discipline and cleanup flow.
- Re-prioritized the finish plan around provider integration gaps first, then truthful validation, runtime completeness, library/UI completeness, preview evidence, production/hosted platform, and public release hardening.
- Committed and aligned docs/template clarifications that provider inventory writes no files, provider link writes only `.agentstack/provider-links.json`, and provider adopt writes no files.
- Added Vercel preview provider live-read inspect for bounded environment-list reads with redacted CLI output and no provider ledger mutation.
- Corrected Vercel preview inspect failure classification so preview executor failures are reported as execution failures instead of unsupported-environment failures, while Vercel production inspect remains unavailable before executor use.
- Added regression coverage that Vercel preview inspect leaves `docs/provider-resource-ledger.md` byte-for-byte unchanged.
- Updated generated release docs to state that Clerk inspect, Vercel preview inspect, and EAS preview inspect are read-only, with Vercel production inspect/apply still unavailable.
- Added `agentstack provider inventory --source live` and `--live` for bounded read-only live inventory while preserving default local-only inventory.
- Added live inventory row fields for live status, identity match, permission summary, and drift summary without serializing raw provider IDs, URLs, tokens, secrets, or ledger row IDs.
- Reused only existing read-only inspect primitives: Clerk read-only inspect, Convex read-only inspect, Vercel preview read-only inspect, and EAS preview read-only inspect.
- Kept Vercel and EAS production live inventory unsupported before executor use.
- Updated generated Agentstack docs in both template mirrors to describe local default inventory and explicit bounded live inventory.
- Corrected live inventory failure semantics so failed provider read results now print `FAIL provider inventory <service> <env>` and return nonzero while keeping redacted evidence, summary counts, and row diagnostics visible.
- Review outcome: spec review of `f86d510` passed; quality review found the P1 live-read failure exit-code issue above; fix commit `8db8a6e` passed re-review.
- Added sanitized partial live identity facts for Vercel preview and EAS preview env-list success when expected env-name and preview-environment proof can be observed from the existing read-only command output.
- Kept partial facts explicitly non-exact: inventory rows use `live=found identity=ambiguous identity-scope=partial permission=read-ok drift=unknown facts=...`, not matched/exact identity.
- Added regression coverage that generic successful Clerk/Convex-style inspect remains ambiguous with no partial facts, failed live reads keep `identity-scope=none`, production Vercel/EAS live inventory still rejects before executor use, and raw provider output/IDs/URLs/tokens/ledger IDs do not appear in inventory or CLI output.
- Quality review found two blocking issues in the identity-facts slice: unsupported exact confidence was still type/runtime reachable, and Vercel preview facts could be emitted without preview proof in provider output. The follow-up fix removes exact from the supported confidence model, drops malformed exact runtime facts, and requires both expected env-name evidence and preview-environment evidence before Vercel emits partial facts.

## Current Blockers And Gaps

- No truthful live validation runner exists yet.
- Broad provider discovery/adoption is not implemented; live inventory is bounded read-only evidence and not discovery, provisioning, adoption, or reconciliation.
- Vercel live-read is bounded to preview env-list inspect; production Vercel live-read remains unavailable.
- Provider live mutation is limited to ledger-gated Convex apply and Vercel preview deploy apply.
- Real Clerk, Convex, Vercel, and EAS create/provision/reconcile/apply coverage is missing or partial.
- Generated SaaS runtime is not real: no Clerk auth/org runtime, billing/webhooks, entitlements, audit, or protected end-to-end Convex data path across web/mobile.
- UI package is not a functional primitive library.
- Observability is local JSONL plus OTLP-shaped artifact export only.
- Preview deploy/build smoke evidence and production release gates remain local/rehearsal-oriented.
- Hosted control plane and public packaging/installability are missing.

## Next Concrete Actions

1. Finish provider integration gaps first:
   - Expand Vercel live-read beyond bounded preview env-list only when production read semantics are explicitly designed.
   - Expand live inventory with provider-specific exact identity parsers only where exact identity matching can be proven without leaking identifiers.
   - Add live-safe link/adopt identity confirmation without writing secrets.
   - Keep all mutation paths ledger-gated and evidence-labeled.
2. Build the truthful validation runner:
   - Make `agentstack validate` run lint, format, typecheck, tests, Convex checks, generated-boundary checks, theme checks, telemetry checks, secret scanning, and manifest validation.
   - Split local rehearsal from live provider validation where command names or output could mislead consumers.
3. Start the real generated SaaS runtime after provider identity and validation semantics are credible:
   - Clerk auth/orgs, Convex protected data, billing/webhooks, entitlements, audit, web/mobile parity, and functional unstyled UI primitives.
4. Continue to keep template docs and `packages/create-agent-stack/templates` mirrors aligned in the same changes.
5. Update `docs/provider-resource-ledger.md` before any real provider resource is created, adopted, linked, mutated, or cleaned up.

## Last Known Verification Evidence

Most recent worker verification for the identity-facts quality fix follow-up:

- `pnpm vitest run packages/adapters/src/provider-control-plane.test.ts packages/adapters/src/provider-executor.test.ts packages/adapters/src/vercel.test.ts packages/adapters/src/eas.test.ts packages/cli/src/run.test.ts` passed: 5 files / 194 tests.
- `pnpm typecheck` passed.
- `pnpm test` passed: 27 files / 360 tests.
- `diff -ru templates/b2b-saas/docs/agentstack packages/create-agent-stack/templates/b2b-saas/docs/agentstack` passed with no output.
- `git diff --check` passed with no output.
- `git diff -- docs/provider-resource-ledger.md` passed with no output.
- `git status --short --branch` showed only the intended follow-up edits before commit.

## Worktree State Expectation

After committing this progress update, the expected worktree state is clean. `docs/provider-resource-ledger.md` should have no diff.

## Vercel Inspect Failure Diagnostic Hardening

- Redacted Vercel preview provider inspect execution-failure diagnostics with the provider text redactor so CLI/tool errors cannot print token-shaped values.
- Added regression coverage that `provider.inspect.execution` remains the failure classification while raw Vercel token-like values are omitted from output.
