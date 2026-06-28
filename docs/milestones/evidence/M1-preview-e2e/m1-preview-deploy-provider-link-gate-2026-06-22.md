# M1 Preview Deploy Provider-Link Gate

Date: 2026-06-22

Actor: Codex

Milestone checkbox target: Connect/Deploy sequencing for M1 Preview E2E.

## Change

- `m1:preview:deploy` now refuses before provider execution unless active M1 ledger rows, `.agentstack/provider-links.json`, and `provider-links.txt` from a passing `m1:providers:link` run exist for Clerk, Convex, and Vercel preview.
- The refusal prints `FAIL m1 preview deploy.provider-links-required` and reports provider, local, ledger, and telemetry mutation as `none`.
- Generated preview docs, generated M1 milestone docs, generated runbook, generated evidence README, generated workflow docs, and generated Agentstack skill workflow guidance now describe the provider-link-gated deploy sequence.
- The deploy failure evidence test still reaches provider execution by running `m1:providers:link` first, then forcing the fake Vercel provider apply to fail.

## Red-Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` failed with the new test because `m1:preview:deploy` started provider execution and wrote `deploy-output.txt` when provider-link evidence was missing.
- GREEN: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 17 tests after the helper, test setup, and generated docs were updated.

## Verification

- `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 17 tests.
- `pnpm typecheck` passed.
- `pnpm test` passed with 28 test files and 552 tests.
- `git diff --check` passed.

## Checkbox Progress

- Generate: unchanged, still checked.
- Ledger: unchanged, still requires real preview Clerk, Convex, and Vercel active ledger rows.
- Connect: unchanged; local provider-link evidence is now required before Deploy can run, but no real provider links were created.
- Deploy: unchanged; deploy evidence is now gated by Connect evidence, but no live provider deploy was attempted.
- Auth/Data: unchanged.
- Evidence: unchanged; the evidence bundle still needs real active ledger rows, provider links, PASS deploy evidence, PASS smoke evidence, and runbook updates.

## Next Smallest Step

Run `m1:ledger:record -- --status active` with real preview Clerk, Convex, and Vercel external IDs, then continue with `m1:providers:link`, `m1:preview:deploy -- --confirm-live-mutation`, `m1:preview:smoke`, and `m1:evidence:check`.
