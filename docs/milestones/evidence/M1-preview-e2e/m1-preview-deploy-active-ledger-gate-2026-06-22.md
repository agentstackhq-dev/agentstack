# M1 Preview Deploy Active Ledger Gate

Date: 2026-06-22
Actor: Codex

## Target

M1 Deploy mutation boundary.

This does not pass Deploy because no real Vercel preview URL was produced from this repository.

## Change

Generated `m1:preview:deploy` now preflights the M1 provider ledger before invoking any provider apply command. It requires active Clerk, Convex, and Vercel preview rows with non-pending external ids. Planned rows now fail closed with:

```text
FAIL m1 preview deploy.ledger-active-required
```

The refusal happens before provider execution starts and writes no `deploy-output.txt`, no `deploy-url.txt`, no provider resources, no ledger changes, and no telemetry.

Generated preview, milestone, runbook, and skill guardrail guidance now says M1 deploy requires active ledger rows before provider execution.

## Evidence

- Red generated-project test: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 deploy helper requires active provider ledger rows before provider execution"` failed because confirmed deploy started Convex provider apply from `planned` rows and wrote deploy failure evidence.
- Green focused verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 deploy helper requires active provider ledger rows before provider execution"` passed.
- Green deploy-failure evidence verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 deploy helper writes redacted failure evidence after provider execution starts"` passed after recording active rows first.
- Green generated-package verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts that execute from the generated project"` passed.
- Green generated-docs verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates a B2B SaaS project with app tokens replaced"` passed.
- Green generated-template verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 15 tests.
- Framework verification: `pnpm typecheck` passed.
- Framework verification: `pnpm test` passed with 28 test files and 550 tests.
- Diff hygiene: `git diff --check` passed.

## Mutation

- Provider mutation: none
- Ledger mutation: none in this repository
- Local mutation: generated M1 deploy helper, generated docs/runbook/skill guidance, generated test, active milestone card, and this evidence note

## Remaining blocker

Real M1 acceptance is still blocked before Ledger: record real preview Clerk, Convex, and Vercel rows with `--status active`, then run provider link, deploy, smoke, and evidence check.
