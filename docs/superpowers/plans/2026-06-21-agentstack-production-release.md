# Agentstack Production Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a local production release lifecycle that proves `prod prepare`, `validate --release prod`, `prod provision`, and guarded production deploy behavior without calling real providers.

**Architecture:** Core owns release-policy diagnostics that are independent of provider state. The local-cloud adapter continues to own environment inspection, sync, and deployment artifacts, with production deploy apply requiring explicit confirmation. The CLI composes local validation, release-policy validation, cloud validation, prod planning/provisioning, production deploy planning/apply, command telemetry, generated package scripts, docs, e2e coverage, and spin-up pages.

**Tech Stack:** TypeScript, Vitest, existing Agentstack core/CLI/adapters packages, deterministic B2B SaaS templates, local JSON artifacts, static spin-up HTML.

---

## File Structure

- Create `packages/core/src/release.ts` for release environment aliases and release-policy diagnostics.
- Add `packages/core/src/release.test.ts` for production-ready defaults and failing policy cases.
- Modify `packages/core/src/index.ts` to export release helpers.
- Modify `packages/adapters/src/types.ts`, `packages/adapters/src/local-cloud.ts`, and `packages/adapters/src/local-cloud.test.ts` for confirmed production deploy apply.
- Modify `packages/cli/src/run.ts` and `packages/cli/src/run.test.ts` for `validate --release`, `prod prepare`, `prod provision`, and production deploy.
- Modify `tests/e2e/prototype.test.ts` to exercise the production release path after preview rehearsal.
- Modify `templates/b2b-saas/package.json`, mirrored package template, and generated docs under `docs/agentstack/`.
- Modify `README.md` and `docs/spinup-site/` to explain the release lifecycle.

## Task 1: Core Release Policy

**Files:**
- Create: `packages/core/src/release.ts`
- Create: `packages/core/src/release.test.ts`
- Modify: `packages/core/src/index.ts`

- [x] **Step 1: Write failing core tests**

```ts
import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import { normalizeReleaseEnvironment, validateReleasePolicy } from "./release.js";

describe("release policy", () => {
  it("accepts prod as a production release alias", () => {
    expect(normalizeReleaseEnvironment("prod")).toBe("production");
    expect(normalizeReleaseEnvironment("production")).toBe("production");
    expect(normalizeReleaseEnvironment("preview")).toBe("preview");
  });

  it("passes release policy for the default production-capable manifest", () => {
    expect(validateReleasePolicy(createDefaultManifest("acme-crm"), "production")).toEqual([]);
  });

  it("rejects development as a release environment", () => {
    expect(validateReleasePolicy(createDefaultManifest("acme-crm"), "development")).toEqual([
      expect.objectContaining({
        severity: "fail",
        code: "release.environment.unsupported",
        path: "development"
      })
    ]);
  });

  it("requires production telemetry policy and production service participation", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.telemetry.environments.production.required = false;
    manifest.services.vercel.requiredEnvironments = ["preview"];

    expect(validateReleasePolicy(manifest, "production")).toEqual([
      expect.objectContaining({ code: "release.telemetry.production-required" }),
      expect.objectContaining({ code: "release.service.production-missing", path: "production.vercel" })
    ]);
  });
});
```

- [x] **Step 2: Verify red**

Run: `pnpm exec vitest run packages/core/src/release.test.ts`

Expected: fail because `release.ts` does not exist.

- [x] **Step 3: Implement release helpers**

