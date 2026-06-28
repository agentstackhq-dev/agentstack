# M1 Preview Deploy Smoke Invalidation — 2026-06-22

Milestone checkbox targeted: **Deploy / Auth / Data / Evidence**

Status: local helper hardening PASS; live Deploy, Auth, Data, and Evidence remain unchanged because no real provider resources were created or mutated in this slice.

## Change

Any `m1:preview:deploy` attempt that reaches provider execution now removes stale `smoke-output.txt`. A new deploy result invalidates prior Auth/Data smoke evidence, so `m1:preview:smoke` must be rerun against the current deploy URL before Auth/Data/Evidence can pass.

The generated helper removes stale smoke evidence after successful deploys, failed provider applies, and Vercel deploy URL extraction failures. Generated preview docs, evidence README, and runbook text now describe the rule.

## Red / Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts that execute from the generated project|generated M1 deploy helper writes redacted failure evidence after provider execution starts"` failed after seeding stale `smoke-output.txt`; the stale smoke evidence still existed after both a successful deploy and a fake Vercel failure.
- GREEN: the same focused test passed after adding stale smoke cleanup; prior smoke evidence was removed and deploy evidence remained redacted.

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

No raw provider stdout, provider identifiers, tokens, secrets, dashboard payloads, cookies, session values, or DOM snapshots were stored. The fake provider failure output used synthetic placeholder values only.
