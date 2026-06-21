# Agentstack Convex Command-Plan Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first real-provider integration surface by wrapping Convex CLI deploy/env command planning behind Agentstack.

**Architecture:** This slice is plan-only, not mutation. The adapters package owns a Convex command planner that translates provider operations and environment targets into redacted `pnpm exec convex ...` commands. The CLI exposes that through `agentstack provider plan --service convex --env <env>`, while local-cloud remains the only apply path until credentialed provider mutation has a dedicated safety model.

**Tech Stack:** TypeScript, Vitest, existing `@agentstack/adapters` provider-operation contracts, existing CLI lifecycle/env value loading, generated B2B SaaS docs and scripts.

**Primary Convex references checked on 2026-06-21:**
- Convex CLI deploy target selection: https://docs.convex.dev/cli/reference/deploy
- Convex env command options: https://docs.convex.dev/cli/reference/env
- Convex preview deployments and deploy keys: https://docs.convex.dev/production/multiple-deployments
- Convex project configuration and `.env.local` behavior: https://docs.convex.dev/production/project-configuration

---

## File Structure

- Create `packages/adapters/src/convex.ts` for Convex command-plan types and pure planning helpers.
- Create `packages/adapters/src/convex.test.ts` for target selection, command generation, redaction, and production confirmation behavior.
- Modify `packages/adapters/src/provider-operations.ts` and tests to support `realAdapterStatus: "command-plan"` for Convex.
- Modify `packages/adapters/src/index.ts` to export the Convex planner.
- Modify `packages/core/src/lifecycle.ts` and tests so lifecycle provider adapter summaries allow `command-plan`.
- Modify `packages/cli/src/run.ts` and tests to add `agentstack provider plan --service convex --env <env>`.
- Modify `templates/b2b-saas/package.json` and mirrored create template scripts to expose `provider:convex:preview` and `provider:convex:production`.
- Modify generated docs and README to describe Convex command-plan status and the no-raw-values command output contract.
- Optionally update `docs/spinup-site/architecture.html` if the spin-up site mentions provider status.

## Task 1: Convex Planner Types And Tests

**Files:**
- Create: `packages/adapters/src/convex.ts`
- Create: `packages/adapters/src/convex.test.ts`
- Modify: `packages/adapters/src/index.ts`

- [x] **Step 1: Write failing tests for Convex environment targets**

Create `packages/adapters/src/convex.test.ts` with tests that import:

```ts
import { createDefaultManifest } from "@agentstack/core";
import { describe, expect, it } from "vitest";
import { createConvexCommandPlan, createConvexTarget } from "./convex.js";
```

Add tests:

```ts
it("plans preview target commands with preview deploy key requirements", () => {
  const manifest = createDefaultManifest("acme-crm");
  const target = createConvexTarget(manifest, "preview");

  expect(target).toEqual(
    expect.objectContaining({
      environment: "preview",
      previewName: "acme-crm-preview",
      deploymentSelector: "<preview-deployment-name>",
      requiredEnv: ["CONVEX_DEPLOY_KEY"],
      requiresConfirmation: false
    })
  );
  expect(target.deployCommand.args).toEqual([
    "pnpm",
    "exec",
    "convex",
    "deploy",
    "--preview-name",
    "acme-crm-preview"
  ]);
});

it("plans production target commands with confirmation", () => {
  const manifest = createDefaultManifest("acme-crm");
  const target = createConvexTarget(manifest, "production");

  expect(target.deploymentSelector).toBe("prod");
  expect(target.requiredEnv).toEqual(["CONVEX_DEPLOY_KEY"]);
  expect(target.requiresConfirmation).toBe(true);
  expect(target.envScopeArgs).toEqual(["--prod"]);
  expect(target.deployCommand.args).toEqual(["pnpm", "exec", "convex", "deploy"]);
});
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/convex.test.ts
```

Expected: fail because `./convex.js` does not exist.

- [x] **Step 2: Write failing tests for command planning and redaction**

In the same test file, add:

