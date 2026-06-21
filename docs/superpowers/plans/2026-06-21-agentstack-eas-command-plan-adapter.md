# Agentstack EAS Command Plan Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add EAS to the provider command-plan wrapper layer so mobile build and mobile env commands are inspectable, redacted, and aligned with Agentstack's existing mobile build rehearsal.

**Architecture:** Mirror the Convex, Vercel, and Clerk adapter pattern with a pure `packages/adapters` planner, CLI rendering through `agentstack provider plan`, generated template scripts/docs, and direct tests. This slice plans EAS project initialization, build, env, and status/list commands; it does not execute EAS, submit to app stores, or mutate provider state.

**Tech Stack:** TypeScript, Vitest, Agentstack provider operation contracts, EAS CLI 20.3.0, generated Expo/EAS mobile template.

---

## Current Primary Source Notes

- Expo's EAS CLI reference identifies EAS CLI 20.3.0 and documents package-manager execution through `npx eas-cli@latest`.
- `eas build` starts builds and accepts `-p/--platform`, `-e/--profile`, `--json`, and `--non-interactive`.
- `eas build:configure` configures a project for EAS Build, and `eas project:init --non-interactive` is the non-interactive project initialization surface.
- EAS env docs document `eas env:create [ENVIRONMENT] --name ... --value ... --environment ... --visibility ...`, `eas env:update [ENVIRONMENT] --variable-name ... --variable-environment ... --value ...`, `eas env:delete [ENVIRONMENT] --variable-name ... --variable-environment ...`, `eas env:list --environment ...`, `eas env:pull --environment ...`, and the visibility levels `plaintext`, `sensitive`, and `secret`.
- Expo warns that client-side values are public and that CI/local env variables are not a substitute for EAS server env variables used by EAS Build.
- `eas submit` exists for app store submission, but this slice should document it as future provider coverage rather than adding submit automation.

## File Structure

- Create `packages/adapters/src/eas.ts`: pure EAS command target/planner types and functions.
- Create `packages/adapters/src/eas.test.ts`: adapter tests for preview/production targets and redacted env command mapping.
- Modify `packages/adapters/src/provider-operations.ts`: promote EAS status from `contract-only` to `command-plan`.
- Modify `packages/adapters/src/index.ts`: export EAS planner.
- Modify `packages/cli/src/run.ts`: route `agentstack provider plan --service eas`, render EAS target labels, and keep unsupported-service diagnostics current.
- Modify `packages/cli/src/run.test.ts`: add EAS CLI behavior tests and update provider adapter status snapshots.
- Modify `packages/create-agent-stack/templates/b2b-saas/package.json` and `templates/b2b-saas/package.json`: add `eas-cli` devDependency and EAS provider scripts.
- Modify `packages/create-agent-stack/templates/b2b-saas/apps/mobile/package.json` and `templates/b2b-saas/apps/mobile/package.json`: add package-local EAS provider scripts.
- Modify generated mobile/environment docs in both template trees.
- Modify `packages/create-agent-stack/src/generate.test.ts`: assert generated EAS dependency/scripts.

### Task 1: EAS Adapter Planner

**Files:**
- Create: `packages/adapters/src/eas.ts`
- Create: `packages/adapters/src/eas.test.ts`
- Modify: `packages/adapters/src/provider-operations.ts`
- Modify: `packages/adapters/src/index.ts`

- [ ] **Step 1: Write the failing adapter tests**

