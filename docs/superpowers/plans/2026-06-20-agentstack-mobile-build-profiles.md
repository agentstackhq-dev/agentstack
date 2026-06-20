# Agentstack Mobile Build Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local mobile/EAS build-profile orchestration so agents can plan and rehearse development, preview, and production mobile builds through Agentstack instead of hand-wiring Expo/EAS config.

**Architecture:** Core owns the normalized mobile build profile contract. The local adapter turns that contract into deterministic local plan/apply artifacts. The CLI exposes `agentstack build mobile --env <environment>`, checks local validation plus EAS service readiness, records telemetry, and protects production applies with an explicit confirmation flag. Generated apps gain `eas.json`, `app.config.ts`, scripts, anchors, and docs that teach agents the workflow.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, Agentstack CLI/core/adapters, generated Expo/EAS template anchors.

---

## File Structure

- Create `packages/core/src/mobile-build.ts`: profile names, normalized plans, production confirmation diagnostics, and manifest compatibility checks.
- Create `packages/core/src/mobile-build.test.ts`: tests for development, preview, production profiles and disabled mobile/EAS diagnostics.
- Modify `packages/core/src/index.ts`: export mobile build helpers.
- Modify `packages/core/src/validation.ts`: require mobile build anchors when the mobile surface is enabled.
- Modify `packages/adapters/src/types.ts`: add mobile build plan/apply types to `CloudAdapter`.
- Modify `packages/adapters/src/local-cloud.ts`: implement deterministic local mobile build plan/apply artifact writing.
- Modify `packages/adapters/src/local-cloud.test.ts`: test preview plan/apply, no artifact on plan, artifact on apply, production confirmation.
- Modify `packages/cli/src/run.ts`: add `agentstack build mobile --env <env> [--apply] [--confirm-production]`.
- Modify `packages/cli/src/run.test.ts`: test build command, EAS readiness diagnostics, production confirmation, telemetry.
- Create template files in both template roots:
  - `apps/mobile/eas.json`
  - `apps/mobile/app.config.ts`
  - `docs/agentstack/mobile.md`
- Modify template files in both template roots:
  - `apps/mobile/package.json`
  - `agentstack.config.json`
  - `package.json`
  - `AGENTS.md`
  - `docs/agentstack/release.md`
  - `docs/agentstack/validation.md`
  - `docs/agentstack/workflows.md`
- Modify `packages/create-agent-stack/src/generate.test.ts`: assert mobile anchors, scripts, docs, and template parity.
- Modify `tests/e2e/prototype.test.ts`: add mobile build plan/apply and timeline inspection to the executable workflow.
- Modify README and spin-up site after implementation to explain the slice.

## Task 1: Core Mobile Build Contract

**Files:**
- Create: `packages/core/src/mobile-build.ts`
- Create: `packages/core/src/mobile-build.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/validation.ts`

- [ ] **Step 1: Write failing core tests**

Add `packages/core/src/mobile-build.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import { createMobileBuildPlan } from "./mobile-build.js";
import { getRequiredGeneratedAnchors } from "./validation.js";

describe("createMobileBuildPlan", () => {
  it("normalizes the development build profile", () => {
    const result = createMobileBuildPlan(createDefaultManifest("acme-crm"), "development", {
      apply: false
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toMatchObject({
        environment: "development",
        profile: "development",
        distribution: "internal",
        developmentClient: true,
        applied: false,
        artifactPath: ".agentstack/builds/mobile-development.json"
      });
    }
  });

  it("normalizes the preview build profile", () => {
    const result = createMobileBuildPlan(createDefaultManifest("acme-crm"), "preview", { apply: true });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.profile).toBe("preview");
      expect(result.value.distribution).toBe("internal");
      expect(result.value.developmentClient).toBe(false);
      expect(result.value.applied).toBe(true);
    }
  });

  it("requires explicit production confirmation for production apply", () => {
    const result = createMobileBuildPlan(createDefaultManifest("acme-crm"), "production", {
      apply: true
    });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "mobile.build.production-confirmation.required",
        path: "production.mobile",
        blocks: ["build mobile"]
      })
    ]);
  });

  it("fails when mobile surface is disabled", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.surfaces = ["web", "convex"];

    const result = createMobileBuildPlan(manifest, "preview", { apply: false });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "mobile.surface.disabled" })
    ]);
  });

  it("requires generated mobile build anchors when mobile is enabled", () => {
    expect(getRequiredGeneratedAnchors(createDefaultManifest("acme-crm"))).toEqual(
      expect.arrayContaining([
        "apps/mobile/app.config.ts",
        "apps/mobile/eas.json",
        "docs/agentstack/mobile.md"
      ])
    );
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
pnpm vitest run packages/core/src/mobile-build.test.ts
```

