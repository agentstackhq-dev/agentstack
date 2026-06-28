# M1 Ledger Pending Guard

Date: 2026-06-22
Actor: Codex

## Target

M1 Ledger truthfulness. This does not pass the Ledger checkbox without real preview Clerk, Convex, and Vercel resources.

## Change

Generated `m1:ledger:record` no longer silently defaults missing `M1_*_EXTERNAL_ID` values to `pending`. Missing real ids now fail before ledger mutation unless the operator explicitly passes `--allow-pending` for pre-creation planned rows.

Pending rows remain valid planning rows, but they are not M1 Ledger completion. They must be replaced with real provider ids or dashboard URLs through `provider:ledger:record -- --replace` before final evidence can pass.

## Evidence

- Red generated-project test: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts that execute from the generated project"` failed because `m1:ledger:record` resolved successfully and wrote pending rows without `M1_*_EXTERNAL_ID`.
- Green focused verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 10 tests.
- Framework verification: `pnpm typecheck` passed.
- Framework verification: `pnpm test` passed with 28 test files and 545 tests.

## Mutation

- Provider mutation: none
- Ledger mutation: none in this repository
- Local mutation: generated M1 ledger helper, generated docs/skill references, generated test, and this evidence note

## Remaining blocker

Real M1 acceptance is still blocked before Ledger: no real preview Clerk, Convex, or Vercel resource rows exist in `docs/provider-resource-ledger.md`.
