# M1 Evidence Provider-Link State Gate

Date: 2026-06-22

Actor: Codex

Milestone checkbox target: Connect/Evidence guard for M1 Preview E2E.

## Change

- `m1:evidence:check` now requires `.agentstack/provider-links.json` from `m1:providers:link` alongside the redacted `provider-links.txt` evidence file.
- The checker validates active Clerk, Convex, and Vercel preview link state by service, environment, resource type, name, and `ledgerStatus`.
- Generated preview docs, generated evidence README, and generated runbook now state that Evidence review includes both the redacted Connect artifact and the local provider-link state required by Deploy.
- The generated test fixture now writes a minimal secret-free provider-link state file when it needs a passing M1 evidence bundle.

## Red-Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` failed with the new test because `m1:evidence:check` passed with `provider-links.txt` but no `.agentstack/provider-links.json`.
- GREEN: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 19 tests after the evidence checker, fixture, and generated docs were updated.

## Verification

- `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 19 tests.
- `pnpm typecheck` passed.
- `pnpm test` passed with 28 test files and 554 tests.
- `git diff --check` passed.

## Checkbox Progress

- Generate: unchanged, still checked.
- Ledger: unchanged, still requires real preview Clerk, Convex, and Vercel active ledger rows.
- Connect: unchanged; the checker is stricter, but no real provider links were created.
- Deploy: unchanged.
- Auth/Data: unchanged.
- Evidence: unchanged; the checker now requires local provider-link state, but real active ledger rows, provider links, deploy evidence, smoke evidence, URL coherence, and runbook updates are still required.

## Next Smallest Step

Run `m1:ledger:record -- --status active` with real preview Clerk, Convex, and Vercel external IDs, then continue with `m1:providers:link`, `m1:preview:deploy -- --confirm-live-mutation`, `m1:preview:smoke`, and `m1:evidence:check`.
