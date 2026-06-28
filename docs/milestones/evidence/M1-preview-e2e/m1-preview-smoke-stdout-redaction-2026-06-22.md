# M1 Preview Smoke Stdout Redaction — 2026-06-22

Milestone checkbox targeted: **Evidence / Auth / Data**

Status: local smoke-helper output hardening PASS; live Evidence, Auth, and Data remain unchanged because no real provider resources were created or mutated in this slice.

## Change

`m1:preview:smoke` now prints relative `Local mutation:` lines for `deploy-url.txt` and `smoke-output.txt` instead of absolute `Wrote:` paths.

This keeps helper-owned terminal output safe to summarize in the runbook without exposing the generated app's temporary filesystem location. Package-manager command echoes may still include local cwd or arguments; the helper output itself now follows the same relative mutation-summary style as the other M1 helpers.

## Red / Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts that execute from the generated project"` failed because generated `m1:preview:smoke` stdout lacked relative `Local mutation:` lines and printed absolute `Wrote:` paths.
- GREEN: the same focused test passed after replacing helper-owned `Wrote:` output with relative mutation summaries.

## Verification

- PASS: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` — 24 tests passed.
- PASS: `pnpm typecheck`.
- PASS: `pnpm test` — 28 test files and 559 tests passed.
- PASS: `git diff --check`.
- PASS: package-template/root-template mirror checks for:
  - `scripts/m1-preview-smoke.mjs`
  - `docs/agentstack/preview.md`
  - `docs/milestones/evidence/M1-preview-e2e/README.md`

## Notes

No raw DOM snapshots, provider identifiers, tokens, secrets, cookies, session values, or helper-owned absolute output paths were stored. The evidence fixture uses synthetic preview URLs and synthetic DOM marker content.
