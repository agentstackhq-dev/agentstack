# M1 Provider Link Active Ledger Gate

Date: 2026-06-22
Actor: Codex

## Target

M1 Connect gate correctness.

This does not pass Connect because no real preview Clerk, Convex, or Vercel resources were linked from this repository.

## Change

Generated `m1:providers:link` now preflights the M1 provider ledger before invoking any provider-link command. It requires active Clerk, Convex, and Vercel preview rows with non-pending external ids. Planned rows now fail closed with:

```text
FAIL m1 providers link.ledger-active-required
```

The refusal writes no `.agentstack/provider-links.json`, no `provider-links.txt`, no provider resources, no ledger changes, and no telemetry.

Generated preview, milestone, and runbook guidance now says M1 provider linking requires active ledger rows.

## Evidence

- Red generated-project test: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 provider link requires active provider ledger rows"` failed because planned rows produced PASS link evidence and `.agentstack/provider-links.json`.
- Green focused verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 provider link requires active provider ledger rows"` passed.
- Green generated-package verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts that execute from the generated project"` passed.
- Green generated-docs verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates a B2B SaaS project with app tokens replaced"` passed.
- Green generated-template verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 15 tests.
- Framework verification: `pnpm typecheck` passed.
- Framework verification: `pnpm test` passed with 28 test files and 550 tests.
- Diff hygiene: `git diff --check` passed.

## Mutation

- Provider mutation: none
- Ledger mutation: none in this repository
- Local mutation: generated M1 provider-link helper, generated docs/runbook guidance, generated test, active milestone card, and this evidence note

## Remaining blocker

Real M1 acceptance is still blocked before Ledger: record real preview Clerk, Convex, and Vercel rows with `--status active`, then run provider link, deploy, smoke, and evidence check.