```ts
it("plans backend deploy and redacted env commands for Convex operations", () => {
  const manifest = createDefaultManifest("acme-crm");
  const plan = createConvexCommandPlan({
    manifest,
    environment: "preview",
    operations: [
      {
        id: "preview.convex.env.set.convex.OPENAI_API_KEY",
        environment: "preview",
        service: "convex",
        kind: "env.set",
        scope: "convex",
        target: "env:OPENAI_API_KEY",
        summary: "Set OPENAI_API_KEY for convex convex in preview.",
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
        summary: "Set PUBLIC_URL for vercel web in preview.",
        secret: false,
        requiresConfirmation: false
      }
    ],
    includeDeploy: true
  });

  expect(plan.commands.map((command) => command.kind)).toEqual(["backend.deploy", "env.set"]);
  expect(plan.commands[0]?.args).toEqual([
    "pnpm",
    "exec",
    "convex",
    "deploy",
    "--preview-name",
    "acme-crm-preview"
  ]);
  expect(plan.commands[1]).toEqual(
    expect.objectContaining({
      id: "preview.convex.env.set.convex.OPENAI_API_KEY",
      kind: "env.set",
      valueSource: "stdin",
      stdinLabel: "<secret from .agentstack/env-values.json>"
    })
  );
  expect(plan.commands[1]?.args).toEqual([
    "pnpm",
    "exec",
    "convex",
    "env",
    "set",
    "OPENAI_API_KEY",
    "--deployment",
    "<preview-deployment-name>"
  ]);
  expect(JSON.stringify(plan)).not.toContain("sk-");
});
```

Run the same test command. Expected: fail until the planner exists.

- [x] **Step 3: Implement Convex planner types**

Create `packages/adapters/src/convex.ts` with:

```ts
import type { AgentstackManifest, EnvironmentName } from "@agentstack/core";
import type { ProviderOperation } from "./provider-operations.js";

export type ConvexCommandKind = "backend.deploy" | "env.set" | "env.remove";

export type ConvexCliCommand = {
  id: string;
  kind: ConvexCommandKind;
  environment: EnvironmentName;
  summary: string;
  args: string[];
  valueSource?: "stdin";
  stdinLabel?: string;
  secret: boolean;
  requiresConfirmation: boolean;
};

export type ConvexTarget = {
  environment: EnvironmentName;
  deploymentSelector: string;
  previewName?: string;
  envScopeArgs: string[];
  deployCommand: ConvexCliCommand;
  requiredEnv: string[];
  warnings: string[];
  requiresConfirmation: boolean;
};

export type ConvexCommandPlanInput = {
  manifest: AgentstackManifest;
  environment: EnvironmentName;
  operations: ProviderOperation[];
  includeDeploy?: boolean;
};

export type ConvexCommandPlan = {
  service: "convex";
  environment: EnvironmentName;
  target: ConvexTarget;
  commands: ConvexCliCommand[];
};
```

- [x] **Step 4: Implement target and command planning**

Implement:

```ts
export function createConvexTarget(manifest: AgentstackManifest, environment: EnvironmentName): ConvexTarget {
  if (environment === "preview") {
    const previewName = `${manifest.app.slug}-preview`;
    return {
      environment,
      deploymentSelector: "<preview-deployment-name>",
      previewName,
      envScopeArgs: ["--deployment", "<preview-deployment-name>"],
      deployCommand: deployCommand(environment, ["pnpm", "exec", "convex", "deploy", "--preview-name", previewName], false),
      requiredEnv: ["CONVEX_DEPLOY_KEY"],
      warnings: [
        "Set CONVEX_DEPLOY_KEY to a Convex preview deploy key before running preview deploy commands.",
        "Replace <preview-deployment-name> after the preview deployment exists."
      ],
      requiresConfirmation: false
    };
  }

  if (environment === "production") {
    return {
      environment,
      deploymentSelector: "prod",
      envScopeArgs: ["--prod"],
      deployCommand: deployCommand(environment, ["pnpm", "exec", "convex", "deploy"], true),
      requiredEnv: ["CONVEX_DEPLOY_KEY"],
      warnings: ["Set CONVEX_DEPLOY_KEY to a Convex production deploy key before running production commands."],
      requiresConfirmation: true
    };
  }

  return {
    environment,
    deploymentSelector: "dev",
    envScopeArgs: ["--deployment", "dev"],
    deployCommand: deployCommand(environment, ["pnpm", "exec", "convex", "dev"], false),
    requiredEnv: [],
    warnings: ["Development uses the developer's Convex login or local CONVEX_DEPLOYMENT state."],
    requiresConfirmation: false
  };
}
```

