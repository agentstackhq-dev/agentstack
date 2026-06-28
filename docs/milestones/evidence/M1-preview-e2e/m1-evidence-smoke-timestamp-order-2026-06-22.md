# M1 Evidence Smoke Timestamp Order — 2026-06-22

Milestone checkbox targeted: **Evidence / Auth / Data**

Status: local evidence-bundle hardening PASS; live Evidence, Auth, and Data remain unchanged because no real provider resources were created or mutated in this slice.

## Change

`m1:evidence:check` now rejects a bundle when `smoke-output.txt` has a `Checked at` timestamp older than `deploy-output.txt`. URL coherence alone is not enough for Auth/Data proof: smoke evidence must be captured after the deploy evidence it claims to validate.

The generated checker also rejects missing or invalid `Checked at` lines when both deploy and smoke evidence exist. Generated preview docs and evidence README now describe the timestamp-order rule.

## Red / Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 evidence check rejects smoke evidence older than deploy evidence"` passed a bundle where same-URL smoke evidence had an older `Checked at` timestamp than deploy evidence.
- GREEN: the same focused test passed after adding timestamp-order validation; the checker reports `smoke output checked timestamp is older than deploy output`.

## Verification

- PASS: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` — 24 tests passed.
- PASS: `pnpm typecheck`.
- PASS: `pnpm test` — 28 test files and 559 tests passed.
- PASS: `git diff --check`.
- PASS: package-template/root-template mirror checks for:
  - `scripts/m1-evidence-check.mjs`
  - `scripts/m1-preview-deploy.mjs`
  - `docs/agentstack/preview.md`
  - `docs/milestones/evidence/M1-preview-e2e/README.md`
  - `docs/milestones/evidence/M1-preview-e2e/runbook.md`

## Notes

No raw provider stdout, provider identifiers, tokens, secrets, cookies, session values, or DOM snapshots were stored. The evidence fixture uses synthetic preview URLs and synthetic timestamps.