```ts
import type { Diagnostic } from "./diagnostics.js";
import type { AgentstackManifest, EnvironmentName, ServiceName } from "./manifest.js";

export type ReleaseEnvironment = "preview" | "production";
export type ReleaseEnvironmentAlias = ReleaseEnvironment | "prod";

export function normalizeReleaseEnvironment(value: string): ReleaseEnvironment | undefined {
  if (value === "prod" || value === "production") return "production";
  if (value === "preview") return "preview";
  return undefined;
}

export function validateReleasePolicy(
  manifest: AgentstackManifest,
  environment: EnvironmentName
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  if (environment === "development") {
    diagnostics.push({
      severity: "fail",
      code: "release.environment.unsupported",
      path: environment,
      message: "Release validation supports preview and production only.",
      fix: "Run agentstack validate --release prod.",
      blocks: ["validate --release", "deploy"]
    });
    return diagnostics;
  }

  const requiredServices = releaseRequiredServices(manifest, environment);
  for (const service of requiredServices) {
    const config = manifest.services[service];
    if (!config.enabled || !config.requiredEnvironments.includes(environment)) {
      diagnostics.push({
        severity: "fail",
        code: "release.service.production-missing",
        path: `${environment}.${service}`,
        message: `${service} must be enabled and required for ${environment} releases.`,
        fix: `Enable services.${service} for ${environment} in agentstack.config.json.`,
        blocks: ["validate --release", "deploy"]
      });
    }
  }

  const telemetryPolicy = manifest.telemetry.environments[environment];
  if (!telemetryPolicy.required) {
    diagnostics.push({
      severity: "fail",
      code: `release.telemetry.${environment}-required`,
      path: `telemetry.environments.${environment}.required`,
      message: `${environment} release validation requires telemetry to be required for that environment.`,
      fix: `Set telemetry.environments.${environment}.required to true.`,
      blocks: ["validate --release", "deploy"]
    });
  }

  if (!manifest.telemetry.redaction.forbidRawSecrets) {
    diagnostics.push({
      severity: "fail",
      code: "release.telemetry.redaction-disabled",
      path: "telemetry.redaction.forbidRawSecrets",
      message: "Release validation requires raw-secret redaction to be enabled.",
      fix: "Set telemetry.redaction.forbidRawSecrets to true.",
      blocks: ["validate --release", "deploy"]
    });
  }

  return diagnostics;
}

function releaseRequiredServices(
  manifest: AgentstackManifest,
  environment: ReleaseEnvironment
): ServiceName[] {
  const services: ServiceName[] = ["clerk", "convex"];
  if (manifest.surfaces.includes("web")) services.push("vercel");
  if (manifest.surfaces.includes("mobile")) services.push("eas");
  return services;
}
```

- [x] **Step 4: Export and verify**

Add `export * from "./release.js";` to `packages/core/src/index.ts`.

Run: `pnpm exec vitest run packages/core/src/release.test.ts`

Expected: release tests pass.

## Task 2: Adapter Production Deploy Confirmation

**Files:**
- Modify: `packages/adapters/src/types.ts`
- Modify: `packages/adapters/src/local-cloud.ts`
- Modify: `packages/adapters/src/local-cloud.test.ts`

- [x] **Step 1: Write failing adapter tests**

Add tests proving:

```ts
await adapter.sync(manifest, "production", { apply: true });
await expect(adapter.deploy(manifest, "production", { apply: true })).rejects.toThrow(
  "Production local-cloud mutations require explicit confirmation."
);
await expect(
  adapter.deploy(manifest, "production", { apply: true, confirmProduction: true })
).resolves.toMatchObject({
  environment: "production",
  applied: true,
  artifactPath: ".agentstack/deployments/production.json"
});
```

- [x] **Step 2: Verify red**

Run: `pnpm exec vitest run packages/adapters/src/local-cloud.test.ts`

Expected: fail because `DeployOptions` does not accept or pass `confirmProduction`.

- [x] **Step 3: Implement options passthrough**

Add `confirmProduction?: boolean` to `DeployOptions` and pass it into `this.apply(lifecyclePlan, { confirmProduction: options.confirmProduction })` inside `LocalCloudAdapter.deploy`.

- [x] **Step 4: Verify adapter tests**

Run: `pnpm exec vitest run packages/adapters/src/local-cloud.test.ts`

Expected: adapter tests pass.

## Task 3: CLI Release Commands

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [x] **Step 1: Write failing CLI tests**

Add tests for:

```ts
expect(await runAgentstack(["validate", "--release", "prod"], { cwd: dir, write })).toBe(1);
expect(output.join("\n")).toContain("FAIL cloud.service.missing");

await runAgentstack(["prod", "provision", "--apply"], { cwd: dir, write: () => undefined });
expect(await runAgentstack(["validate", "--release", "prod"], { cwd: dir, write })).toBe(0);
expect(output).toContain("PASS validate --release production");

expect(await runAgentstack(["prod", "prepare"], { cwd: dir, write })).toBe(0);
expect(output.join("\n")).toContain("PASS prod prepare production");

expect(await runAgentstack(["prod", "provision"], { cwd: dir, write })).toBe(0);
expect(output.join("\n")).toContain("PLAN prod provision production");

expect(await runAgentstack(["deploy", "--env", "production"], { cwd: dir, write })).toBe(0);
expect(output.join("\n")).toContain("PLAN deploy production");

expect(await runAgentstack(["deploy", "--env", "production", "--apply"], { cwd: dir, write })).toBe(1);
expect(output.join("\n")).toContain("FAIL deploy.production-confirmation.required");

expect(await runAgentstack(["deploy", "--env", "production", "--apply", "--confirm-production"], { cwd: dir, write })).toBe(0);
expect(output.join("\n")).toContain("APPLIED deploy production");
```

