# Agentstack Vercel Command-Plan Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Vercel command-plan adapter so Agentstack can plan web deploy and web env commands through the same provider boundary as Convex.

**Architecture:** The adapters package owns pure Vercel command planning. Provider operation planning gains optional source metadata so Vercel can map missing env resources to `vercel env add`, drifted env resources to `vercel env update`, and stale env resources to `vercel env rm`. The CLI extends `agentstack provider plan` to support both Convex and Vercel, still printing redacted commands only and never executing provider mutations.

**Tech Stack:** TypeScript, Vitest, existing provider-operation contracts, Vercel CLI command planning, generated B2B SaaS docs/scripts.

**Primary Vercel references checked on 2026-06-21:**
- Vercel env commands: https://vercel.com/docs/cli/env
- Vercel deploy command: https://vercel.com/docs/cli/deploy
- Vercel project linking: https://vercel.com/docs/cli/project-linking

---

## File Structure

- Create `packages/adapters/src/vercel.ts` for Vercel command-plan types and pure planning helpers.
- Create `packages/adapters/src/vercel.test.ts` for target selection, add/update/remove env mapping, deploy command planning, redaction, and confirmation behavior.
- Modify `packages/adapters/src/provider-operations.ts` and tests to add optional operation source metadata and set Vercel to `command-plan`.
- Modify `packages/adapters/src/index.ts` to export the Vercel planner.
- Modify `packages/core/src/lifecycle.test.ts` only if provider status fixture expectations need Vercel updated.
- Modify `packages/cli/src/run.ts` and tests to route `agentstack provider plan --service vercel --env <env>`.
- Modify `templates/b2b-saas/package.json` and mirrored create template package scripts/dependencies.
- Modify generated docs, README, and spin-up site to explain `vercel:command-plan`.

## Task 1: Provider Operation Source Metadata

**Files:**
- Modify: `packages/adapters/src/provider-operations.ts`
- Modify: `packages/adapters/src/provider-operations.test.ts`

- [x] **Step 1: Write failing test for operation sources**

Update `packages/adapters/src/provider-operations.test.ts` so the operation planning test asserts source metadata:

```ts
expect(plan.operations).toContainEqual(
  expect.objectContaining({
    id: "preview.vercel.env.set.web.STRIPE_MODE",
    source: "env.missing"
  })
);
expect(plan.operations).toContainEqual(
  expect.objectContaining({
    id: "preview.eas.env.set.mobile.API_URL",
    source: "env.drifted"
  })
);
expect(plan.operations).toContainEqual(
  expect.objectContaining({
    id: "preview.convex.env.remove.convex.LEGACY_FLAG",
    source: "env.stale"
  })
);
```

Also assert Vercel command-plan status:

```ts
expect(providerAdapterDefinitions.vercel.realAdapterStatus).toBe("command-plan");
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/provider-operations.test.ts
```

Expected: fail because `source` does not exist and Vercel is still `contract-only`.

- [x] **Step 2: Add source metadata**

In `packages/adapters/src/provider-operations.ts`, add:

```ts
export type ProviderOperationSource =
  | "service.missing"
  | "service.stale"
  | "env.missing"
  | "env.drifted"
  | "env.stale";
```

Add `source: ProviderOperationSource` to `ProviderOperation`.

Set sources in `createProviderOperationPlan`:

```ts
...report.missing.map((resource) =>
  serviceOperation(report.environment, "service.link", "service.missing", resource)
),
...report.stale.map((resource) =>
  serviceOperation(report.environment, "service.unlink", "service.stale", resource)
),
...report.missingEnv.map((resource) =>
  envOperation(report.environment, "env.set", "env.missing", resource)
),
...report.driftedEnv.map((resource) =>
  envOperation(report.environment, "env.set", "env.drifted", resource)
),
...report.staleEnv.map((resource) =>
  envOperation(report.environment, "env.remove", "env.stale", resource)
)
```

Set Vercel `realAdapterStatus: "command-plan"`.

- [x] **Step 3: Verify source metadata**

Run:

