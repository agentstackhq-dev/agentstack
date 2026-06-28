# M1 Preview Smoke DOM Source Redaction — 2026-06-22

Milestone checkbox targeted: **Evidence / Auth / Data**

Status: local smoke-evidence hardening PASS; live Evidence, Auth, and Data remain unchanged because no real provider resources were created or mutated in this slice.

## Change

`m1:preview:smoke` now writes `DOM snapshot source: local temporary file (redacted)` instead of storing the operator-supplied `--dom-file` path in `smoke-output.txt`.

The helper still reads the provided local DOM snapshot, but the evidence artifact no longer exposes local absolute paths, workspace paths, or temporary file names.

## Red / Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates package scripts that execute from the generated project"` failed because generated `smoke-output.txt` contained the absolute `.agentstack/m1-preview-dom-failed.html` path.
- GREEN: the same focused test passed after replacing the DOM source field with the redacted marker and asserting the absolute path is absent in both failure and pass smoke evidence.

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

No raw DOM snapshots, provider identifiers, tokens, secrets, cookies, session values, or local filesystem paths were stored. The evidence fixture uses synthetic preview URLs and synthetic DOM marker content.
