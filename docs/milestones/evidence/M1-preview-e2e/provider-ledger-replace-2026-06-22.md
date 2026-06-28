# Provider Ledger Replace

Date: 2026-06-22
Actor: Codex

## Target

M1 Ledger unblock. This does not pass the Ledger checkbox without real preview Clerk, Convex, and Vercel resources.

## Change

`agentstack provider ledger record --replace` now replaces the matching provider/environment/resource/name row instead of appending a duplicate. This lets a planned row that started with `external id/url` as `pending` be repaired after the real provider id or dashboard URL is known.

Generated M1 docs now show the replacement path:

```bash
pnpm run provider:ledger:record -- --replace --service convex --env preview --resource-type deployment --name <app-slug>-preview --external-id <real-id-or-url> --owner <owner> --purpose "M1 preview protected Convex data smoke" --created-by <name> --created-at <yyyy-mm-dd> --cleanup-trigger "M1 pass or pivot" --cleanup "delete through Convex dashboard" --evidence docs/milestones/evidence/M1-preview-e2e/provider-ledger-convex-<yyyy-mm-dd>-active.md --status active --write-evidence
```

## Evidence

- Red adapter test: `pnpm vitest run packages/adapters/src/provider-ledger.test.ts` failed because duplicate rows were rejected even with the new replacement expectation.
- Red CLI test: `pnpm vitest run packages/cli/src/run.test.ts -t "replaces an existing provider ledger row"` failed because `provider ledger record --replace` returned nonzero before implementation.
- Red generated-doc test: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates a B2B SaaS project with app tokens replaced"` failed because generated M1 docs did not contain `provider:ledger:record -- --replace`.
- Focused verification: `pnpm vitest run packages/adapters/src/provider-ledger.test.ts packages/cli/src/run.test.ts packages/create-agent-stack/src/generate.test.ts` passed with 3 test files and 264 tests.
- Framework verification: `pnpm typecheck` passed.
- Framework verification: `pnpm test` passed with 28 test files and 545 tests.

## Mutation

- Provider mutation: none
- Ledger mutation: none in this repository
- Local mutation: provider ledger adapter, CLI, generated M1 docs, generated tests, and this evidence note

## Remaining blocker

Real M1 acceptance is still blocked before Ledger: no real preview Clerk, Convex, or Vercel resource rows exist in `docs/provider-resource-ledger.md`.
