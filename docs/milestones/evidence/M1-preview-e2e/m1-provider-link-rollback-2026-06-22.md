# M1 Provider-Link Rollback

Date: 2026-06-22

Actor: Codex

Milestone checkbox target: Connect/Evidence sequencing for M1 Preview E2E.

## Change

- `m1:providers:link` now snapshots `.agentstack/provider-links.json` before invoking the three ledger-gated local `provider link` commands.
- If any individual link command fails after an earlier command wrote local provider-link state, the helper restores the previous `.agentstack/provider-links.json` content, or removes the file when no prior state existed.
- Failed runs still write no `provider-links.txt` success evidence.
- Generated preview docs, generated evidence README, and generated Agentstack skill workflow guidance now describe the rollback contract.

## Red-Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 provider link restores local state on partial link failure"` failed because a simulated Clerk link wrote `.agentstack/provider-links.json`, the simulated Convex link failed, and the partial Clerk-only state remained.
- GREEN: the same focused regression passed after adding rollback behavior to both template copies.

## Verification

- `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed with 20 tests.
- `pnpm typecheck` passed.
- `pnpm test` passed with 28 test files and 555 tests.
- `git diff --check` passed.
- Template mirror checks passed for `scripts/m1-providers-link.mjs`, `docs/agentstack/preview.md`, `docs/milestones/evidence/M1-preview-e2e/README.md`, and `skills/agentstack/references/workflows.md`.

## Checkbox Progress

- Generate: unchanged, still checked.
- Ledger: unchanged, still requires real preview Clerk, Convex, and Vercel active ledger rows.
- Connect: unchanged; local partial-link failure behavior is safer, but no real provider links were created.
- Deploy: unchanged; no live provider deploy was attempted.
- Auth/Data: unchanged.
- Evidence: unchanged; the final bundle still requires real active ledger rows, provider links, PASS deploy evidence, PASS smoke evidence, and runbook updates.

## Next Smallest Step

Run `m1:ledger:record -- --status active` with real preview Clerk, Convex, and Vercel external IDs, then continue with `m1:providers:link`, `m1:preview:deploy -- --confirm-live-mutation`, `m1:preview:smoke`, and `m1:evidence:check`.