Update the existing “rejects non-preview deploy environments” test to expect the new guarded production behavior.

- [x] **Step 2: Verify red**

Run: `pnpm exec vitest run packages/cli/src/run.test.ts`

Expected: fail because the commands do not exist or production deploy is unsupported.

- [x] **Step 3: Implement CLI behavior**

Import `normalizeReleaseEnvironment` and `validateReleasePolicy`.

Add route:

```ts
if (command === "prod") return await prodCommand([subcommand, ...rest].filter(Boolean), io);
```

Add `--release` handling before `--cloud` in `validateCommand`: run local validation, release policy, and cloud validation for the release environment. Print `PASS validate --release production` when all pass and record `agentstack.validate.completed`.

Add `prod prepare`: run the release gate for production, print `PASS/FAIL prod prepare production`, diagnostics, and next commands.

Add `prod provision`: run production sync plan/apply, print `PLAN/APPLIED prod provision production`, and record `agentstack.prod.provision.completed`.

Allow production in `deployCommand`. Production apply requires `--confirm-production`; both production plan and apply must pass release validation first. Pass `confirmProduction` to the adapter deploy call and record `agentstack.deploy.completed`.

- [x] **Step 4: Verify CLI tests**

Run: `pnpm exec vitest run packages/cli/src/run.test.ts`

Expected: CLI tests pass.

## Task 4: Generated Scripts, Docs, E2E, And Spin-Up

**Files:**
- Modify: `templates/b2b-saas/package.json`
- Modify: `packages/create-agent-stack/templates/b2b-saas/package.json`
- Modify: `templates/b2b-saas/docs/agentstack/release.md`
- Modify: mirrored release docs
- Modify: `packages/create-agent-stack/src/generate.test.ts`
- Modify: `tests/e2e/prototype.test.ts`
- Modify: `README.md`
- Modify: `docs/spinup-site/workflows.html`, `generated-app.html`, `guardrails.html`, `timeline.html`, `assets/site.js`

- [x] **Step 1: Write failing generator/e2e expectations**

Add package script expectations:

```ts
"prod:prepare": "node scripts/agentstack.mjs prod prepare",
"prod:provision": "node scripts/agentstack.mjs prod provision",
"prod:provision:apply": "node scripts/agentstack.mjs prod provision --apply",
"prod:validate": "node scripts/agentstack.mjs validate --release prod",
"prod:deploy": "node scripts/agentstack.mjs deploy --env production",
"prod:deploy:apply": "node scripts/agentstack.mjs deploy --env production --apply --confirm-production"
```

Extend e2e after preview deploy/mobile rehearsal:

```ts
expect(await runAgentstack(["prod", "prepare"], { cwd: appDir, write })).toBe(0);
expect(await runAgentstack(["prod", "provision"], { cwd: appDir, write })).toBe(0);
expect(await runAgentstack(["prod", "provision", "--apply"], { cwd: appDir, write })).toBe(0);
expect(await runAgentstack(["validate", "--release", "prod"], { cwd: appDir, write })).toBe(0);
expect(await runAgentstack(["deploy", "--env", "prod"], { cwd: appDir, write })).toBe(0);
expect(await runAgentstack(["deploy", "--env", "production", "--apply", "--confirm-production"], { cwd: appDir, write })).toBe(0);
```

- [x] **Step 2: Verify red**

Run: `pnpm test -- packages/create-agent-stack/src/generate.test.ts tests/e2e/prototype.test.ts`

Expected: fail because scripts/commands are missing.

- [x] **Step 3: Update generated docs and spin-up pages**

Document the local release rehearsal, production provision/apply split, explicit confirmation, and telemetry journeys. Keep wording clear that no real provider APIs are called.

- [x] **Step 4: Verify full gate**

Run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
git diff --check
node --check docs/spinup-site/assets/site.js
curl -fsS http://127.0.0.1:8765/index.html >/tmp/agentstack-site-index.html
```

Expected: all commands exit 0.

- [x] **Step 5: Commit**

Run:

```bash
git status --short
git add README.md docs packages templates tests
git commit -m "feat: add production release rehearsal"
git status --short
```

Expected: commit succeeds and worktree is clean.

## Post-Review Adjustments

- `prod prepare` is an early local readiness step: it runs local validation plus release policy checks but does not require production local-cloud state to be linked.
- `validate --release prod` and production deploy remain production-cloud gated.
- Normal `--env` options accept `prod` as an alias for `production`, so `sync --env prod` and `deploy --env prod` match the spec examples.
- Release service diagnostics are environment-specific, for example `release.service.preview-missing` and `release.service.production-missing`.