```bash
pnpm exec vitest run packages/adapters/src/provider-operations.test.ts packages/adapters/src/convex.test.ts packages/core/src/lifecycle.test.ts
pnpm typecheck
```

Expected: tests and typecheck pass.

## Task 2: Vercel Command Planner

**Files:**
- Create: `packages/adapters/src/vercel.ts`
- Create: `packages/adapters/src/vercel.test.ts`
- Modify: `packages/adapters/src/index.ts`

- [x] **Step 1: Write failing tests for Vercel targets**

Create `packages/adapters/src/vercel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createVercelCommandPlan, createVercelTarget } from "./vercel.js";
```

Add:

```ts
it("plans preview and production deploy targets", () => {
  expect(createVercelTarget("preview")).toEqual(
    expect.objectContaining({
      environment: "preview",
      vercelEnvironment: "preview",
      requiredEnv: ["VERCEL_TOKEN"],
      requiresConfirmation: false,
      deployCommand: expect.objectContaining({
        args: ["pnpm", "exec", "vercel", "deploy", "--target=preview"]
      })
    })
  );

  expect(createVercelTarget("production")).toEqual(
    expect.objectContaining({
      environment: "production",
      vercelEnvironment: "production",
      requiredEnv: ["VERCEL_TOKEN"],
      requiresConfirmation: true,
      deployCommand: expect.objectContaining({
        args: ["pnpm", "exec", "vercel", "--prod"]
      })
    })
  );
});
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/vercel.test.ts
```

Expected: fail because `./vercel.js` does not exist.

- [x] **Step 2: Write failing tests for env add/update/remove mapping**

Add:

```ts
it("maps missing, drifted, and stale Vercel env operations to documented CLI commands", () => {
  const plan = createVercelCommandPlan({
    environment: "preview",
    operations: [
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
      },
      {
        id: "preview.vercel.env.set.web.API_TOKEN",
        environment: "preview",
        service: "vercel",
        kind: "env.set",
        scope: "web",
        target: "env:API_TOKEN",
        source: "env.drifted",
        summary: "Set API_TOKEN for vercel web in preview.",
        secret: true,
        requiresConfirmation: false
      },
      {
        id: "preview.vercel.env.remove.web.LEGACY_FLAG",
        environment: "preview",
        service: "vercel",
        kind: "env.remove",
        scope: "web",
        target: "env:LEGACY_FLAG",
        source: "env.stale",
        summary: "Remove LEGACY_FLAG for vercel web in preview.",
        secret: false,
        requiresConfirmation: false
      },
      {
        id: "preview.convex.env.set.convex.OPENAI_API_KEY",
        environment: "preview",
        service: "convex",
        kind: "env.set",
        scope: "convex",
        target: "env:OPENAI_API_KEY",
        source: "env.missing",
        summary: "Set OPENAI_API_KEY for convex convex in preview.",
        secret: true,
        requiresConfirmation: false
      }
    ],
    includeDeploy: true
  });

  expect(plan.commands.map((command) => command.kind)).toEqual([
    "web.deploy",
    "env.add",
    "env.update",
    "env.remove"
  ]);
  expect(plan.commands[1]).toEqual(
    expect.objectContaining({
      valueSource: "stdin",
      stdinLabel: "<value from .agentstack/env-values.json>",
      args: ["pnpm", "exec", "vercel", "env", "add", "PUBLIC_URL", "preview"]
    })
  );
  expect(plan.commands[2]).toEqual(
    expect.objectContaining({
      valueSource: "stdin",
      stdinLabel: "<secret from .agentstack/env-values.json>",
      args: ["pnpm", "exec", "vercel", "env", "update", "API_TOKEN", "preview", "--sensitive"]
    })
  );
  expect(plan.commands[3]?.args).toEqual([
    "pnpm",
    "exec",
    "vercel",
    "env",
    "rm",
    "LEGACY_FLAG",
    "preview"
  ]);
  expect(JSON.stringify(plan)).not.toContain("sk-");
});
```

- [x] **Step 3: Implement Vercel planner types**