```ts
import { describe, expect, it } from "vitest";

import { createEasCommandPlan, createEasTarget } from "./eas.js";

describe("eas command planner", () => {
  it("plans preview mobile build targets with internal distribution", () => {
    const target = createEasTarget("preview");

    expect(target).toEqual(
      expect.objectContaining({
        environment: "preview",
        buildProfile: "preview",
        easEnvironment: "preview",
        platform: "all",
        distribution: "internal",
        requiredEnv: ["EXPO_TOKEN"],
        requiresConfirmation: false
      })
    );
    expect(target.projectInitCommand.args).toEqual([
      "pnpm",
      "exec",
      "eas",
      "project:init",
      "--non-interactive"
    ]);
    expect(target.buildCommand.args).toEqual([
      "pnpm",
      "exec",
      "eas",
      "build",
      "-p",
      "all",
      "-e",
      "preview",
      "--json",
      "--non-interactive"
    ]);
  });

  it("plans production mobile build targets with confirmation", () => {
    const target = createEasTarget("production");

    expect(target).toEqual(
      expect.objectContaining({
        environment: "production",
        buildProfile: "production",
        easEnvironment: "production",
        distribution: "store",
        requiredEnv: ["EXPO_TOKEN"],
        requiresConfirmation: true
      })
    );
    expect(target.buildCommand.requiresConfirmation).toBe(true);
  });

  it("maps EAS env operations to redacted env commands", () => {
    const plan = createEasCommandPlan({
      environment: "preview",
      operations: [
        {
          id: "preview.eas.env.set.mobile.EXPO_PUBLIC_API_URL",
          environment: "preview",
          service: "eas",
          kind: "env.set",
          scope: "mobile",
          target: "env:EXPO_PUBLIC_API_URL",
          source: "env.missing",
          summary: "Set EXPO_PUBLIC_API_URL for eas mobile in preview.",
          secret: false,
          requiresConfirmation: false
        },
        {
          id: "preview.eas.env.set.mobile.SENTRY_AUTH_TOKEN",
          environment: "preview",
          service: "eas",
          kind: "env.set",
          scope: "mobile",
          target: "env:SENTRY_AUTH_TOKEN",
          source: "env.drifted",
          summary: "Set SENTRY_AUTH_TOKEN for eas mobile in preview.",
          secret: true,
          requiresConfirmation: false
        },
        {
          id: "preview.eas.env.remove.mobile.LEGACY_FLAG",
          environment: "preview",
          service: "eas",
          kind: "env.remove",
          scope: "mobile",
          target: "env:LEGACY_FLAG",
          source: "env.stale",
          summary: "Remove LEGACY_FLAG for eas mobile in preview.",
          secret: false,
          requiresConfirmation: false
        }
      ],
      includeBuild: true
    });

    expect(plan.commands.map((command) => command.kind)).toEqual([
      "mobile.project.init",
      "mobile.env.list",
      "mobile.build",
      "env.create",
      "env.update",
      "env.delete"
    ]);
    expect(plan.commands[3]).toEqual(
      expect.objectContaining({
        kind: "env.create",
        args: [
          "pnpm",
          "exec",
          "eas",
          "env:create",
          "preview",
          "--name",
          "EXPO_PUBLIC_API_URL",
          "--value",
          "<value from .agentstack/env-values.json>",
          "--environment",
          "preview",
          "--visibility",
          "plaintext",
          "--non-interactive"
        ],
        valueSource: "argument",
        stdinLabel: "<value from .agentstack/env-values.json>"
      })
    );
    expect(plan.commands[4]).toEqual(
      expect.objectContaining({
        kind: "env.update",
        args: [
          "pnpm",
          "exec",
          "eas",
          "env:update",
          "preview",
          "--variable-name",
          "SENTRY_AUTH_TOKEN",
          "--variable-environment",
          "preview",
          "--value",
          "<secret from .agentstack/env-values.json>",
          "--visibility",
          "secret",
          "--non-interactive"
        ],
        valueSource: "argument",
        stdinLabel: "<secret from .agentstack/env-values.json>"
      })
    );
    expect(plan.commands[5]?.args).toEqual([
      "pnpm",
      "exec",
      "eas",
      "env:delete",
      "preview",
      "--variable-name",
      "LEGACY_FLAG",
      "--variable-environment",
      "preview",
      "--non-interactive"
    ]);
    expect(JSON.stringify(plan)).not.toContain("SENTRY_AUTH_TOKEN_VALUE");
  });
});
```

- [ ] **Step 2: Run adapter tests to verify RED**

Run: `pnpm vitest run packages/adapters/src/eas.test.ts`

Expected: FAIL because `./eas.js` cannot be resolved or exported functions do not exist.

- [ ] **Step 3: Implement the EAS planner**

Create `packages/adapters/src/eas.ts` with:

```ts
import type { EnvironmentName } from "@agentstack/core";

import type { ProviderOperation } from "./provider-operations.js";

export type EasCommandKind =
  | "mobile.project.init"
  | "mobile.env.list"
  | "mobile.build"
  | "env.create"
  | "env.update"
  | "env.delete";

export type EasCliCommand = {
  id: string;
  kind: EasCommandKind;
  environment: EnvironmentName;
  summary: string;
  args: string[];
  valueSource?: "argument";
  stdinLabel?: string;
  secret: boolean;
  requiresConfirmation: boolean;
};

export type EasTarget = {
  environment: EnvironmentName;
  easEnvironment: "development" | "preview" | "production";
  buildProfile: "development" | "preview" | "production";
  platform: "all";
  distribution: "internal" | "store";
  projectInitCommand: EasCliCommand;
  envListCommand: EasCliCommand;
  buildCommand: EasCliCommand;
  requiredEnv: string[];
  warnings: string[];
  requiresConfirmation: boolean;
};

export type EasCommandPlanInput = {
  environment: EnvironmentName;
  operations: ProviderOperation[];
  includeBuild?: boolean;
};

export type EasCommandPlan = {
  service: "eas";
  environment: EnvironmentName;
  target: EasTarget;
  commands: EasCliCommand[];
};
```