Expected: fail because `./mobile-build.js` does not exist.

- [ ] **Step 3: Implement core mobile build helper**

Create `packages/core/src/mobile-build.ts` with:

```ts
import { fail, pass, type Diagnostic, type Result } from "./diagnostics.js";
import type { AgentstackManifest, EnvironmentName } from "./manifest.js";

export type MobileBuildProfileName = "development" | "preview" | "production";
export type MobileBuildDistribution = "internal" | "store";

export type MobileBuildPlan = {
  environment: EnvironmentName;
  profile: MobileBuildProfileName;
  distribution: MobileBuildDistribution;
  developmentClient: boolean;
  applied: boolean;
  artifactPath: string;
};

export type MobileBuildPlanOptions = {
  apply: boolean;
  confirmProduction?: boolean;
};

export function createMobileBuildPlan(
  manifest: AgentstackManifest,
  environment: EnvironmentName,
  options: MobileBuildPlanOptions
): Result<MobileBuildPlan> {
  const diagnostics = validateMobileBuildManifest(manifest, environment, options);
  if (diagnostics.length > 0) {
    return fail(diagnostics);
  }

  const profile = readProfile(environment);
  return pass({
    environment,
    profile,
    distribution: profile === "production" ? "store" : "internal",
    developmentClient: profile === "development",
    applied: options.apply,
    artifactPath: `.agentstack/builds/mobile-${environment}.json`
  });
}
```

Add `validateMobileBuildManifest` diagnostics:

- `mobile.surface.disabled` when `manifest.surfaces` does not include `mobile`.
- `mobile.eas.disabled` when `manifest.services.eas.enabled` is false or the environment is outside `requiredEnvironments`.
- `mobile.build.production-confirmation.required` when production is applied without `confirmProduction`.

- [ ] **Step 4: Export and anchor mobile build files**

Add to `packages/core/src/index.ts`:

```ts
export * from "./mobile-build.js";
```

In `packages/core/src/validation.ts`, when `manifest.surfaces.includes("mobile")`, add:

```ts
anchors.push("apps/mobile/app.config.ts");
anchors.push("apps/mobile/eas.json");
anchors.push("docs/agentstack/mobile.md");
```

- [ ] **Step 5: Run core tests to verify GREEN**

Run:

```bash
pnpm vitest run packages/core/src/mobile-build.test.ts packages/core/src/validation.test.ts
```

Expected: all selected tests pass.

## Task 2: Local Adapter Mobile Build Rehearsal

**Files:**
- Modify: `packages/adapters/src/types.ts`
- Modify: `packages/adapters/src/local-cloud.ts`
- Modify: `packages/adapters/src/local-cloud.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Add tests to `packages/adapters/src/local-cloud.test.ts`:

```ts
it("plans a preview mobile build without writing an artifact", async () => {
  const adapter = new LocalCloudAdapter(dir);
  const plan = await adapter.mobileBuild(createDefaultManifest("acme-crm"), "preview", {
    apply: false
  });

  expect(plan).toMatchObject({
    environment: "preview",
    profile: "preview",
    service: "eas",
    applied: false,
    artifactPath: ".agentstack/builds/mobile-preview.json"
  });
  await expect(stat(join(dir, ".agentstack", "builds", "mobile-preview.json"))).rejects.toMatchObject({
    code: "ENOENT"
  });
});

it("applies a preview mobile build by writing a local artifact", async () => {
  const adapter = new LocalCloudAdapter(dir);
  const plan = await adapter.mobileBuild(createDefaultManifest("acme-crm"), "preview", {
    apply: true
  });

  const artifact = JSON.parse(await readFile(join(dir, ".agentstack", "builds", "mobile-preview.json"), "utf8"));

  expect(plan.applied).toBe(true);
  expect(artifact).toMatchObject({
    environment: "preview",
    profile: "preview",
    service: "eas",
    applied: true
  });
});

