# Agentstack Consumer Production Readiness Progress

Date: 2026-06-21

This file is the canonical resume and progress artifact for Agentstack consumer production readiness work. Update it before ending every roadmap work turn so the next worker can resume from current truth without reconstructing state from scattered notes.

## Current State

Current phase: Wave 2 provider inventory/link/adopt checkpoint, readiness roadmap refresh, and progress checkpoint/progress file are committed through `4ac7d86` (`docs: record latest progress head`).

Overall status: not complete. Agentstack is about 38-40% of the way toward consumer production readiness from a consumer perspective. The current product state is a local command-contract and rehearsal prototype with credible local telemetry and provider boundaries, not a consumer-ready production framework.

Agentstack now has bootstrap generation, `agentstack.config.json`, broad CLI routing, local env graph rehearsal, structural validation, generated guidance/skills, local wide-event telemetry, OTLP-shaped local export, provider command plans for Clerk/Convex/Vercel/EAS, ledger-gated Convex and Vercel preview apply, and local provider inventory/link/adopt. It still lacks a truthful live validation runner, live provider inventory/discovery/adoption, broad real provider provisioning, a real generated SaaS runtime, real OTel/network/hosted observability, preview deploy/build smoke evidence, production release gates, hosted control-plane state, and public package installability.

## Recent Completed Commits

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

## Provider Ledger State

The provider resource ledger exists at `docs/provider-resource-ledger.md`.

No real external provider resources are recorded in the ledger. No real Clerk, Convex, Vercel, EAS, telemetry, billing, hosted-control-plane, or similar provider resources were created, mutated, adopted, linked, or deleted in this progress update. `docs/provider-resource-ledger.md` should remain unchanged.

## Latest Truth

- Provider inventory is local-control-plane only. It derives rows from the manifest, `.agentstack/provider-links.json`, and matching provider ledger rows. It writes no files, does not call provider CLIs, does not print `Evidence: live-read`, and does not treat `.agentstack/local-cloud.json` as external provider truth.
- Provider link is local state only. It requires a matching `planned` or `active` ledger row and writes only `.agentstack/provider-links.json`. It does not mutate providers, telemetry, local-cloud state, or `docs/provider-resource-ledger.md`.
- Provider adopt is print-only. It prints a redacted ledger proposal and writes no files.
- Provider plan prints `Evidence: provider-command-plan`.
- Clerk inspect, Convex inspect, and EAS preview inspect have live-read semantics where implemented; Vercel live-read remains missing.
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

## Current Blockers And Gaps

- No truthful live validation runner exists yet.
- Live provider inventory/discovery/adoption is not implemented; current inventory/link/adopt is local-control-plane only.
- Vercel live-read parity is missing.
- Provider live mutation is limited to ledger-gated Convex apply and Vercel preview deploy apply.
- Real Clerk, Convex, Vercel, and EAS create/provision/reconcile/apply coverage is missing or partial.
- Generated SaaS runtime is not real: no Clerk auth/org runtime, billing/webhooks, entitlements, audit, or protected end-to-end Convex data path across web/mobile.
- UI package is not a functional primitive library.
- Observability is local JSONL plus OTLP-shaped artifact export only.
- Preview deploy/build smoke evidence and production release gates remain local/rehearsal-oriented.
- Hosted control plane and public packaging/installability are missing.

## Next Concrete Actions

1. Finish provider integration gaps first:
   - Add Vercel live-read.
   - Implement live provider inventory/discovery for Clerk, Convex, Vercel, and EAS.
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

Most recent final verification after commits `07f23d8`, `7e6c244`, `7c6fecc`, and `4ac7d86`:

- `git diff --check` passed.
- `diff -ru templates/b2b-saas/docs/agentstack packages/create-agent-stack/templates/b2b-saas/docs/agentstack` passed.
- `git diff -- docs/provider-resource-ledger.md` returned no diff.
- `pnpm typecheck` passed.
- `pnpm test` passed: 27 files / 339 tests.

## Worktree State Expectation

After commit `4ac7d86`, the expected worktree state is clean. `docs/provider-resource-ledger.md` should have no diff.