Implement behavior:

- `createEasTarget("development")` uses profile/environment `development`, distribution `internal`, no production confirmation.
- `createEasTarget("preview")` uses profile/environment `preview`, distribution `internal`.
- `createEasTarget("production")` uses profile/environment `production`, distribution `store`, confirmation required.
- All targets require `EXPO_TOKEN`.
- Warnings mention EAS server env values, credential/app-store review, and that submit automation is future work.
- `createEasCommandPlan({ includeBuild: true })` emits project init, env list, build, then operation commands for EAS env operations.
- Missing EAS env maps to `eas env:create`; drifted maps to `eas env:update`; stale maps to `eas env:delete`.
- Secret env uses `--visibility secret`; non-secret env uses `--visibility plaintext`.
- Do not include raw values in args or summaries.

- [ ] **Step 4: Promote and export EAS command-plan status**

Change `providerAdapterDefinitions.eas.realAdapterStatus` to `"command-plan"` and export `./eas.js` from `packages/adapters/src/index.ts`.

- [ ] **Step 5: Run adapter tests to verify GREEN**

Run: `pnpm vitest run packages/adapters/src/eas.test.ts packages/adapters/src/provider-operations.test.ts`

Expected: PASS.

### Task 2: CLI Integration

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Write the failing CLI tests**

Add tests near the existing provider plan tests:

```ts
it("prints redacted EAS provider command plans", async () => {
  const manifest = createDefaultManifest("acme-crm");
  manifest.environments = ["preview"];
  manifest.surfaces = ["mobile"];
  manifest.env.custom.EXPO_PUBLIC_API_URL = {
    surfaces: ["mobile"],
    environments: ["preview"],
    required: true,
    secret: false
  };
  await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeLocalEnvValues({
    preview: { mobile: { EXPO_PUBLIC_API_URL: "https://api.example.test" } }
  });

  const code = await runAgentstack(["provider", "plan", "--service", "eas", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output).toContain("PLAN provider eas preview");
  expect(output.join("\n")).toContain("Target: preview");
  expect(output.join("\n")).toContain("Required env: EXPO_TOKEN");
  expect(output.join("\n")).toContain("pnpm exec eas project:init --non-interactive");
  expect(output.join("\n")).toContain("pnpm exec eas env:list --environment preview");
  expect(output.join("\n")).toContain("pnpm exec eas build -p all -e preview --json --non-interactive");
  expect(output.join("\n")).toContain("EXPO_PUBLIC_API_URL: <value from .agentstack/env-values.json>");
  expect(output.join("\n")).not.toContain("https://api.example.test");
});

it("prints explicit confirmation requirements for production EAS provider plans", async () => {
  const code = await runAgentstack(["provider", "plan", "--service", "eas", "--env", "production"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output).toContain("PLAN provider eas production");
  expect(output.join("\n")).toContain("Requires confirmation: yes");
  expect(output.join("\n")).toContain(
    "- mobile.build [requires-confirmation] pnpm exec eas build -p all -e production --json --non-interactive"
  );
});
```

Update existing adapter status expectations from `eas:contract-only` to `eas:command-plan`.

Update unsupported provider coverage to use a clearly unknown service such as `railway`.

- [ ] **Step 2: Run CLI tests to verify RED**

Run: `pnpm vitest run packages/cli/src/run.test.ts --testNamePattern "EAS provider|provider plan|project lifecycle state|unsynced preview inspection"`

Expected: FAIL because CLI still rejects EAS plans or status snapshots still expect old text.

- [ ] **Step 3: Implement CLI routing**

Change `packages/cli/src/run.ts`:

- Import `createEasCommandPlan`.
- Accept `service === "eas"` in `providerPlanCommand`.
- Build EAS plans with `{ environment, operations: providerOperationPlan.operations, includeBuild: true }`.
- Update unsupported diagnostic message to "Clerk, Convex, Vercel, and EAS provider command planners are available in this slice."
- Update `formatProviderPlanTarget()` type to include `easEnvironment?: string`.
- Update `formatProviderCommandTargetLabel()` for `env.create`, `env.update`, and `env.delete` EAS command argument shapes.

- [ ] **Step 4: Run CLI tests to verify GREEN**

Run: `pnpm vitest run packages/cli/src/run.test.ts --testNamePattern "EAS provider|provider plan|project lifecycle state|unsynced preview inspection"`

Expected: PASS.

### Task 3: Generated Template Scripts And Docs