Create `packages/adapters/src/vercel.ts`:

```ts
import type { EnvironmentName } from "@agentstack/core";
import type { ProviderOperation } from "./provider-operations.js";

export type VercelCommandKind = "web.deploy" | "env.add" | "env.update" | "env.remove";

export type VercelCliCommand = {
  id: string;
  kind: VercelCommandKind;
  environment: EnvironmentName;
  summary: string;
  args: string[];
  valueSource?: "stdin";
  stdinLabel?: string;
  secret: boolean;
  requiresConfirmation: boolean;
};

export type VercelTarget = {
  environment: EnvironmentName;
  vercelEnvironment: "development" | "preview" | "production";
  deployCommand: VercelCliCommand;
  requiredEnv: string[];
  warnings: string[];
  requiresConfirmation: boolean;
};

export type VercelCommandPlanInput = {
  environment: EnvironmentName;
  operations: ProviderOperation[];
  includeDeploy?: boolean;
};

export type VercelCommandPlan = {
  service: "vercel";
  environment: EnvironmentName;
  target: VercelTarget;
  commands: VercelCliCommand[];
};
```

- [x] **Step 4: Implement command mapping**

Implement:

- `createVercelTarget("preview")` returns `vercelEnvironment: "preview"`, deploy args `["pnpm", "exec", "vercel", "deploy", "--target=preview"]`, required env `["VERCEL_TOKEN"]`, warning to run `vercel link` or ensure `.vercel/project.json`.
- `createVercelTarget("production")` returns deploy args `["pnpm", "exec", "vercel", "--prod"]`, `requiresConfirmation: true`.
- `createVercelTarget("development")` returns deploy args `["pnpm", "exec", "vercel", "dev"]` and no confirmation.
- `createVercelCommandPlan` filters to `service === "vercel"`.
- `env.set` with `source === "env.drifted"` maps to `vercel env update`.
- Other `env.set` maps to `vercel env add`.
- `env.remove` maps to `vercel env rm`.
- Secret add/update commands include `--sensitive`.
- Env value commands use `valueSource: "stdin"` and redacted `stdinLabel`.

- [x] **Step 5: Export and verify**

Modify `packages/adapters/src/index.ts`:

```ts
export * from "./vercel.js";
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/vercel.test.ts packages/adapters/src/provider-operations.test.ts packages/adapters/src/convex.test.ts
pnpm typecheck
```

Expected: tests and typecheck pass.

## Task 3: CLI Provider Plan For Vercel

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [x] **Step 1: Write failing CLI tests**

In `packages/cli/src/run.test.ts`, add:

```ts
it("prints redacted Vercel provider command plans", async () => {
  const manifest = createDefaultManifest("acme-crm");
  manifest.environments = ["preview"];
  manifest.surfaces = ["web"];
  manifest.env.custom.PUBLIC_URL = {
    surfaces: ["web"],
    environments: ["preview"],
    required: true,
    secret: false
  };
  await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeLocalEnvValues({
    preview: { web: { PUBLIC_URL: "https://preview.example.test" } }
  });

  const code = await runAgentstack(["provider", "plan", "--service", "vercel", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output).toContain("PLAN provider vercel preview");
  expect(output.join("\n")).toContain("Required env: VERCEL_TOKEN");
  expect(output.join("\n")).toContain("pnpm exec vercel deploy --target=preview");
  expect(output.join("\n")).toContain("pnpm exec vercel env add PUBLIC_URL preview");
  expect(output.join("\n")).toContain("<value from .agentstack/env-values.json>");
  expect(output.join("\n")).not.toContain("https://preview.example.test");
});

it("prints explicit confirmation requirements for production Vercel provider plans", async () => {
  const code = await runAgentstack(["provider", "plan", "--service", "vercel", "--env", "production"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output).toContain("PLAN provider vercel production");
  expect(output.join("\n")).toContain("Requires confirmation: yes");
  expect(output.join("\n")).toContain("- web.deploy [requires-confirmation] pnpm exec vercel --prod");
});
```

Run:

