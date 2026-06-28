# M1 Preview Deploy Stale URL Cleanup — 2026-06-22

Milestone checkbox targeted: **Deploy / Evidence**

Status: local helper hardening PASS; live Deploy remains unchanged because no real provider resources were created or mutated in this slice.

## Change

Failed `m1:preview:deploy` attempts that reach provider execution now remove stale `deploy-url.txt` before writing redacted `deploy-output.txt` failure evidence. This prevents a previous successful preview URL from surviving beside a newer failed deploy blocker.

The generated helper removes stale URL evidence for both provider apply failures and Vercel deploy URL extraction failures. Generated preview docs, evidence README, and runbook text now describe the behavior.

## Red / Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 deploy helper writes redacted failure evidence after provider execution starts"` failed after seeding stale `deploy-url.txt`; the stale URL file still existed after the fake Vercel failure.
- GREEN: the same focused test passed after adding stale URL cleanup; `deploy-output.txt` retained the redacted `Result: FAIL` blocker and `deploy-url.txt` was removed.

## Verification

- PASS: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` — 23 tests passed.
- PASS: `pnpm typecheck`.
- PASS: `pnpm test` — 28 test files and 558 tests passed.
- PASS: `git diff --check`.
- PASS: package-template/root-template mirror checks for:
  - `scripts/m1-preview-deploy.mjs`
  - `docs/agentstack/preview.md`
  - `docs/milestones/evidence/M1-preview-e2e/README.md`
  - `docs/milestones/evidence/M1-preview-e2e/runbook.md`

## Notes

No raw provider stdout, provider identifiers, tokens, secrets, dashboard payloads, or DOM snapshots were stored. The fake failure output used synthetic placeholder values only.
