# M1 Ledger Rollback

Date: 2026-06-22

Actor: Codex

Milestone checkbox target: Ledger for M1 Preview E2E.

## Change

- `m1:ledger:record` now snapshots `docs/provider-resource-ledger.md` plus the three M1 provider-ledger evidence files before invoking per-service ledger record commands.
- If any individual service record fails after earlier local writes, the helper restores the previous ledger content and restores or removes the M1 provider-ledger evidence files back to their pre-run state.
- Generated preview docs, generated evidence README, generated runbook, and generated Agentstack skill workflow guidance now describe the rollback contract.

## Red-Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 ledger helper restores local state on partial record failure"` failed because a simulated Clerk ledger write remained after the simulated Convex ledger command failed.
- GREEN: the same focused regression passed after adding rollback behavior to both template copies.

## Verification

- `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 21 tests.
- `pnpm typecheck` passed.
- `pnpm test` passed with 28 test files and 556 tests.

## Checkbox Progress

- Generate: unchanged, still checked.
- Ledger: unchanged; local partial-failure behavior is safer, but real preview Clerk, Convex, and Vercel active ledger rows have not been recorded.
- Connect/Deploy/Auth/Data/Evidence: unchanged; no live provider work was attempted.

## Next Smallest Step

Run `m1:ledger:record -- --status active` with real preview Clerk, Convex, and Vercel external IDs, then continue with `m1:providers:link`, `m1:preview:deploy -- --confirm-live-mutation`, `m1:preview:smoke`, complete `runbook.md` with redacted facts, and run `m1:evidence:check`.
