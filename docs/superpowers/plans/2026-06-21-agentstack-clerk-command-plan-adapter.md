# Agentstack Clerk Command Plan Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Clerk to the provider command-plan wrapper layer so agents can inspect bounded auth, billing, webhook, env, and production-readiness commands before touching Clerk state.

**Architecture:** Mirror the Convex and Vercel adapter pattern: a pure planner in `packages/adapters`, CLI rendering in `packages/cli`, and generated template scripts/docs. The first Clerk slice is intentionally command-plan only: it emits safe, redacted commands and warnings, but does not execute provider mutations.

**Tech Stack:** TypeScript, Vitest, Agentstack provider operation contracts, Clerk CLI, generated b2b-saas template.

---

## Current Primary Source Notes

- Official Clerk CLI docs say `clerk init` detects frameworks, installs SDKs, applies auth setup, links an authenticated project, and pulls env values. The CLI also supports `clerk env pull`, `clerk config pull`, `clerk config patch`, `clerk deploy`, `clerk deploy status`, `clerk api`, `clerk doctor`, `clerk apps list`, and `clerk apps create`.
- Official Clerk CLI docs call out agent mode: non-TTY defaults to agent mode, `--mode agent` is explicit, `clerk init -y` is agent-friendly, and `clerk deploy --mode agent` returns a read-only production status snapshot.
- Official Clerk env docs define `CLERK_SECRET_KEY`, public publishable keys such as `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`, and telemetry flags. Production docs warn that production uses `pk_live_` and `sk_live_` keys and webhooks require production instance URLs and signing secrets.
- Official Clerk Billing webhook docs state Billing is beta and webhook APIs can change, so Agentstack should surface a warning rather than overclaiming billing provisioning.

## File Structure

- Create `packages/adapters/src/clerk.ts`: pure Clerk command target/planner types and functions.
- Create `packages/adapters/src/clerk.test.ts`: adapter tests for preview/production targets and redacted command mapping.
- Modify `packages/adapters/src/provider-operations.ts`: promote Clerk status from `contract-only` to `command-plan`.
- Modify `packages/adapters/src/index.ts`: export Clerk planner.
- Modify `packages/cli/src/run.ts`: route `agentstack provider plan --service clerk`, render Clerk application target labels, and update unsupported-service diagnostic.
- Modify `packages/cli/src/run.test.ts`: add Clerk CLI behavior tests and update provider adapter status snapshots.
- Modify `packages/create-agent-stack/templates/b2b-saas/package.json` and `templates/b2b-saas/package.json`: add `clerk` devDependency and Clerk provider scripts.
- Modify `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/auth.md`, `billing.md`, `environments.md`, and matching files under `templates/b2b-saas/docs/agentstack/`: document the bounded Clerk wrapper.

### Task 1: Clerk Adapter Planner

**Files:**
- Create: `packages/adapters/src/clerk.ts`
- Create: `packages/adapters/src/clerk.test.ts`
- Modify: `packages/adapters/src/provider-operations.ts`
- Modify: `packages/adapters/src/index.ts`

- [ ] **Step 1: Write the failing adapter tests**

