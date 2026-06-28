# M1 Evidence URL Coherence Gate

Date: 2026-06-22

Actor: Codex

Milestone checkbox target: Evidence guard for M1 Preview E2E.

## Change

- `m1:evidence:check` now normalizes and compares the preview URL in `deploy-url.txt`, `deploy-output.txt`, and `smoke-output.txt`.
- The checker rejects bundles where deploy evidence and smoke evidence name different preview URLs.
- The checker now requires `smoke-output.txt` to include a `Deploy URL:` line, matching the output written by `m1:preview:smoke`.
- Generated preview docs, generated evidence README, and generated runbook now state that the local evidence bundle must keep those three URL references coherent.

## Red-Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` failed with the new test because `m1:evidence:check` passed even when `smoke-output.txt` pointed at a different Vercel URL.
- GREEN: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 18 tests after the evidence checker, fixture, and generated docs were updated.

## Verification

- `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 18 tests.
- `pnpm typecheck` passed.
- `pnpm test` passed with 28 test files and 553 tests.
- `git diff --check` passed.

## Checkbox Progress

- Generate: unchanged, still checked.
- Ledger: unchanged, still requires real preview Clerk, Convex, and Vercel active ledger rows.
- Connect: unchanged.
- Deploy: unchanged.
- Auth/Data: unchanged; smoke evidence must now refer to the same deployed URL as deploy evidence before Evidence can pass.
- Evidence: unchanged; the checker is stricter, but real active ledger rows, provider links, deploy evidence, smoke evidence, and runbook updates are still required.

## Next Smallest Step

Run `m1:ledger:record -- --status active` with real preview Clerk, Convex, and Vercel external IDs, then continue with `m1:providers:link`, `m1:preview:deploy -- --confirm-live-mutation`, `m1:preview:smoke`, and `m1:evidence:check`.