it("passes production build confirmation through the core contract", async () => {
  const adapter = new LocalCloudAdapter(dir);

  await expect(
    adapter.mobileBuild(createDefaultManifest("acme-crm"), "production", { apply: true })
  ).rejects.toThrow("mobile.build.production-confirmation.required");
  await expect(
    adapter.mobileBuild(createDefaultManifest("acme-crm"), "production", {
      apply: true,
      confirmProduction: true
    })
  ).resolves.toMatchObject({ environment: "production", profile: "production", applied: true });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
pnpm vitest run packages/adapters/src/local-cloud.test.ts -t "mobile build"
```

Expected: fail because `mobileBuild` does not exist.

- [ ] **Step 3: Implement adapter types and local artifact writing**

Add to `packages/adapters/src/types.ts`:

```ts
export type MobileBuildOptions = {
  apply: boolean;
  confirmProduction?: boolean;
};

export type MobileBuildAdapterPlan = MobileBuildPlan & {
  service: "eas";
};
```

Import `MobileBuildPlan` from `@agentstack/core` and add to `CloudAdapter`:

```ts
mobileBuild(
  manifest: AgentstackManifest,
  environment: EnvironmentName,
  options: MobileBuildOptions
): Promise<MobileBuildAdapterPlan>;
```

Implement `LocalCloudAdapter.mobileBuild` by calling `createMobileBuildPlan`; throw a joined diagnostic string if the result is not ok; add `service: "eas"`; write the artifact only when `options.apply` is true.

- [ ] **Step 4: Run adapter tests to verify GREEN**

Run:

```bash
pnpm vitest run packages/adapters/src/local-cloud.test.ts
```

Expected: all adapter tests pass.

## Task 3: CLI Build Command

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Add tests to `packages/cli/src/run.test.ts`:

```ts
it("plans a preview mobile build when EAS is linked", async () => {
  await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });

  const code = await runAgentstack(["build", "mobile", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output).toContain("PLAN mobile build preview");
  expect(output).toContain("- planned eas profile preview distribution internal development-client=no");
  await expect(stat(join(dir, ".agentstack", "builds", "mobile-preview.json"))).rejects.toMatchObject({
    code: "ENOENT"
  });
});

it("applies a preview mobile build and writes an artifact", async () => {
  await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });

  const code = await runAgentstack(["build", "mobile", "--env", "preview", "--apply"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output).toContain("APPLIED mobile build preview");
  await expect(readFile(join(dir, ".agentstack", "builds", "mobile-preview.json"), "utf8")).resolves.toContain(
    '"profile": "preview"'
  );
});

