# M1 Preview Deploy Failure Evidence

Date: 2026-06-22
Actor: Codex

## Target

M1 Deploy and Evidence blocker capture after confirmed provider execution starts.

This does not pass Deploy because no real Vercel preview URL was produced.

## Change

Generated `m1:preview:deploy` now writes a redacted `deploy-output.txt` when a confirmed deploy attempt fails after provider execution starts. The failure artifact records:

- `Result: FAIL`
- failed stage
- Convex apply status
- Vercel apply status
- `Deploy URL: unavailable`

It does not store raw provider stdout, stderr, provider identifiers, tokens, or secrets. Confirmation-required failures still write no evidence because no provider execution has started.

## Evidence

- Environment check: no `M1_*`, `CLERK*`, `CONVEX*`, `VERCEL*`, `VITE_CLERK*`, or `VITE_CONVEX*` variables were present, so no real provider ledger rows or live deploy attempt were possible from this shell.
- Red generated-project test: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 deploy helper writes redacted failure evidence after provider execution starts"` failed because `deploy-output.txt` was missing after a simulated Vercel provider failure.
- Green focused verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 12 tests.
- Framework verification: `pnpm typecheck` passed.
- Framework verification: `pnpm test` passed with 28 test files and 547 tests.
- Diff hygiene: `git diff --check` passed.

## Mutation

- Provider mutation: none
- Ledger mutation: none in this repository
- Local mutation: generated M1 deploy helper, generated docs/runbook/evidence guidance, generated test, active milestone card, and this evidence note

## Remaining blocker

Real M1 acceptance is still blocked before Ledger: no real preview Clerk, Convex, or Vercel resource rows exist in `docs/provider-resource-ledger.md`.
