# M1 Provider Link Evidence

Date: 2026-06-22
Actor: Codex

## Target

M1 Connect and Evidence durability after local provider-link state is written.

This does not pass Connect without real preview provider rows and a real generated app run.

## Change

Generated `m1:providers:link` now writes redacted evidence to:

```text
docs/milestones/evidence/M1-preview-e2e/provider-links.txt
```

The artifact records the three M1 preview links, local mutation boundary, provider mutation boundary, ledger mutation boundary, and telemetry boundary. It does not store raw provider identifiers, tokens, secrets, or provider stdout.

Generated `m1:evidence:check` now requires that provider-link evidence file and reports `Checked: provider link evidence` on success.

## Evidence

- Red generated-project test: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts that execute from the generated project"` failed because `m1:providers:link` did not report or write `docs/milestones/evidence/M1-preview-e2e/provider-links.txt`.
- Green focused verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts that execute from the generated project"` passed.
- Green generated-template verification: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 12 tests.
- Framework verification: `pnpm typecheck` passed.
- Framework verification: `pnpm test` passed with 28 test files and 547 tests.
- Diff hygiene: `git diff --check` passed.

## Mutation

- Provider mutation: none
- Ledger mutation: none in this repository
- Local mutation: generated M1 provider-link helper, generated evidence checker, generated docs/runbook/evidence guidance, generated test, active milestone card, and this evidence note

## Remaining blocker

Real M1 acceptance is still blocked before Ledger: no real preview Clerk, Convex, or Vercel resource rows exist in `docs/provider-resource-ledger.md`.
