# M1 Runbook Provider-Link Evidence Placement

Date: 2026-06-22

Actor: Codex

Milestone checkbox target: Evidence for M1 Preview E2E.

## Change

- The generated M1 runbook no longer lists `provider-links.txt` under the provider-plan step.
- The generated M1 runbook now lists `provider-links.txt` under `### 3. Link Local Provider State`, the step that actually runs `m1:providers:link` and writes the redacted Connect evidence.

## Red-Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates a B2B SaaS project with app tokens replaced"` failed because the provider-plan section contained `provider-links.txt`.
- GREEN: the same focused test passed after moving the evidence-file bullet to the provider-link step in both template copies.

## Verification

- `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 20 tests.
- `pnpm typecheck` passed.
- `pnpm test` passed with 28 test files and 555 tests.

## Checkbox Progress

- Generate: unchanged, still checked.
- Evidence: unchanged; the generated runbook is clearer, but live M1 evidence still requires real active ledger rows, provider links, PASS deploy evidence, PASS smoke evidence, and a completed redacted runbook.
- Ledger/Connect/Deploy/Auth/Data: unchanged.

## Next Smallest Step

Run `m1:ledger:record -- --status active` with real preview Clerk, Convex, and Vercel external IDs, then continue through provider linking, deploy, smoke, completed runbook, and `m1:evidence:check`.
