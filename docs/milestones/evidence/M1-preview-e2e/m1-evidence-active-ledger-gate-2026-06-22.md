# M1 Evidence Active Ledger Gate

Date: 2026-06-22
Actor: Codex

## Target

M1 Ledger and Evidence gate correctness.

This does not pass Ledger because no real preview Clerk, Convex, or Vercel resources were recorded in this repository.

## Change

Generated `m1:evidence:check` now requires the M1 Clerk, Convex, and Vercel provider ledger rows to have `current status` set to `active`. It still rejects missing, pending, or unredacted/invalid evidence as before.

Generated milestone, preview, runbook, workflow, and skill guidance now tells operators to pass `--status active` when recording real preview resource rows. `--allow-pending` remains available only for pre-creation planned rows and does not complete Ledger or Evidence.

## Evidence

- Red generated-project test: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 evidence check requires active provider ledger rows"` failed because an otherwise complete evidence bundle passed with `planned` ledger rows.
- Green focused verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 evidence check requires active provider ledger rows"` passed.
- Red generated-docs test: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates a B2B SaaS project with app tokens replaced"` failed because generated M1 docs did not instruct `--status active` for real rows.
- Green generated-docs verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates a B2B SaaS project with app tokens replaced"` passed.
- Green generated-package verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts that execute from the generated project"` passed.
- Green generated-template verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 15 tests.
- Framework verification: `pnpm typecheck` passed.
- Framework verification: `pnpm test` passed with 28 test files and 550 tests.
- Diff hygiene: `git diff --check` passed.

## Mutation

- Provider mutation: none
- Ledger mutation: none in this repository
- Local mutation: generated evidence checker, generated docs/runbook/workflow/skill guidance, generated test, active milestone card, and this evidence note

## Remaining blocker

Real M1 acceptance is still blocked before Ledger: record real preview Clerk, Convex, and Vercel rows with `--status active`, then run provider link, deploy, smoke, and evidence check.