Implement `createConvexCommandPlan` so it:

- Includes `target.deployCommand` when `includeDeploy` is true.
- Filters operations to `service === "convex"`.
- Converts `env.set` to `pnpm exec convex env ...target.envScopeArgs set <NAME>`.
- Converts `env.remove` to `pnpm exec convex env ...target.envScopeArgs remove <NAME>`.
- Uses `valueSource: "stdin"` and `stdinLabel: "<secret from .agentstack/env-values.json>"` for secret env sets.
- Uses `stdinLabel: "<value from .agentstack/env-values.json>"` for non-secret env sets.
- Never includes raw values or value hashes.

- [x] **Step 5: Export and verify**

Modify `packages/adapters/src/index.ts`:

```ts
export * from "./convex.js";
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/convex.test.ts
pnpm typecheck
```

Expected: tests and typecheck pass.

## Task 2: Provider Status And CLI Provider Plan

**Files:**
- Modify: `packages/adapters/src/provider-operations.ts`
- Modify: `packages/adapters/src/provider-operations.test.ts`
- Modify: `packages/core/src/lifecycle.ts`
- Modify: `packages/core/src/lifecycle.test.ts`
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [x] **Step 1: Write failing tests for Convex command-plan status**

Update `packages/adapters/src/provider-operations.test.ts`:

```ts
expect(providerAdapterDefinitions.convex.realAdapterStatus).toBe("command-plan");
expect(providerAdapterDefinitions.clerk.realAdapterStatus).toBe("contract-only");
```

Update lifecycle/CLI tests to expect:

```text
Provider adapters: clerk:contract-only,convex:command-plan,vercel:contract-only,eas:contract-only
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/provider-operations.test.ts packages/core/src/lifecycle.test.ts packages/cli/src/run.test.ts
```

Expected: fail because status only allows `contract-only | available`.

- [x] **Step 2: Add `command-plan` status type**

In `packages/adapters/src/provider-operations.ts`, add:

```ts
export type ProviderAdapterStatus = "contract-only" | "command-plan" | "available";
```

Use it in `ProviderAdapterDefinition.realAdapterStatus`, and set Convex to `"command-plan"`.

In `packages/core/src/lifecycle.ts`, allow the same status in `LifecycleProviderAdapterSummary.realAdapterStatus`.

- [x] **Step 3: Write failing CLI provider plan tests**

In `packages/cli/src/run.test.ts`, add:

```ts
it("prints redacted Convex provider command plans", async () => {
  await writeProviderEnvManifest();
  await writeLocalEnvValues({
    preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
  });

  const code = await runAgentstack(["provider", "plan", "--service", "convex", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output).toContain("PLAN provider convex preview");
  expect(output.join("\n")).toContain("Required env: CONVEX_DEPLOY_KEY");
  expect(output.join("\n")).toContain("pnpm exec convex deploy --preview-name acme-crm-preview");
  expect(output.join("\n")).toContain("pnpm exec convex env --deployment <preview-deployment-name> set OPENAI_API_KEY");
  expect(output.join("\n")).toContain("<secret from .agentstack/env-values.json>");
  expect(output.join("\n")).not.toContain("sk-local-provider-value");
});

it("rejects provider plan for unsupported services", async () => {
  const code = await runAgentstack(["provider", "plan", "--service", "vercel", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(1);
  expect(output.join("\n")).toContain("FAIL provider.service.unsupported");
});
```

Run:

```bash
pnpm exec vitest run packages/cli/src/run.test.ts
```

Expected: fail because `provider plan` is not implemented.

- [x] **Step 4: Implement `agentstack provider plan`**

In `packages/cli/src/run.ts`:

- Import `createConvexCommandPlan`.
- Route `command === "provider" && subcommand === "plan"` to `providerPlanCommand(rest, io)`.
- Parse `--service` and `--env`.
- Reject non-Convex services with diagnostic:

```ts
{
  severity: "fail",
  code: "provider.service.unsupported",
  path: String(options.service ?? "missing"),
  message: "Only the Convex provider command planner is available in this slice.",
  fix: "Run agentstack provider plan --service convex --env preview.",
  blocks: ["provider plan"]
}
```

