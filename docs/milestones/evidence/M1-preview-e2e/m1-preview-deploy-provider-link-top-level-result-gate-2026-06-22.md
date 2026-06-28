# M1 Preview Deploy Provider-Link Top-Level Result Gate

Target checkbox: Deploy

## Result

`m1:preview:deploy` now requires `provider-links.txt` to have a top-level `Result: PASS` line before it invokes Convex or Vercel provider apply. A failed provider-link evidence file that only mentions `Result: PASS` later in a reason/note is rejected during preflight and writes no deploy evidence.

M1 acceptance checkboxes are unchanged. Live Ledger, Connect, Deploy, Auth, Data, and Evidence still require real preview provider resources and credentials.

## Regression

Command:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 deploy helper requires top-level PASS provider-link evidence before provider execution"
```

Red result before implementation:

```text
FAIL packages/create-agent-stack/src/generate.test.ts > generateProject > generated M1 deploy helper requires top-level PASS provider-link evidence before provider execution
stdout: FAIL m1 preview deploy
Failed stage: convex preview apply
Local mutation: docs/milestones/evidence/M1-preview-e2e/deploy-output.txt
```

Green result after implementation:

```text
PASS packages/create-agent-stack/src/generate.test.ts
Test Files 1 passed
Tests 1 passed | 26 skipped
```

## Follow-up

Completed verification:

```text
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
PASS 1 test file, 27 tests

pnpm typecheck
PASS

pnpm test
PASS 28 test files, 562 tests

git diff --check
PASS

diff -q packages/create-agent-stack/templates/b2b-saas/scripts/m1-preview-deploy.mjs templates/b2b-saas/scripts/m1-preview-deploy.mjs
diff -q packages/create-agent-stack/templates/b2b-saas/docs/agentstack/preview.md templates/b2b-saas/docs/agentstack/preview.md
diff -q packages/create-agent-stack/templates/b2b-saas/docs/milestones/evidence/M1-preview-e2e/README.md templates/b2b-saas/docs/milestones/evidence/M1-preview-e2e/README.md
PASS
```
