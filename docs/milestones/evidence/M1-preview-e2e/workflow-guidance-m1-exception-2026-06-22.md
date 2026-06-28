# M1 Workflow Guidance Exception

Date: 2026-06-22
Actor: Codex

## Target

M1 Deploy/Evidence guidance accuracy. This does not pass the Deploy or Evidence acceptance checkboxes without real preview provider resources.

## Change

Generated `docs/agentstack/workflows.md` now distinguishes:

- Generic `preview:*` deploy rehearsal: local-only, writes local deploy rehearsal state, not M1 live evidence.
- M1 preview helper path: `m1:ledger:record`, `m1:providers:link`, `m1:preview:deploy -- --confirm-live-mutation`, `m1:preview:smoke`, and `m1:evidence:check`.

The workflow docs now state that M1 preview helpers are the exception to the local-only preview rehearsal boundary and warn not to check Deploy, Auth, Data, or Evidence from `preview:deploy` or `preview:deploy:apply` output.

## Evidence

- Red test: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates a B2B SaaS project with app tokens replaced"` failed because generated workflow docs did not contain the M1 exception wording.
- Green test: the same focused command passed after updating both template mirrors.
- Focused template verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 10 tests.
- Framework verification: `pnpm typecheck` passed.
- Framework verification: `pnpm test` passed with 28 test files and 543 tests.

## Mutation

- Provider mutation: none
- Ledger mutation: none
- Local mutation: generated workflow docs, generated-project test, and this evidence note only

## Remaining blocker

Real M1 acceptance is still blocked before Ledger: no real preview Clerk, Convex, or Vercel resource rows exist in `docs/provider-resource-ledger.md`.
