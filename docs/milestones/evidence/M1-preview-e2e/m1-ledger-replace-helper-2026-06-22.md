# M1 Ledger Replace Helper

Date: 2026-06-22
Actor: Codex

## Target

M1 Ledger operator path after explicit pre-creation `pending` rows.

This does not pass the Ledger checkbox without real preview Clerk, Convex, and Vercel resources.

## Change

Generated `m1:ledger:record` now supports `--replace` for the pending-to-real repair path. After a deliberate `--allow-pending` run, the operator can set all three `M1_*_EXTERNAL_ID` values and run:

```bash
pnpm run m1:ledger:record -- --owner <owner-account-or-project> --created-by <name> --created-at <yyyy-mm-dd> --status active --replace
```

The helper passes `--replace` through to `provider ledger record`, replaces the matching Clerk, Convex, and Vercel preview rows instead of appending duplicates, and writes replacement evidence as `provider-ledger-<service>-<yyyy-mm-dd>-active.md` to avoid colliding with earlier pending evidence.

`--replace` requires `--status active`; missing `M1_*_EXTERNAL_ID` values still fail before mutation, even if `--allow-pending` is also present.

## Evidence

- Red generated-project test: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 ledger helper replaces explicit pending rows with real ids"` failed because generated `m1:ledger:record` treated `--replace` as a valued flag and exited with `Missing value for --replace`.
- Green focused verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 11 tests.
- Framework verification: `pnpm typecheck` passed.
- Framework verification: `pnpm test` passed with 28 test files and 546 tests.
- Diff hygiene: `git diff --check` passed.

## Mutation

- Provider mutation: none
- Ledger mutation: none in this repository
- Local mutation: generated M1 ledger helper, generated docs/skill references, generated test, active milestone card, and this evidence note

## Remaining blocker

Real M1 acceptance is still blocked before Ledger: no real preview Clerk, Convex, or Vercel resource rows exist in `docs/provider-resource-ledger.md`.
