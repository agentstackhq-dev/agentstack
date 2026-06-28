# M1 Preview Smoke Top-Level Deploy Result Gate

Target checkbox: Evidence

## Result

`m1:preview:smoke` now requires `deploy-output.txt` to have a top-level `Result: PASS` line before it reads the supplied DOM snapshot or writes `smoke-output.txt`. A failed deploy evidence file that only mentions `Result: PASS` later in a reason/note is rejected as deploy evidence, so synthetic Auth/Data smoke evidence cannot overwrite the blocker.

M1 acceptance checkboxes are unchanged. Live Ledger, Connect, Deploy, Auth, Data, and Evidence still require real preview provider resources and credentials.

## Regression

Command:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 smoke helper requires top-level PASS deploy evidence before recording smoke"
```

Red result before implementation:

```text
FAIL packages/create-agent-stack/src/generate.test.ts > generateProject > generated M1 smoke helper requires top-level PASS deploy evidence before recording smoke
AssertionError: promise resolved ... instead of rejecting
stdout: PASS m1 preview smoke
```

Green result after implementation:

```text
PASS packages/create-agent-stack/src/generate.test.ts
Test Files 1 passed
Tests 1 passed | 25 skipped
```

## Follow-up

Completed verification:

```text
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
PASS 1 test file, 26 tests

pnpm typecheck
PASS

pnpm test
PASS 28 test files, 561 tests

git diff --check
PASS

diff -q packages/create-agent-stack/templates/b2b-saas/scripts/m1-preview-smoke.mjs templates/b2b-saas/scripts/m1-preview-smoke.mjs
diff -q packages/create-agent-stack/templates/b2b-saas/docs/agentstack/preview.md templates/b2b-saas/docs/agentstack/preview.md
diff -q packages/create-agent-stack/templates/b2b-saas/docs/milestones/evidence/M1-preview-e2e/README.md templates/b2b-saas/docs/milestones/evidence/M1-preview-e2e/README.md
PASS
```
