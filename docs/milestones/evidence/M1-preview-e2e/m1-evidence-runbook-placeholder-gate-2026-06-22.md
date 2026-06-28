# M1 Evidence Runbook Placeholder Gate

Date: 2026-06-22

Actor: Codex

Milestone checkbox target: Evidence for M1 Preview E2E.

## Change

- `m1:evidence:check` now rejects `runbook.md` when the generated scaffold placeholders are still present, even if the top-level status has been changed from `not run`.
- The check covers the owner/operator/date placeholders, per-step result placeholders, checkbox review placeholders, blocker-note placeholders, and the smallest-next-step placeholder.
- Generated preview docs, generated evidence README, and generated Agentstack skill workflow guidance now state that runbook placeholders must be replaced with redacted facts before Evidence can pass.

## Red-Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts that execute from the generated project"` failed because the evidence checker passed after only replacing `Status: not run` with `Status: run`.
- GREEN: the same focused test passed after `m1:evidence:check` began rejecting unresolved runbook placeholders and the fixture filled the scaffold with redacted facts.

## Verification

- `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 20 tests.
- `pnpm typecheck` passed.
- `pnpm test` passed with 28 test files and 555 tests.

## Checkbox Progress

- Generate: unchanged, still checked.
- Ledger: unchanged, still requires real preview Clerk, Convex, and Vercel active ledger rows.
- Connect/Deploy/Auth/Data: unchanged; no live provider work was attempted.
- Evidence: unchanged; the local checker is stricter, but the final bundle still requires real active ledger rows, provider links, PASS deploy evidence, PASS smoke evidence, and a completed redacted runbook.

## Next Smallest Step

Run `m1:ledger:record -- --status active` with real preview Clerk, Convex, and Vercel external IDs, then continue with `m1:providers:link`, `m1:preview:deploy -- --confirm-live-mutation`, `m1:preview:smoke`, complete `runbook.md` with redacted facts, and run `m1:evidence:check`.
