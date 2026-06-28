# M1 Evidence Runbook Result Gate

Date: 2026-06-22

Actor: Codex

Milestone checkbox target: Evidence for M1 Preview E2E.

## Change

- `m1:evidence:check` now rejects a completed-looking `runbook.md` when any step result is `fail` or `not run`.
- `m1:evidence:check` now rejects a completed-looking `runbook.md` when any final required M1 checkbox review value is `fail` or `unchanged`.
- The parser normalizes markdown backticks around runbook values, matching the generated scaffold shape.
- Generated preview docs, generated evidence README, generated runbook, and generated Agentstack skill workflow guidance now describe that required runbook step results and final M1 checkbox reviews must be `pass`.

## Red-Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 evidence check rejects failed runbook results"` failed because the evidence checker passed with `Result: \`fail\`` in the runbook.
- GREEN: the same focused regression passed after adding runbook result validation.
- GREEN: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 evidence check rejects unchanged final runbook checkboxes"` passed after the same validation rejected final checkbox values other than `pass`.

## Verification

- `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 23 tests.
- `pnpm typecheck` passed.
- `pnpm test` passed with 28 test files and 558 tests.

## Checkbox Progress

- Generate: unchanged, still checked.
- Evidence: unchanged; local false-pass behavior is stricter, but the final bundle still requires real active ledger rows, provider links, PASS deploy evidence, PASS smoke evidence, and a completed redacted runbook with pass step results and pass final checkbox review values.
- Ledger/Connect/Deploy/Auth/Data: unchanged; no live provider work was attempted.

## Next Smallest Step

Run `m1:ledger:record -- --status active` with real preview Clerk, Convex, and Vercel external IDs, then continue with `m1:providers:link`, `m1:preview:deploy -- --confirm-live-mutation`, `m1:preview:smoke`, complete `runbook.md` with pass results and redacted facts, and run `m1:evidence:check`.
