# M1 Provider-Link Stale Evidence Cleanup

Target checkbox: Connect

## Result

`m1:providers:link` now removes stale `docs/milestones/evidence/M1-preview-e2e/provider-links.txt` if an individual provider-link command fails after earlier local writes. The helper still restores the previous `.agentstack/provider-links.json` snapshot, and now the redacted Connect success evidence cannot remain from an older run after a failed partial relink.

M1 acceptance checkboxes are unchanged. Live Ledger, Connect, Deploy, Auth, Data, and Evidence still require real preview provider resources and credentials.

## Regression

Command:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 provider link restores local state on partial link failure"
```

Red result before implementation:

```text
FAIL packages/create-agent-stack/src/generate.test.ts > generateProject > generated M1 provider link restores local state on partial link failure
AssertionError: promise resolved provider-links.txt instead of rejecting
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

diff -q packages/create-agent-stack/templates/b2b-saas/scripts/m1-providers-link.mjs templates/b2b-saas/scripts/m1-providers-link.mjs
diff -q packages/create-agent-stack/templates/b2b-saas/docs/agentstack/preview.md templates/b2b-saas/docs/agentstack/preview.md
diff -q packages/create-agent-stack/templates/b2b-saas/docs/milestones/evidence/M1-preview-e2e/README.md templates/b2b-saas/docs/milestones/evidence/M1-preview-e2e/README.md
PASS
```