it("requires EAS cloud state before mobile builds", async () => {
  const code = await runAgentstack(["build", "mobile", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(1);
  expect(output.join("\n")).toContain("FAIL cloud.service.missing");
  expect(output.join("\n")).toContain("Path: preview.eas");
  expect(output.join("\n")).toContain("Fix: Run agentstack sync --env preview --apply.");
});

it("records mobile build telemetry", async () => {
  await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });
  await runAgentstack(["build", "mobile", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });

  const code = await runAgentstack(
    ["observe", "timeline", "--env", "preview", "--journey", "mobile-build"],
    { cwd: dir, write: (line) => output.push(line) }
  );

  expect(code).toBe(0);
  expect(output.join("\n")).toContain("agentstack.mobile.build.completed");
  expect(output.join("\n")).toContain('"profile":"preview"');
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "mobile build"
```

Expected: fail because `build mobile` is unknown.

- [ ] **Step 3: Implement `agentstack build mobile`**

In `runAgentstack`, route:

```ts
if (command === "build" && subcommand === "mobile") {
  return await buildMobileCommand(rest, io);
}
```

Implement:

- require `--env`;
- run local validation gate and print/fail on diagnostics;
- inspect local cloud state and only block on missing/stale `eas` diagnostics for the selected environment;
- call `LocalCloudAdapter.mobileBuild`;
- print either `PLAN mobile build <env>` or `APPLIED mobile build <env>`;
- print `- planned|applied eas profile <profile> distribution <distribution> development-client=<yes|no>`;
- record `agentstack.mobile.build.completed` with journey `mobile-build`.

- [ ] **Step 4: Run CLI tests to verify GREEN**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "mobile build|records mobile build"
```

Expected: selected tests pass.

## Task 4: Generated Mobile/EAS Template And Docs

**Files:**
- Create in both template roots: `apps/mobile/eas.json`
- Create in both template roots: `apps/mobile/app.config.ts`
- Create in both template roots: `docs/agentstack/mobile.md`
- Modify in both template roots: `apps/mobile/package.json`
- Modify in both template roots: `package.json`
- Modify in both template roots: `agentstack.config.json`
- Modify in both template roots: `AGENTS.md`
- Modify in both template roots: `docs/agentstack/release.md`
- Modify in both template roots: `docs/agentstack/validation.md`
- Modify in both template roots: `docs/agentstack/workflows.md`
- Modify: `packages/create-agent-stack/src/generate.test.ts`
- Modify: `tests/e2e/prototype.test.ts`

- [ ] **Step 1: Write failing generator and e2e tests**

In `packages/create-agent-stack/src/generate.test.ts`, add generated anchor fixtures:

```ts
"apps/mobile/app.config.ts",
"apps/mobile/eas.json",
"docs/agentstack/mobile.md",
```

Assert root package scripts:

```ts
"mobile:build:development": "node scripts/agentstack.mjs build mobile --env development",
"mobile:build:preview": "node scripts/agentstack.mjs build mobile --env preview",
"mobile:build:preview:apply": "node scripts/agentstack.mjs build mobile --env preview --apply",
"mobile:build:production": "node scripts/agentstack.mjs build mobile --env production",
```

Assert files contain:

```ts
await expect(readFile(join(targetDir, "apps/mobile/eas.json"), "utf8")).resolves.toContain('"developmentClient": true');
await expect(readFile(join(targetDir, "apps/mobile/app.config.ts"), "utf8")).resolves.toContain("expo");
await expect(readFile(join(targetDir, "docs/agentstack/mobile.md"), "utf8")).resolves.toContain("agentstack build mobile");
```

In `tests/e2e/prototype.test.ts`, after preview sync apply:

```ts
expect(await runAgentstack(["build", "mobile", "--env", "preview"], { cwd: appDir, write })).toBe(0);
expect(await runAgentstack(["build", "mobile", "--env", "preview", "--apply"], { cwd: appDir, write })).toBe(0);
await expect(readFile(join(appDir, ".agentstack/builds/mobile-preview.json"), "utf8")).resolves.toContain(
  '"profile": "preview"'
);
```

Add output assertions for `PLAN mobile build preview`, `APPLIED mobile build preview`, and `agentstack.mobile.build.completed`.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates a B2B SaaS project"
pnpm vitest run tests/e2e/prototype.test.ts
```

Expected: generator test fails because files/scripts are absent; e2e fails until CLI/template are implemented.

- [ ] **Step 3: Add generated mobile/EAS files**

Create `apps/mobile/eas.json` in both template roots:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "APP_ENV": "development" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "APP_ENV": "preview" }
    },
    "production": {
      "autoIncrement": true,
      "env": { "APP_ENV": "production" }
    }
  },
  "submit": {
    "production": {}
  }
}
```

Create `apps/mobile/app.config.ts` in both template roots:

```ts
import { appConfig } from "../../packages/config/src/index.js";

export default {
  expo: {
    name: appConfig.name,
    slug: appConfig.slug,
    scheme: appConfig.slug,
    extra: {
      agentstack: {
        defaultEnvironment: appConfig.defaultEnvironment,
        surfaces: appConfig.surfaces
      }
    }
  }
};
```

Update `apps/mobile/package.json` scripts:

```json
"dev": "expo start --dev-client",
"build:development": "eas build --profile development --platform all",
"build:preview": "eas build --profile preview --platform all",
"build:production": "eas build --profile production --platform all"
```

- [ ] **Step 4: Add generated root scripts, anchors, and docs**

Root package scripts in both template roots:

```json
"mobile:build:development": "node scripts/agentstack.mjs build mobile --env development",
"mobile:build:preview": "node scripts/agentstack.mjs build mobile --env preview",
"mobile:build:preview:apply": "node scripts/agentstack.mjs build mobile --env preview --apply",
"mobile:build:production": "node scripts/agentstack.mjs build mobile --env production"
```

Add anchors in both `agentstack.config.json` files:

```json
"apps/mobile/app.config.ts",
"apps/mobile/eas.json",
"docs/agentstack/mobile.md"
```

Create `docs/agentstack/mobile.md` documenting:

- `pnpm run mobile:build:development`;
- `pnpm run mobile:build:preview`;
- `pnpm run mobile:build:preview:apply`;
- `pnpm run mobile:build:production`;
- `agentstack build mobile --env production --apply --confirm-production` for future production apply rehearsal.

Update `AGENTS.md`, release, validation, and workflows docs to mention mobile build validation and EAS profiles.

- [ ] **Step 5: Run generator/e2e/template checks to verify GREEN**

Run:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts tests/e2e/prototype.test.ts
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

Expected: tests pass and template diff is clean.

## Final Verification

- [ ] Run `pnpm install --frozen-lockfile`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas`.
- [ ] Run the spin-up link checker if spin-up pages changed.
- [ ] Run `git diff --check`.
- [ ] Commit with message `feat: add mobile build profile rehearsal`.

## Self-Review

- Spec coverage: this plan advances mobile build profile management, EAS generated anchors, mobile release workflow, command telemetry, and validation feedback. It does not call real EAS APIs or create real Expo build artifacts; that remains for provider adapters.
- Placeholder scan: no placeholder tasks are left.
- Type consistency: command names, artifact paths, profile names, and diagnostic codes are consistent across tasks.
