# M1 Preview Smoke Failure Evidence

Date: 2026-06-22
Actor: Codex

## Target

M1 Auth, Data, and Evidence blocker capture when the deployed smoke marker check fails.

This does not pass Auth or Data because no real deployed Clerk sign-in or protected Convex call was completed.

## Change

Generated `m1:preview:smoke` now writes a redacted `smoke-output.txt` even when the DOM marker check fails. The failure artifact records:

- `Result: FAIL`
- deploy URL
- auth marker summary
- protected-data marker summary
- workspace id marker summary
- marker-missing reasons

It does not store the raw DOM snapshot, workspace id values, provider identifiers, cookies, or tokens. Passing smoke still records `deploy-url.txt` and overwrites `smoke-output.txt` with `Result: PASS`.

Generated preview docs, M1 evidence README, and runbook guidance now describe both PASS and redacted FAIL smoke output.

## Evidence

- Red generated-project behavior test: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts that execute from the generated project"` failed because `smoke-output.txt` was missing after a marker-failed smoke run.
- Green focused behavior verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts that execute from the generated project"` passed.
- Red generated-docs test: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates a B2B SaaS project with app tokens replaced"` failed because generated preview docs did not describe the smoke failure artifact.
- Green generated-docs verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates a B2B SaaS project with app tokens replaced"` passed.
- Green generated-template verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 15 tests.
- Framework verification: `pnpm typecheck` passed.
- Framework verification: `pnpm test` passed with 28 test files and 550 tests.
- Diff hygiene: `git diff --check` passed.

## Mutation

- Provider mutation: none
- Ledger mutation: none in this repository
- Local mutation: generated M1 smoke helper, generated docs/runbook/evidence guidance, generated test, active milestone card, and this evidence note

## Remaining blocker

Real M1 acceptance is still blocked before Ledger: no real preview Clerk, Convex, or Vercel resource rows exist in `docs/provider-resource-ledger.md`.
