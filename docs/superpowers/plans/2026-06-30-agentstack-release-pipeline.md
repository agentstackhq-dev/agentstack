# Agentstack Release Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a strict, automated GitHub/npm release path for the public Agentstack beta packages.

**Architecture:** A shared `scripts/release/contract.mjs` module owns package order, version rules, and release
assertions. Thin command wrappers run the local gate, bump versions, publish packages, and smoke the public registry.
GitHub Actions call those package-owned commands instead of duplicating release logic in YAML.

**Tech Stack:** Node ESM scripts, pnpm/corepack, npm Trusted publishing through GitHub Actions OIDC, Vitest contract
tests, GitHub Actions environments.

---

### Task 1: Release Contract Tests

**Files:**
- Create: `tests/release-pipeline.test.ts`

- [x] Add tests that require release scripts, CI workflow, release workflow, docs, and `node scripts/release/contract.mjs --check`.
- [x] Run `corepack pnpm vitest run tests/release-pipeline.test.ts`.
- [x] Confirm the test fails because the release pipeline does not exist yet.

### Task 2: Release Scripts

**Files:**
- Create: `scripts/release/contract.mjs`
- Create: `scripts/release/check.mjs`
- Create: `scripts/release/bump-version.mjs`
- Create: `scripts/release/publish.mjs`
- Create: `scripts/release/registry-smoke.mjs`
- Modify: `package.json`

- [x] Add the shared release contract for lockstep versions, exact internal deps, generated template versions, public bin shape, and current-surface legacy-scope scans.
- [x] Add package scripts: `release:check`, `release:bump`, `release:publish`, and `release:registry:smoke`.
- [x] Make `release:check` run build, contract, typecheck, tests, M5 tarball smoke, template mirror diff, `git diff --check`, and npm publish dry-runs.
- [x] Make `release:publish` require exactly one of `--dry-run` or `--publish` and enforce beta/stable dist-tag pairing.
- [x] Make `release:registry:smoke` isolate the pnpm dlx cache and verify the generated app from npm.

### Task 3: GitHub Workflows

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

- [x] Add CI workflow that installs with `corepack pnpm install --frozen-lockfile` and runs `corepack pnpm run release:check`.
- [x] Add manual release workflow with version/tag/dry-run inputs, `id-token: write`, `npm-production` environment, npm `^11.5.1`, release gate, publish step, and registry smoke.
- [x] Keep workflows tokenless; npm publishing relies on Trusted publishing rather than `NPM_TOKEN`.

### Task 4: Release Documentation

**Files:**
- Create: `docs/releases/versioning-and-release-workflow.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/validation-operating-model.md`

- [x] Document lockstep versioning, beta/stable tag rules, local commands, GitHub workflow operation, npm Trusted publishing setup, and failure policy.
- [x] Point agent-facing docs at the release workflow.

### Task 5: Verification

**Files:**
- No new files

- [ ] Run `corepack pnpm vitest run tests/release-pipeline.test.ts`.
- [ ] Run `corepack pnpm typecheck`.
- [ ] Run `corepack pnpm test`.
- [ ] Run `corepack pnpm run release:check`.
- [ ] Run targeted scans for legacy package scopes, unpublishable package deps, workflow token leaks, and stale version references.
