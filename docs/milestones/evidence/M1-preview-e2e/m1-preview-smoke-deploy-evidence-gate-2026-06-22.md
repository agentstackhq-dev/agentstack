# M1 Preview Smoke Deploy Evidence Gate

Date: 2026-06-22

Actor: Codex

Milestone checkbox target: Auth/Data/Evidence guard for M1 Preview E2E.

## Change

- `m1:preview:smoke` now refuses before reading a DOM snapshot or writing local smoke evidence unless `deploy-url.txt` and `deploy-output.txt` exist from a passing `m1:preview:deploy` run and match the `--url` value after URL normalization.
- The refusal prints `FAIL m1 preview smoke.deploy-evidence-required` with provider, local, ledger, and telemetry mutation all reported as `none`.
- Generated preview docs, generated M1 milestone docs, generated runbook, generated evidence README, generated workflow docs, and generated Agentstack skill workflow guidance now describe the same deploy-before-smoke boundary.

## Red-Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` failed with the new test because `m1:preview:smoke` passed and wrote smoke evidence without deploy evidence.
- GREEN: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 16 tests after the helper and generated docs were updated.

## Verification

- `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 16 tests.
- `pnpm typecheck` passed.
- `pnpm test` passed with 28 test files and 552 tests.
- `git diff --check` passed.

## Checkbox Progress

- Generate: unchanged, still checked.
- Ledger: unchanged, still requires real preview Clerk, Convex, and Vercel active ledger rows.
- Connect: unchanged.
- Deploy: unchanged.
- Auth/Data: unchanged; smoke evidence is now gated so local or synthetic DOM snapshots cannot advance these without matching PASS deploy evidence.
- Evidence: unchanged; the bundle checker still requires real active ledger rows and PASS deploy/smoke evidence.

## Next Smallest Step

Run `m1:ledger:record -- --status active` with real preview Clerk, Convex, and Vercel external IDs, then continue with `m1:providers:link`, `m1:preview:deploy -- --confirm-live-mutation`, `m1:preview:smoke`, and `m1:evidence:check`.
