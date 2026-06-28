# M2 Lean Contract Correction Evidence

Date: 2026-06-28

## Result

Result: PASS for the M2 lean generated-surface correction.

Live M2 preview provider execution was not started. This evidence covers the corrected generated app contract and local package/schema validation only.

## Verified Changes

- The creation implementation now generates `agentstack.config.ts` instead of `agentstack.config.json`, surfaced to consumers through `agentstack create <app-name>`.
- Generated root app surface no longer contains copied `docs/`, `scripts/`, `skills/`, root `convex/`, root `vercel.json`, root `packages/`, provider ledger source files, or copied M1 runbooks.
- Generated root `package.json` depends on `agentstack` and package scripts call the installed `agentstack` CLI.
- `agentstack.config.ts` imports `defineAgentstackConfig` from `agentstack/config`.
- Added the public `agentstack` package wrapper with `agentstack` bin, `agentstack create <app-name>`, top-level help that advertises creation, and `agentstack/config` export.
- Source e2e now invokes the public `agentstack` bin, creates the app through `agentstack create`, links the local package as a consumer dependency, and runs generated app package scripts for validation and preview deploy rehearsal.
- The M2 consumer e2e no longer imports `generateProject`, `runAgentstack`, provider helpers, or telemetry helpers as its success path.

## Verification

```text
pnpm vitest run packages/core/src/validation.test.ts packages/create-agent-stack/src/generate.test.ts tests/e2e/prototype.test.ts
PASS: 3 files, 14 tests

pnpm vitest run packages/cli/src/run.test.ts
PASS: 1 file, 249 tests

pnpm test
PASS: 28 files, 538 tests

pnpm typecheck
PASS

git diff --check
PASS

diff -rq templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
PASS
```

## Remaining M2 Work

- Agree the package-owned live provider/auth/evidence approach before starting M2.
- Move the old generated M1 bootstrap/link/deploy/auth/smoke/evidence behavior into package-owned CLI commands.
- Prove the live preview path from the lean generated app using Clerk, Convex, and Vercel.