```ts
import { describe, expect, it } from "vitest";

import { createClerkCommandPlan, createClerkTarget } from "./clerk.js";

describe("clerk command planner", () => {
  it("plans preview setup with agent-safe Clerk CLI commands", () => {
    const target = createClerkTarget("preview");

    expect(target).toEqual(
      expect.objectContaining({
        environment: "preview",
        clerkEnvironment: "development",
        applicationSelector: "<clerk-development-application>",
        requiredEnv: [],
        requiresConfirmation: false
      })
    );
    expect(target.bootstrapCommand.args).toEqual(["pnpm", "exec", "clerk", "init", "-y"]);
    expect(target.diagnosticsCommand.args).toEqual([
      "pnpm",
      "exec",
      "clerk",
      "doctor",
      "--mode",
      "agent"
    ]);
  });

  it("plans production setup with production status and confirmation", () => {
    const target = createClerkTarget("production");

    expect(target).toEqual(
      expect.objectContaining({
        environment: "production",
        clerkEnvironment: "production",
        applicationSelector: "<clerk-production-application>",
        requiredEnv: ["CLERK_SECRET_KEY"],
        requiresConfirmation: true
      })
    );
    expect(target.productionStatusCommand.args).toEqual([
      "pnpm",
      "exec",
      "clerk",
      "deploy",
      "--mode",
      "agent"
    ]);
  });

  it("maps Clerk env operations to redacted env pull and config inspection commands", () => {
    const plan = createClerkCommandPlan({
      environment: "preview",
      operations: [
        {
          id: "preview.clerk.env.set.web.CLERK_SECRET_KEY",
          environment: "preview",
          service: "clerk",
          kind: "env.set",
          scope: "web",
          target: "env:CLERK_SECRET_KEY",
          source: "env.missing",
          summary: "Set CLERK_SECRET_KEY for clerk web in preview.",
          secret: true,
          requiresConfirmation: false
        },
        {
          id: "preview.vercel.env.set.web.PUBLIC_URL",
          environment: "preview",
          service: "vercel",
          kind: "env.set",
          scope: "web",
          target: "env:PUBLIC_URL",
          source: "env.missing",
          summary: "Set PUBLIC_URL for vercel web in preview.",
          secret: false,
          requiresConfirmation: false
        }
      ],
      includeBootstrap: true
    });

    expect(plan.commands.map((command) => command.kind)).toEqual([
      "auth.bootstrap",
      "auth.diagnostics",
      "auth.env.pull",
      "auth.config.pull",
      "env.pull"
    ]);
    expect(plan.commands.at(-1)).toEqual(
      expect.objectContaining({
        id: "preview.clerk.env.set.web.CLERK_SECRET_KEY",
        kind: "env.pull",
        args: ["pnpm", "exec", "clerk", "env", "pull", "--mode", "agent"],
        secret: true,
        valueSource: "clerk-dashboard"
      })
    );
    expect(JSON.stringify(plan)).not.toContain("sk_");
  });
});
```

- [ ] **Step 2: Run adapter tests to verify RED**

Run: `pnpm vitest run packages/adapters/src/clerk.test.ts`

Expected: FAIL because `./clerk.js` cannot be resolved or exported functions do not exist.

- [ ] **Step 3: Implement the Clerk planner**

Create `packages/adapters/src/clerk.ts` with these exported concepts:

```ts
import type { EnvironmentName } from "@agentstack/core";

import type { ProviderOperation } from "./provider-operations.js";

export type ClerkCommandKind =
  | "auth.bootstrap"
  | "auth.diagnostics"
  | "auth.env.pull"
  | "auth.config.pull"
  | "auth.production.status"
  | "env.pull";

export type ClerkCliCommand = {
  id: string;
  kind: ClerkCommandKind;
  environment: EnvironmentName;
  summary: string;
  args: string[];
  valueSource?: "clerk-dashboard";
  stdinLabel?: string;
  secret: boolean;
  requiresConfirmation: boolean;
};

export type ClerkTarget = {
  environment: EnvironmentName;
  clerkEnvironment: "development" | "production";
  applicationSelector: string;
  bootstrapCommand: ClerkCliCommand;
  diagnosticsCommand: ClerkCliCommand;
  envPullCommand: ClerkCliCommand;
  configPullCommand: ClerkCliCommand;
  productionStatusCommand?: ClerkCliCommand;
  requiredEnv: string[];
  warnings: string[];
  requiresConfirmation: boolean;
};

export type ClerkCommandPlanInput = {
  environment: EnvironmentName;
  operations: ProviderOperation[];
  includeBootstrap?: boolean;
};

export type ClerkCommandPlan = {
  service: "clerk";
  environment: EnvironmentName;
  target: ClerkTarget;
  commands: ClerkCliCommand[];
};
```

Implement behavior:

- `createClerkTarget("development" | "preview")` returns `clerkEnvironment: "development"`, `applicationSelector: "<clerk-development-application>"`, no required env, no confirmation.
- `createClerkTarget("production")` returns `clerkEnvironment: "production"`, `applicationSelector: "<clerk-production-application>"`, `requiredEnv: ["CLERK_SECRET_KEY"]`, confirmation required.
- Always include warnings for Clerk CLI login/project linkage and Billing beta/webhook review.
- `createClerkCommandPlan({ includeBootstrap: true })` emits bootstrap, diagnostics, env pull, config pull, optional production status, then one `env.pull` command per Clerk env operation.
- Do not encode literal secret values in command args or summaries.

