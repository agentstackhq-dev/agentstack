# Agentstack M1 Clerk Auth Fixture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the M1 Clerk sign-in smoke repeatable by generating a ledgered Clerk smoke-user lifecycle helper for preview environments.

**Architecture:** Add a generated `m1:auth:user` helper that manages a single M1 smoke user through Clerk's API surface, records the user in the provider ledger, writes redacted evidence, and stores any local credentials only under `.agentstack/`. Keep the helper separate from `m1:providers:bootstrap` so provider infrastructure and auth fixtures can be rerun independently.

**Tech Stack:** Node ESM scripts, generated B2B SaaS template, Clerk CLI `api` command, existing generated ledger/evidence helpers, Vitest generator tests.

---

### Task 1: Generate Auth Fixture Script And Package Surface

**Files:**
- Modify: `packages/create-agent-stack/src/generate.test.ts`
- Create: `templates/b2b-saas/scripts/m1-auth-user.mjs`
- Create: `packages/create-agent-stack/templates/b2b-saas/scripts/m1-auth-user.mjs`
- Modify: `templates/b2b-saas/package.json`
- Modify: `packages/create-agent-stack/templates/b2b-saas/package.json`

- [ ] **Step 1: Write the failing generator test**

Add a generator test that creates a project, asserts `package.json` includes `m1:auth:user`, runs `pnpm run m1:auth:user -- ensure --confirm-live-mutation --created-by Codex`, and expects:

```text
PASS m1 auth user ensure
Provider mutation: clerk user create/update
Ledger mutation: docs/provider-resource-ledger.md
Local mutation: .agentstack/m1-auth-user.json
```

Also assert `docs/provider-resource-ledger.md` contains an active `clerk | user | preview` row and evidence contains no password, OTP, token, or session material.

- [ ] **Step 2: Verify RED**

Run:

```bash
PATH=<node-bin>:$PATH pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 auth user helper"
```

Expected: fail because `m1:auth:user` and `scripts/m1-auth-user.mjs` do not exist.

- [ ] **Step 3: Implement minimal generated helper**

Create `scripts/m1-auth-user.mjs` in both template mirrors. It must support:

```bash
pnpm run m1:auth:user -- ensure --confirm-live-mutation --created-by <name>
pnpm run m1:auth:user -- update --confirm-live-mutation --created-by <name>
pnpm run m1:auth:user -- delete --confirm-live-mutation --created-by <name>
```

`ensure` creates or reuses one deterministic `__APP_SLUG__+m1-smoke+clerk_test@example.com` test user, rotates a generated password locally, applies `bypass_client_trust: true` where accepted, records an active ledger row, writes `.agentstack/m1-auth-user.json`, and writes `docs/milestones/evidence/M1-preview-e2e/clerk-smoke-user.txt`.

`update` requires the local auth-user state, rotates password/client-trust metadata, refreshes the active ledger row, and rewrites redacted evidence.

`delete` requires the local auth-user state, deletes only that user id, marks the ledger row `cleaned`, removes local credential state, and writes cleaned evidence.

- [ ] **Step 4: Verify GREEN**

Run the targeted Vitest command above. Expected: pass.

### Task 2: Require Auth Fixture In M1 Evidence

**Files:**
- Modify: `packages/create-agent-stack/src/generate.test.ts`
- Modify: `templates/b2b-saas/scripts/m1-evidence-check.mjs`
- Modify: `packages/create-agent-stack/templates/b2b-saas/scripts/m1-evidence-check.mjs`
- Modify: generated M1 docs in both mirrors

- [ ] **Step 1: Write failing evidence-check tests**

Extend generator tests so `m1:evidence:check` fails when `clerk-smoke-user.txt` is missing or the Clerk smoke-user ledger row is not active/cleaned, and passes after `m1:auth:user -- ensure` plus the existing deploy/smoke/runbook bundle.

- [ ] **Step 2: Verify RED**

Run the targeted Vitest command. Expected: fail on the new evidence-check assertions.

- [ ] **Step 3: Implement evidence check and docs**

Teach `m1-evidence-check.mjs` to require `clerk-smoke-user.txt` and a `clerk | user | preview` ledger row with status `active` or `cleaned`. Update generated M1 docs/runbook to include the auth fixture step before browser sign-in.

- [ ] **Step 4: Verify GREEN**

Run the targeted Vitest command. Expected: pass.

### Task 3: Verification And Commit

**Files:**
- All changed M1 template/generator/docs files.

- [ ] **Step 1: Check template mirror parity**

Run:

```bash
diff -rq templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

Expected: no output.

- [ ] **Step 2: Run focused generator tests**

Run:

```bash
PATH=<node-bin>:$PATH pnpm vitest run packages/create-agent-stack/src/generate.test.ts
```

Expected: all generator tests pass.

- [ ] **Step 3: Run full verification**

Run:

```bash
PATH=<node-bin>:$PATH pnpm typecheck
PATH=<node-bin>:$PATH pnpm test
git diff --check
```

Expected: all pass.

- [ ] **Step 4: Commit**

Commit with:

```bash
git commit -m "Add M1 Clerk auth fixture lifecycle"
```
