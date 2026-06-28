# M1 Evidence Runbook Final Checkbox Presence Gate

Target checkbox: Evidence

## Result

`m1:evidence:check` now requires all six final M1 checkbox review lines to be present in `runbook.md`: Ledger, Connect, Deploy, Auth, Data, and Evidence. The checker already rejected `fail` or `unchanged` values; it now also rejects a deleted final review line.

M1 acceptance checkboxes are unchanged. Live Ledger, Connect, Deploy, Auth, Data, and Evidence still require real preview provider resources and credentials.

## Regression

Command:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 evidence check requires all final runbook checkboxes"
```

Red result before implementation:

```text
FAIL packages/create-agent-stack/src/generate.test.ts > generateProject > generated M1 evidence check requires all final runbook checkboxes
AssertionError: promise resolved ... instead of rejecting
stdout: PASS m1 evidence check
```

Green result after implementation:

```text
PASS packages/create-agent-stack/src/generate.test.ts
Test Files 1 passed
Tests 1 passed | 27 skipped
```

## Follow-up

Completed verification:

```text
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
PASS 1 test file, 28 tests

pnpm typecheck
PASS

pnpm test
PASS 28 test files, 563 tests

git diff --check
PASS

diff -q packages/create-agent-stack/templates/b2b-saas/scripts/m1-evidence-check.mjs templates/b2b-saas/scripts/m1-evidence-check.mjs
diff -q packages/create-agent-stack/templates/b2b-saas/docs/agentstack/preview.md templates/b2b-saas/docs/agentstack/preview.md
diff -q packages/create-agent-stack/templates/b2b-saas/docs/milestones/evidence/M1-preview-e2e/README.md templates/b2b-saas/docs/milestones/evidence/M1-preview-e2e/README.md
PASS
```
