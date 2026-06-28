# M1 Evidence Top-Level Result Gate — 2026-06-22

Milestone checkbox targeted: **Evidence**

Status: local evidence-bundle hardening PASS; live Evidence remains unchanged because no real provider resources were created or mutated in this slice.

## Change

`m1:evidence:check` now requires provider-link, deploy, and smoke evidence files to have a top-level `Result: PASS` line. It no longer accepts a failed evidence file merely because the text `Result: PASS` appears later in a reason or note.

The generated checker uses an anchored `Result:` line parser for these artifacts, and generated preview/evidence docs now describe the top-level result requirement.

## Red / Green Evidence

- RED: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 evidence check requires top-level PASS result lines"` failed because `m1:evidence:check` accepted `smoke-output.txt` with top-level `Result: FAIL` and a later reason containing `Result: PASS`.
- GREEN: the same focused test passed after adding strict top-level result parsing; the checker reports `smoke output top-level result is not PASS`.

## Verification

- PASS: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` — 25 tests passed.
- PASS: `pnpm typecheck`.
- PASS: `pnpm test` — 28 test files and 560 tests passed.
- PASS: `git diff --check`.
- PASS: package-template/root-template mirror checks for:
  - `scripts/m1-evidence-check.mjs`
  - `docs/agentstack/preview.md`
  - `docs/milestones/evidence/M1-preview-e2e/README.md`

## Notes

No provider resources were created, linked, adopted, inspected, or mutated. The evidence fixture uses synthetic preview URLs and synthetic evidence text.