- [ ] **Step 4: Promote and export Clerk command-plan status**

Change `providerAdapterDefinitions.clerk.realAdapterStatus` to `"command-plan"` and export `./clerk.js` from `packages/adapters/src/index.ts`.

- [ ] **Step 5: Run adapter tests to verify GREEN**

Run: `pnpm vitest run packages/adapters/src/clerk.test.ts packages/adapters/src/provider-operations.test.ts`

Expected: PASS.

### Task 2: CLI Integration

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Write the failing CLI tests**

Add tests near the existing Convex/Vercel provider plan tests:

```ts
it("prints redacted Clerk provider command plans", async () => {
  const manifest = createDefaultManifest("acme-crm");
  manifest.environments = ["preview"];
  manifest.surfaces = ["web"];
  manifest.env.custom.CLERK_SECRET_KEY = {
    surfaces: ["web"],
    environments: ["preview"],
    required: true,
    secret: true
  };
  await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeLocalEnvValues({
    preview: { web: { CLERK_SECRET_KEY: "sk_test_local_should_not_print" } }
  });

  const code = await runAgentstack(["provider", "plan", "--service", "clerk", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output).toContain("PLAN provider clerk preview");
  expect(output.join("\n")).toContain("Target: <clerk-development-application>");
  expect(output.join("\n")).toContain("pnpm exec clerk init -y");
  expect(output.join("\n")).toContain("pnpm exec clerk doctor --mode agent");
  expect(output.join("\n")).toContain("pnpm exec clerk env pull --mode agent");
  expect(output.join("\n")).toContain("CLERK_SECRET_KEY: <value from Clerk Dashboard / clerk env pull>");
  expect(output.join("\n")).not.toContain("sk_test_local_should_not_print");
});

it("prints explicit confirmation requirements for production Clerk provider plans", async () => {
  const code = await runAgentstack(["provider", "plan", "--service", "clerk", "--env", "production"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output).toContain("PLAN provider clerk production");
  expect(output.join("\n")).toContain("Required env: CLERK_SECRET_KEY");
  expect(output.join("\n")).toContain("Requires confirmation: yes");
  expect(output.join("\n")).toContain(
    "- auth.production.status [requires-confirmation] pnpm exec clerk deploy --mode agent"
  );
});
```

Update existing adapter status expectations from `clerk:contract-only` to `clerk:command-plan`.

Update the unsupported-service test to use `eas` instead of `clerk`.

- [ ] **Step 2: Run CLI tests to verify RED**

Run: `pnpm vitest run packages/cli/src/run.test.ts --testNamePattern "Clerk provider|provider plan|project lifecycle state|unsynced preview inspection"`

Expected: FAIL because CLI still rejects Clerk plans or status snapshots still expect old text.

- [ ] **Step 3: Implement CLI routing**

Change `packages/cli/src/run.ts`:

- Import `createClerkCommandPlan`.
- Accept `service === "clerk"` in `providerPlanCommand`.
- Build Clerk plans with `{ environment, operations: providerOperationPlan.operations, includeBootstrap: true }`.
- Update unsupported diagnostic message to "Clerk, Convex, and Vercel provider command planners are available in this slice."
- Update `formatProviderPlanTarget()` type to include `applicationSelector?: string` and prefer it before fallback.
- Update `formatProviderCommandTargetLabel()` so `env.pull` labels the final env name when present.

- [ ] **Step 4: Run CLI tests to verify GREEN**

Run: `pnpm vitest run packages/cli/src/run.test.ts --testNamePattern "Clerk provider|provider plan|project lifecycle state|unsynced preview inspection"`

Expected: PASS.

### Task 3: Generated Template Scripts And Docs