```bash
pnpm exec vitest run packages/cli/src/run.test.ts
```

Expected: fail because `provider plan` only supports Convex.

- [x] **Step 2: Extend provider plan routing**

In `packages/cli/src/run.ts`:

- Import `createVercelCommandPlan`.
- Allow `service` to be `"convex"` or `"vercel"`.
- Keep unsupported-service diagnostics for all other services.
- Build provider operations once from local-cloud inspect.
- Dispatch to the matching planner.
- Print `PLAN provider <service> <env>`, `Target`, `Required env`, `Requires confirmation`, warnings, and commands using generic provider command formatting.
- For stdin commands, print `<VAR>: <label> | <command>`.
- Record telemetry event `agentstack.provider.plan.completed` with service, target, required env names, warning count, command kinds, `valueSource`, `secret`, and `requiresConfirmation` only.

- [x] **Step 3: Verify focused CLI tests**

Run:

```bash
pnpm exec vitest run packages/adapters/src/vercel.test.ts packages/cli/src/run.test.ts
pnpm typecheck
```

Expected: tests and typecheck pass.

## Task 4: Generated Scripts, Docs, Review, And Commit

**Files:**
- Modify: `templates/b2b-saas/package.json`
- Modify: `packages/create-agent-stack/templates/b2b-saas/package.json`
- Modify: `packages/create-agent-stack/src/generate.test.ts`
- Modify: `README.md`
- Modify: `templates/b2b-saas/docs/agentstack/preview.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/preview.md`
- Modify: `templates/b2b-saas/docs/agentstack/environments.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/environments.md`
- Modify: `docs/spinup-site/architecture.html`

- [x] **Step 1: Add generated scripts and dependency**

Add to both template `package.json` files:

```json
"provider:vercel:preview": "node scripts/agentstack.mjs provider plan --service vercel --env preview",
"provider:vercel:production": "node scripts/agentstack.mjs provider plan --service vercel --env production"
```

Add the Vercel package:

```json
"vercel": "^54.14.5"
```

Update `packages/create-agent-stack/src/generate.test.ts` to expect those scripts and `devDependencies.vercel`.

- [x] **Step 2: Update docs**

Document:

- `vercel:command-plan` means Agentstack can print current Vercel CLI deploy/env command shapes without executing provider mutations.
- Generated projects include the Vercel package so `pnpm exec vercel` resolves locally.
- Preview planning requires `VERCEL_TOKEN`, a linked Vercel project, and plans `pnpm exec vercel deploy --target=preview`.
- Production planning requires `VERCEL_TOKEN`, plans `pnpm exec vercel --prod`, and marks confirmation as required.
- Env add/update/remove command output is redacted and uses `.agentstack/env-values.json` as the value source label.

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

- `npm view vercel version` returned `54.14.5`.
- Focused red tests failed before implementation for Vercel provider-plan support.
- `pnpm exec vitest run packages/adapters/src/vercel.test.ts packages/adapters/src/provider-operations.test.ts packages/adapters/src/convex.test.ts packages/core/src/lifecycle.test.ts packages/cli/src/run.test.ts packages/create-agent-stack/src/generate.test.ts` exited 0: 6 files, 138 tests passed.
- `pnpm install --frozen-lockfile` exited 0.
- `pnpm typecheck` exited 0.
- `pnpm test` exited 0: 21 files, 248 tests passed.
- `diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas` exited 0.
- `git diff --check` exited 0.
- `node --check docs/spinup-site/assets/site.js` exited 0.
- `curl -fsS http://127.0.0.1:8765/index.html >/tmp/agentstack-site-index.html` exited 0.
- Spec review: no spec compliance issues.
- Code-quality review: no findings.

- [x] **Step 5: Review and commit**

Run final subagent quality review, fix all blocking findings, rerun the relevant gate, then commit:

```bash
git status --short
git add README.md docs packages templates
git commit -m "feat: add vercel command plan adapter"
git status --short
```

Expected: commit succeeds and worktree is clean.

Commit evidence: committed with message `feat: add vercel command plan adapter`.
