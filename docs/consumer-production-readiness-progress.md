# Agentstack Consumer Production Readiness Progress

Date: 2026-06-21

This file is the canonical resume and progress artifact for Agentstack consumer production readiness work. It must be updated before ending every roadmap work turn so the next worker can resume from the current truth without reconstructing state from scattered notes.

## Current State

Current phase: Wave 0 implementation checkpoint committed: truth labels, provider ledger enforcement, and template alignment are implemented.

Overall status: not complete. Agentstack is roughly 35-40% of the way toward consumer production readiness according to the roadmap. The current product state is a stronger command-contract and provider-boundary prototype, not a consumer-ready production framework.

The prototype now has explicit evidence tiers in command output, ledger-gated supported provider mutations, strict provider-ledger parsing, and generated project ledger docs. It still lacks truthful live validation, complete live provider inventory/link/adopt flows, a real generated SaaS runtime, and production-grade release gates.

## Recent Completed Commits

- Current checkpoint: feat: gate provider mutations with ledger evidence.
- f38e341 docs: plan wave 0 provider readiness.
- 1a8fd1f docs: add consumer production readiness progress.
- e3bb39c docs: add consumer production readiness roadmap.
- d366e33 feat: execute bounded vercel and eas provider actions.
- 2d0bdbb feat: require explicit provider env ownership.
- 2f9c6b4 feat: add credential-safe provider execution.
- ab40312 feat: add structured telemetry inspector.

## Provider Ledger State

The provider resource ledger exists at `docs/provider-resource-ledger.md`.

No real external provider resources are recorded in the ledger. No external Clerk, Convex, Vercel, EAS, telemetry, or similar provider resources were created, mutated, adopted, linked, or deleted in this progress update.

## Completed Work This Turn

- Implemented strict provider ledger parsing in `packages/adapters/src/provider-ledger.ts`, scoped to the `## Ledger` section and the current 16-column schema only.
- Added provider ledger enforcement before supported live mutation executors run.
- Added non-mutating provider-plan ledger advisory status for supported apply targets.
- Added explicit evidence labels:
  - `local-rehearsal` for local-cloud validation, sync, deploy rehearsal, production provision rehearsal, and mobile build rehearsal.
  - `provider-command-plan` for provider plan.
  - `live-read` for provider inspect.
  - `live-mutation` for supported provider apply.
- Updated provider apply diagnostics so missing, invalid, incomplete, and blocked ledger states fail before executor resolution.
- Removed raw ledger row content and row IDs from CLI diagnostics/advisory output; regression tests cover secret-like row content and secret-like IDs.
- Cleaned source-spec and docs references so the active manifest format is `agentstack.config.json`, not a TypeScript manifest path.
- Added generated project `docs/provider-resource-ledger.md` to both the root template and package-local template mirror, with generator coverage.
- Updated README, generated template docs, and spin-up pages to describe evidence tiers, ledger-gated mutations, and local/live boundaries truthfully.
- Confirmed that no provider resources were created, changed, adopted, linked, or deleted during this implementation slice.

## Current Blockers And Gaps

- Provider ledger enforcement is wired only for currently supported live mutations: Convex preview/production apply and Vercel preview apply. Other provider apply paths remain unsupported.
- Evidence labels are implemented for current command surfaces, but there is not yet a separate truthful live validation runner.
- Manifest format cleanup is complete for this slice, but broader manifest/schema ergonomics still need production hardening.
- The truthful validation runner has not been started.
- Provider inventory, link, and adopt flows are not implemented.
- The generated SaaS runtime is not real.
- UI primitives, runtime package boundaries, hosted account connection design, and production release gates remain future roadmap work.

## In Progress And Next Concrete Actions

1. Start the next provider-integration slice with live provider inventory/link/adopt design and tests before broadening mutation support.
2. Add a truthful validation runner that separates local validation, local-cloud rehearsal, live inventory, deployed runtime evidence, auth evidence, billing/webhook evidence, mobile evidence, and telemetry evidence.
3. Keep `docs/provider-resource-ledger.md` updated before any real Clerk, Convex, Vercel, EAS, telemetry, or billing resources are created, adopted, linked, mutated, or cleaned up.

## Last Known Verification Evidence

- `pnpm vitest run packages/adapters/src/provider-ledger.test.ts packages/cli/src/run.test.ts packages/create-agent-stack/src/generate.test.ts` passed: 3 files / 159 tests.
- `pnpm typecheck` passed.
- `pnpm test` passed: 26 files / 323 tests.
- `git diff --check` passed.
- `diff -ru templates/b2b-saas/docs packages/create-agent-stack/templates/b2b-saas/docs` passed.
- `rg -n "agentstack\\.config\\.ts|TypeScript manifest|config reader fallback|fallback lookup path"` over README, source spec, templates, package template mirrors, spin-up site, and packages returned no matches.
- `rg -n "decision\\.row\\.id|Ledger: (planned|active) <id>|Ledger: blocked <status> <id>|row IDs are printed|row ids are printed|raw ledger row IDs|raw ledger row ids"` over CLI, tests, docs, templates, and spin-up site returned no matches.
- `git diff -- docs/provider-resource-ledger.md` returned no diff.

## Delegated-Agent Outcomes

- Manifest/spec cleanup worker aligned active docs on `agentstack.config.json`.
- Test worker added red coverage for provider ledger parsing/enforcement and apply gating.
- Implementation workers added provider ledger parsing, provider apply gates, plan advisory status, evidence labels, and generated docs/template updates.
- Spec reviewer initially failed on evidence-label and provider-plan status details; follow-up worker fixed those gaps.
- Quality reviewer failed on raw invalid-row leakage and missing generated ledger docs; follow-up workers fixed both.
- Final reviewer initially failed on raw ledger row ID leakage in plan/apply output; follow-up workers removed IDs from CLI output and docs, then added secret-like ID regressions.
- Final verification passed after the reviewer fixes.
- No active external provider resources are recorded.

## Worktree State Expectation

After the Wave 0 implementation checkpoint commit, the expected worktree state is clean. The next uncommitted work should start from provider inventory/link/adopt or truthful validation runner work, not more Wave 0 drift.

The Wave 0 implementation checkpoint covers:

- `packages/adapters/src/provider-ledger.ts`
- `packages/adapters/src/provider-ledger.test.ts`
- `packages/cli/src/run.ts`
- `packages/cli/src/run.test.ts`
- `packages/create-agent-stack/src/generate.test.ts`
- root and package-local generated template docs
- README and spin-up site docs
- `docs/consumer-production-readiness-progress.md`

No provider CLIs were run for this implementation checkpoint, and no external provider resources were created, mutated, adopted, linked, or deleted.