- Run local validation and stop on failures.
- Inspect local-cloud state using `LocalCloudAdapter`.
- Build provider operations with `createProviderOperationPlan`.
- Build the Convex command plan with `includeDeploy: true`.
- Print:

```text
PLAN provider convex preview
Target: <preview-deployment-name>
Required env: CONVEX_DEPLOY_KEY
Warnings:
- ...
Commands:
- backend.deploy: pnpm exec convex deploy --preview-name acme-crm-preview
- env.set OPENAI_API_KEY: <secret from .agentstack/env-values.json> | pnpm exec convex env --deployment <preview-deployment-name> set OPENAI_API_KEY
```

- Record telemetry event `agentstack.provider.plan.completed` with redacted state only.

- [x] **Step 5: Verify focused CLI/status tests**

Run:

```bash
pnpm exec vitest run packages/adapters/src/convex.test.ts packages/adapters/src/provider-operations.test.ts packages/core/src/lifecycle.test.ts packages/cli/src/run.test.ts
pnpm typecheck
```

Expected: tests and typecheck pass.

## Task 3: Generated Scripts, Docs, Review, And Commit

**Files:**
- Modify: `templates/b2b-saas/package.json`
- Modify: `packages/create-agent-stack/templates/b2b-saas/package.json`
- Modify: `README.md`
- Modify: `templates/b2b-saas/docs/agentstack/preview.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/preview.md`
- Modify: `templates/b2b-saas/docs/agentstack/environments.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/environments.md`
- Modify: `docs/spinup-site/architecture.html`

- [x] **Step 1: Add generated scripts**

Add to both template `package.json` files:

```json
"provider:convex:preview": "node scripts/agentstack.mjs provider plan --service convex --env preview",
"provider:convex:production": "node scripts/agentstack.mjs provider plan --service convex --env production"
```

Add the Convex package so planned `pnpm exec convex ...` commands resolve locally:

```json
"devDependencies": {
  "convex": "^1.41.0"
}
```

- [x] **Step 2: Update docs**

Document:

- `convex:command-plan` means Agentstack now knows current Convex CLI deploy/env command shapes, but still does not execute provider mutations.
- Preview deploy planning uses `CONVEX_DEPLOY_KEY` and `pnpm exec convex deploy --preview-name <app-slug>-preview`.
- Production deploy planning uses `CONVEX_DEPLOY_KEY`, `pnpm exec convex deploy`, and marks production confirmation as required for the future provider apply slice.
- Env set/remove command output is redacted and uses `.agentstack/env-values.json` as the value source label.
- Env set/remove command output uses canonical Convex env option placement such as `pnpm exec convex env --deployment <preview-deployment-name> set OPENAI_API_KEY`.
- Preview env commands include `<preview-deployment-name>` until a concrete Convex preview deployment exists.

- [x] **Step 3: Verify docs and templates**

Run:

```bash
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
git diff --check
node --check docs/spinup-site/assets/site.js
```

Expected: all commands exit 0.

- [x] **Step 4: Run final gate**

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

Fresh evidence:

- `npm view convex version` returned `1.41.0`.
- Review-fix red tests failed before implementation for canonical Convex env ordering, production confirmation output, and missing generated Convex dependency.
- `pnpm exec vitest run packages/adapters/src/convex.test.ts packages/cli/src/run.test.ts packages/create-agent-stack/src/generate.test.ts` exited 0: 3 files, 125 tests passed.
- `pnpm install --frozen-lockfile` exited 0.
- `pnpm typecheck` exited 0.
- `pnpm test` exited 0: 20 files, 244 tests passed.
- `diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas` exited 0.
- `git diff --check` exited 0.
- `node --check docs/spinup-site/assets/site.js` exited 0.
- `curl -fsS http://127.0.0.1:8765/index.html >/tmp/agentstack-site-index.html` exited 0.
- Spec review: no spec compliance issues.
- Integration re-review: no remaining code quality or integration issues.

- [x] **Step 5: Review and commit**

Run final subagent quality review, fix all blocking findings, rerun the relevant gate, then commit:

```bash
git status --short
git add README.md docs packages templates
git commit -m "feat: add convex command plan adapter"
git status --short
```

Expected: commit succeeds and worktree is clean.

Commit evidence: committed with message `feat: add convex command plan adapter`.