**Files:**
- Modify: `packages/create-agent-stack/src/generate.test.ts`
- Modify: `packages/create-agent-stack/templates/b2b-saas/package.json`
- Modify: `templates/b2b-saas/package.json`
- Modify: `packages/create-agent-stack/templates/b2b-saas/apps/mobile/package.json`
- Modify: `templates/b2b-saas/apps/mobile/package.json`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/mobile.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/environments.md`
- Modify: `templates/b2b-saas/docs/agentstack/mobile.md`
- Modify: `templates/b2b-saas/docs/agentstack/environments.md`

- [ ] **Step 1: Write the failing generator test**

Modify `packages/create-agent-stack/src/generate.test.ts` to assert generated root `package.json` includes:

```ts
expect(packageManifest.devDependencies["eas-cli"]).toBe("^20.3.0");
expect(packageManifest.scripts["provider:eas:preview"]).toBe(
  "node scripts/agentstack.mjs provider plan --service eas --env preview"
);
expect(packageManifest.scripts["provider:eas:production"]).toBe(
  "node scripts/agentstack.mjs provider plan --service eas --env production"
);
```

Assert generated `apps/mobile/package.json` includes:

```ts
expect(mobilePackageManifest.scripts["provider:eas:preview"]).toBe(
  "node ../../scripts/agentstack.mjs provider plan --service eas --env preview"
);
expect(mobilePackageManifest.scripts["provider:eas:production"]).toBe(
  "node ../../scripts/agentstack.mjs provider plan --service eas --env production"
);
```

- [ ] **Step 2: Run generator test to verify RED**

Run: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts`

Expected: FAIL because the template lacks EAS CLI dependency and scripts.

- [ ] **Step 3: Add EAS template scripts and docs**

In both root template `package.json` files, add:

```json
"eas-cli": "^20.3.0"
```

Add root scripts:

```json
"provider:eas:preview": "node scripts/agentstack.mjs provider plan --service eas --env preview",
"provider:eas:production": "node scripts/agentstack.mjs provider plan --service eas --env production"
```

Add mobile package scripts:

```json
"provider:eas:preview": "node ../../scripts/agentstack.mjs provider plan --service eas --env preview",
"provider:eas:production": "node ../../scripts/agentstack.mjs provider plan --service eas --env production"
```

Update mobile docs to explain `pnpm run provider:eas:preview`, `pnpm run provider:eas:production`, `eas project:init --non-interactive`, `eas env:list`, and `eas build`.

Update environments docs to say EAS server env values are planned through the EAS provider plan and that mobile env values must be present in EAS, not only local CI or `.env` files.

- [ ] **Step 4: Run generator test to verify GREEN**

Run: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts`

Expected: PASS.

### Task 4: Full Slice Verification And Commit

**Files:**
- Inspect all changed files.
- No provider apply/mutation implementation beyond command planning.

- [ ] **Step 1: Run focused provider tests**

Run: `pnpm vitest run packages/adapters/src/eas.test.ts packages/adapters/src/provider-operations.test.ts packages/cli/src/run.test.ts packages/create-agent-stack/src/generate.test.ts`

Expected: PASS.

- [ ] **Step 2: Run full verification gate**

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

- [ ] **Step 3: Review docs freshness**

Verify local docs mention EAS CLI in bounded command-plan terms only. Do not claim app-store submission automation or real provider mutation.

- [ ] **Step 4: Commit**

Run:

```bash
git status --short
git add docs/superpowers/plans/2026-06-21-agentstack-eas-command-plan-adapter.md packages/adapters/src/eas.ts packages/adapters/src/eas.test.ts packages/adapters/src/provider-operations.ts packages/adapters/src/provider-operations.test.ts packages/adapters/src/index.ts packages/cli/src/run.ts packages/cli/src/run.test.ts packages/create-agent-stack/src/generate.test.ts packages/create-agent-stack/templates/b2b-saas/package.json packages/create-agent-stack/templates/b2b-saas/apps/mobile/package.json packages/create-agent-stack/templates/b2b-saas/docs/agentstack/mobile.md packages/create-agent-stack/templates/b2b-saas/docs/agentstack/environments.md templates/b2b-saas/package.json templates/b2b-saas/apps/mobile/package.json templates/b2b-saas/docs/agentstack/mobile.md templates/b2b-saas/docs/agentstack/environments.md pnpm-lock.yaml
git commit -m "feat: add eas command plan adapter"
```

Expected: commit succeeds and `git status --short` is clean afterward.

## Self-Review

- Spec coverage: The plan implements EAS as a command-plan provider for mobile build and env planning, updates CLI/template/docs/tests, and keeps submit automation out of scope.
- Placeholder scan: No `TBD`, `TODO`, or "implement later" instructions remain.
- Type consistency: `EasCommandPlan`, `EasTarget`, and command kinds match planned tests and CLI formatting requirements.