**Files:**
- Modify: `packages/create-agent-stack/templates/b2b-saas/package.json`
- Modify: `templates/b2b-saas/package.json`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/auth.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/billing.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/environments.md`
- Modify: `templates/b2b-saas/docs/agentstack/auth.md`
- Modify: `templates/b2b-saas/docs/agentstack/billing.md`
- Modify: `templates/b2b-saas/docs/agentstack/environments.md`

- [ ] **Step 1: Write the failing generator test**

Modify `packages/create-agent-stack/src/generate.test.ts` to assert generated `package.json` includes:

```ts
expect(packageJson.devDependencies.clerk).toBeDefined();
expect(packageJson.scripts["provider:clerk:preview"]).toBe(
  "node scripts/agentstack.mjs provider plan --service clerk --env preview"
);
expect(packageJson.scripts["provider:clerk:production"]).toBe(
  "node scripts/agentstack.mjs provider plan --service clerk --env production"
);
```

- [ ] **Step 2: Run generator test to verify RED**

Run: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts`

Expected: FAIL because the template lacks Clerk CLI dependency and scripts.

- [ ] **Step 3: Add Clerk template scripts and docs**

In both template `package.json` files:

```json
"devDependencies": {
  "clerk": "^0.0.0",
  "convex": "^1.41.0",
  "vercel": "^54.14.5"
}
```

Use the real current `clerk` version from the lockfile or package manager instead of `^0.0.0`.

Add scripts:

```json
"provider:clerk:preview": "node scripts/agentstack.mjs provider plan --service clerk --env preview",
"provider:clerk:production": "node scripts/agentstack.mjs provider plan --service clerk --env production"
```

Update auth docs to explain `pnpm provider:clerk:preview`, `pnpm provider:clerk:production`, `clerk init -y`, `clerk doctor --mode agent`, and `clerk env pull --mode agent`.

Update billing docs to warn Clerk Billing webhooks are beta and that Agentstack exposes billing webhook commands as inspection/coordination until the Clerk provider apply layer is implemented.

Update environments docs to mention Clerk publishable/secret keys and webhook signing secrets stay provider-owned and must be synchronized through the Clerk plan rather than pasted into generated source.

- [ ] **Step 4: Run generator test to verify GREEN**

Run: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts`

Expected: PASS.

### Task 4: Full Slice Verification And Commit

**Files:**
- Inspect all changed files.
- No new production files beyond the task list unless required by tests.

- [ ] **Step 1: Run focused provider tests**

Run: `pnpm vitest run packages/adapters/src/clerk.test.ts packages/adapters/src/provider-operations.test.ts packages/cli/src/run.test.ts packages/create-agent-stack/src/generate.test.ts`

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

- [ ] **Step 3: Review source citations and docs freshness**

Verify local docs mention Clerk CLI in bounded command-plan terms only. Do not claim real apply/provision for Clerk yet.

- [ ] **Step 4: Commit**

Run:

```bash
git status --short
git add packages/adapters/src/clerk.ts packages/adapters/src/clerk.test.ts packages/adapters/src/provider-operations.ts packages/adapters/src/index.ts packages/cli/src/run.ts packages/cli/src/run.test.ts packages/create-agent-stack/src/generate.test.ts packages/create-agent-stack/templates/b2b-saas/package.json packages/create-agent-stack/templates/b2b-saas/docs/agentstack/auth.md packages/create-agent-stack/templates/b2b-saas/docs/agentstack/billing.md packages/create-agent-stack/templates/b2b-saas/docs/agentstack/environments.md templates/b2b-saas/package.json templates/b2b-saas/docs/agentstack/auth.md templates/b2b-saas/docs/agentstack/billing.md templates/b2b-saas/docs/agentstack/environments.md docs/superpowers/plans/2026-06-21-agentstack-clerk-command-plan-adapter.md pnpm-lock.yaml
git commit -m "feat: add clerk command plan adapter"
```

Expected: commit succeeds and `git status --short` is clean afterward.

## Self-Review

- Spec coverage: The plan implements Clerk as a command-plan provider, adds CLI rendering, generated scripts, docs, tests, and lockfile/template updates. It does not implement mutation/apply, which matches the bounded provider-wrapper slice.
- Placeholder scan: No `TBD`, `TODO`, or "implement later" instructions remain; the `^0.0.0` marker is explicitly an instruction to replace with a discovered package version.
- Type consistency: `ClerkCommandPlan`, `ClerkTarget`, and CLI formatter names match the planned imports and tests.
