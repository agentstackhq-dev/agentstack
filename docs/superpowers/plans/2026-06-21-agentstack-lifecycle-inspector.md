# Agentstack Lifecycle Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add local `agentstack inspect`, `agentstack doctor`, and `agentstack dev` preflight commands so agents can quickly understand project state, validation health, and the next safe command without opening provider dashboards.

**Architecture:** Core owns a deterministic lifecycle summary contract assembled from the manifest, generated anchors, local env values, local validation diagnostics, and local-cloud inspection reports. The CLI formats that summary into agent-readable output and records command telemetry. Generated templates and the spin-up site teach agents to start with lifecycle inspection before editing or deploying.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, local-cloud adapter, generated B2B SaaS template, static spin-up docs.

---

## File Structure

- Create `packages/core/src/lifecycle.ts`: pure helpers that summarize manifest shape, generated anchor state, local validation result, per-environment local-cloud state, and recommended next commands.
- Create `packages/core/src/lifecycle.test.ts`: TDD coverage for healthy, missing-anchor, missing-cloud-link, and failed-validation reports.
- Modify `packages/core/src/index.ts`: export lifecycle helpers.
- Modify `packages/cli/src/run.ts`: route `inspect`, `doctor`, and `dev`; format lifecycle summaries; record telemetry.
- Modify `packages/cli/src/run.test.ts`: command behavior, diagnostics, telemetry, and actionable output tests.
- Modify `tests/e2e/prototype.test.ts`: generated workflow exercises lifecycle commands.
- Modify generated template mirrors:
  - `templates/b2b-saas/package.json`
  - `packages/create-agent-stack/templates/b2b-saas/package.json`
  - `templates/b2b-saas/AGENTS.md`
  - `packages/create-agent-stack/templates/b2b-saas/AGENTS.md`
  - `templates/b2b-saas/docs/agentstack/local-development.md`
  - `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/local-development.md`
  - `templates/b2b-saas/docs/agentstack/validation.md`
  - `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/validation.md`
- Modify docs:
  - `README.md`
  - `docs/spinup-site/workflows.html`
  - `docs/spinup-site/guardrails.html`
  - `docs/spinup-site/generated-app.html`
  - `docs/spinup-site/assets/site.js`

## Command Contract

`agentstack inspect [--env preview]`

- Always exits `0` unless project loading fails.
- Prints `PASS inspect <slug>`.
- Prints app, framework/guidance versions, environments, surfaces, enabled services, generated anchor counts, missing generated anchors, and local-cloud service state for the requested environment or preview by default.
- Emits `agentstack.inspect.completed` on the `agent-command` journey.

`agentstack doctor [--env preview]`

- Runs local validation and local-cloud validation for the selected environment.
- Prints `PASS doctor <env>` when no fail diagnostics exist.
- Prints `FAIL doctor <env>` and formatted diagnostics when failures exist.
- Prints a short next-command list, prioritizing exact repair commands already present on diagnostics.
- Emits `agentstack.doctor.completed` on the `validation` journey.

`agentstack dev [--env development|preview]`

- Runs the same preflight as `doctor`, but never mutates cloud state or starts real servers in this prototype.
- Prints `PASS dev preflight <env>` when local validation passes.
- Prints concrete commands an agent should run next, such as `pnpm run validate`, `pnpm run env:inspect`, `pnpm run sync:preview:apply`, `pnpm --filter @app/web dev`, and `pnpm --filter @app/mobile dev`.
- Prints `WARN dev cloud <env>` when local validation passes but local-cloud links are missing, with the sync command.
- Emits `agentstack.dev.preflight.completed` on the `agent-command` journey.

## Task 1: Core Lifecycle Summary

**Files:**
- Create: `packages/core/src/lifecycle.ts`
- Create: `packages/core/src/lifecycle.test.ts`
- Modify: `packages/core/src/index.ts`

- [x] **Step 1: Write failing core tests**

Add tests for:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import {
  createLifecycleSummary,
  recommendLifecycleCommands,
  type LifecycleCloudSummary
} from "./lifecycle.js";

describe("lifecycle summaries", () => {
  it("summarizes manifest, anchors, and healthy cloud state", () => {
    const manifest = createDefaultManifest("acme-crm");
    const cloud: LifecycleCloudSummary = {
      environment: "preview",
      expectedServices: ["clerk", "convex"],
      linkedServices: ["clerk", "convex"],
      missingServices: [],
      staleServices: []
    };

    const summary = createLifecycleSummary({
      manifest,
      environment: "preview",
      requiredAnchors: ["AGENTS.md", "package.json"],
      missingAnchors: [],
      diagnostics: [],
      cloud
    });

    expect(summary.status).toBe("pass");
    expect(summary.app.slug).toBe("acme-crm");
    expect(summary.generated.missing).toEqual([]);
    expect(summary.cloud?.linkedServices).toEqual(["clerk", "convex"]);
  });

  it("fails when validation diagnostics include failures", () => {
    const manifest = createDefaultManifest("acme-crm");
    const summary = createLifecycleSummary({
      manifest,
      environment: "preview",
      requiredAnchors: ["AGENTS.md"],
      missingAnchors: ["AGENTS.md"],
      diagnostics: [
        {
          severity: "fail",
          code: "template.anchor.missing",
          path: "AGENTS.md",
          message: "Required generated file is missing: AGENTS.md.",
          fix: "Restore the generated anchor.",
          blocks: ["validate"]
        }
      ]
    });

    expect(summary.status).toBe("fail");
    expect(summary.generated.missing).toEqual(["AGENTS.md"]);
  });

  it("recommends repair commands from diagnostics before generic next steps", () => {
    expect(
      recommendLifecycleCommands({
        environment: "preview",
        diagnostics: [
          {
            severity: "fail",
            code: "cloud.service.missing",
            message: "convex is not linked in preview.",
            fix: "Run agentstack sync --env preview --apply.",
            blocks: ["validate --cloud"]
          }
        ],
        cloudMissing: ["convex"]
      })
    ).toEqual(["agentstack sync --env preview --apply", "agentstack validate --cloud --env preview"]);
  });
});
```

- [x] **Step 2: Run core lifecycle tests and verify RED**

Run: `pnpm vitest run packages/core/src/lifecycle.test.ts`

Expected: FAIL because `packages/core/src/lifecycle.ts` does not exist.

- [x] **Step 3: Implement lifecycle helpers**

Create `packages/core/src/lifecycle.ts` with:

```ts
import type { Diagnostic } from "./diagnostics.js";
import type { AgentstackManifest, EnvironmentName, ServiceName, SurfaceName } from "./manifest.js";

export type LifecycleStatus = "pass" | "warn" | "fail";

export type LifecycleCloudSummary = {
  environment: EnvironmentName;
  expectedServices: Array<ServiceName | string>;
  linkedServices: Array<ServiceName | string>;
  missingServices: Array<ServiceName | string>;
  staleServices: Array<ServiceName | string>;
};

export type LifecycleSummary = {
  status: LifecycleStatus;
  environment: EnvironmentName;
  app: {
    name: string;
    slug: string;
    frameworkVersion: string;
    guidanceVersion: string;
  };
  surfaces: SurfaceName[];
  environments: EnvironmentName[];
  enabledServices: string[];
  generated: {
    required: number;
    missing: string[];
  };
  diagnostics: Diagnostic[];
  cloud?: LifecycleCloudSummary;
  nextCommands: string[];
};

export type CreateLifecycleSummaryInput = {
  manifest: AgentstackManifest;
  environment: EnvironmentName;
  requiredAnchors: string[];
  missingAnchors: string[];
  diagnostics: Diagnostic[];
  cloud?: LifecycleCloudSummary;
};

export function createLifecycleSummary(input: CreateLifecycleSummaryInput): LifecycleSummary {
  const failed = input.diagnostics.some((diagnostic) => diagnostic.severity === "fail");
  const warned =
    !failed &&
    (input.diagnostics.some((diagnostic) => diagnostic.severity === "warn") ||
      Boolean(input.cloud?.missingServices.length) ||
      Boolean(input.cloud?.staleServices.length));

  return {
    status: failed ? "fail" : warned ? "warn" : "pass",
    environment: input.environment,
    app: {
      name: input.manifest.app.name,
      slug: input.manifest.app.slug,
      frameworkVersion: input.manifest.frameworkVersion,
      guidanceVersion: input.manifest.guidanceVersion
    },
    surfaces: [...input.manifest.surfaces],
    environments: [...input.manifest.environments],
    enabledServices: Object.entries(input.manifest.services)
      .filter(([, service]) => service.enabled)
      .map(([name]) => name)
      .sort(),
    generated: {
      required: input.requiredAnchors.length,
      missing: [...input.missingAnchors].sort()
    },
    diagnostics: input.diagnostics,
    cloud: input.cloud,
    nextCommands: recommendLifecycleCommands({
      environment: input.environment,
      diagnostics: input.diagnostics,
      cloudMissing: input.cloud?.missingServices ?? []
    })
  };
}

export type RecommendLifecycleCommandsInput = {
  environment: EnvironmentName;
  diagnostics: Diagnostic[];
  cloudMissing: Array<ServiceName | string>;
};

export function recommendLifecycleCommands(input: RecommendLifecycleCommandsInput): string[] {
  const commands = new Set<string>();

  for (const diagnostic of input.diagnostics) {
    if (!diagnostic.fix?.startsWith("Run ")) {
      continue;
    }
    commands.add(stripTrailingPeriod(diagnostic.fix.slice(4)));
  }

  if (input.cloudMissing.length > 0) {
    commands.add(`agentstack sync --env ${input.environment} --apply`);
    commands.add(`agentstack validate --cloud --env ${input.environment}`);
  }

  commands.add("agentstack validate");
  commands.add(`agentstack env inspect --env ${input.environment}`);

  return Array.from(commands);
}

function stripTrailingPeriod(value: string): string {
  return value.endsWith(".") ? value.slice(0, -1) : value;
}
```

Modify `packages/core/src/index.ts`:

```ts
export * from "./lifecycle.js";
```

- [x] **Step 4: Run core lifecycle tests and verify GREEN**

Run: `pnpm vitest run packages/core/src/lifecycle.test.ts`

Expected: PASS.

## Task 2: CLI Lifecycle Commands

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`
- Modify: `tests/e2e/prototype.test.ts`

- [x] **Step 1: Write failing CLI tests**

Add tests proving:

```ts
it("inspects project lifecycle state", async () => {
  await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });

  const code = await runAgentstack(["inspect", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output).toContain("PASS inspect acme-crm");
  expect(output.join("\n")).toContain("Environment: preview");
  expect(output.join("\n")).toContain("Generated anchors:");
  expect(output.join("\n")).toContain("Cloud missing: none");
});

it("reports doctor failures with next commands", async () => {
  const code = await runAgentstack(["doctor", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(1);
  expect(output).toContain("FAIL doctor preview");
  expect(output.join("\n")).toContain("FAIL cloud.service.missing");
  expect(output.join("\n")).toContain("Next commands:");
  expect(output.join("\n")).toContain("agentstack sync --env preview --apply");
});

it("prints dev preflight commands without starting servers", async () => {
  await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });

  const code = await runAgentstack(["dev", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output).toContain("PASS dev preflight preview");
  expect(output.join("\n")).toContain("pnpm --filter @app/web dev");
  expect(output.join("\n")).toContain("pnpm --filter @app/mobile dev");
});
```

Extend the E2E prototype to call:

```ts
await runAgentstack(["inspect", "--env", "preview"], { cwd: appDir, write });
await runAgentstack(["doctor", "--env", "preview"], { cwd: appDir, write });
await runAgentstack(["dev", "--env", "preview"], { cwd: appDir, write });
```

- [x] **Step 2: Run CLI tests and verify RED**

Run: `pnpm vitest run packages/cli/src/run.test.ts tests/e2e/prototype.test.ts`

Expected: FAIL with `FAIL cli.unknown-command` for the new commands.

- [x] **Step 3: Implement command routing and formatting**

In `packages/cli/src/run.ts`:

- route top-level `inspect`, `doctor`, and `dev` before unknown-command fallback;
- add a helper that loads project context, local env values, missing anchors, local diagnostics, local-cloud report, and lifecycle summary;
- use `formatDiagnostic` for doctor failures;
- output stable, line-oriented summaries:

```txt
PASS inspect acme-crm
Environment: preview
Surfaces: web,mobile,convex
Services: clerk,convex,eas,vercel
Generated anchors: 28 required, 0 missing
Cloud expected: clerk,convex,eas,vercel
Cloud linked: clerk,convex,eas,vercel
Cloud missing: none
Next commands:
- agentstack validate
- agentstack env inspect --env preview
```

`doctor` exits `1` on fail diagnostics and `0` otherwise.

`dev` exits `1` only when local validation fails. Missing local-cloud links print `WARN dev cloud <env>` with sync next command, but still let agents continue with local product work.

- [x] **Step 4: Run CLI and E2E tests and verify GREEN**

Run: `pnpm vitest run packages/cli/src/run.test.ts tests/e2e/prototype.test.ts`

Expected: PASS.

## Task 3: Generated Docs And Spin-Up Site

**Files:**
- Modify: `templates/b2b-saas/package.json`
- Modify: `packages/create-agent-stack/templates/b2b-saas/package.json`
- Modify: `templates/b2b-saas/AGENTS.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/AGENTS.md`
- Modify: `templates/b2b-saas/docs/agentstack/local-development.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/local-development.md`
- Modify: `templates/b2b-saas/docs/agentstack/validation.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/validation.md`
- Modify: `README.md`
- Modify: `docs/spinup-site/workflows.html`
- Modify: `docs/spinup-site/guardrails.html`
- Modify: `docs/spinup-site/generated-app.html`
- Modify: `docs/spinup-site/assets/site.js`
- Modify: `packages/create-agent-stack/src/generate.test.ts`

- [x] **Step 1: Write failing template tests**

In `packages/create-agent-stack/src/generate.test.ts`, expect root scripts:

```ts
expect(packageManifest.scripts).toMatchObject({
  inspect: "node scripts/agentstack.mjs inspect --env preview",
  doctor: "node scripts/agentstack.mjs doctor --env preview",
  dev: "node scripts/agentstack.mjs dev --env preview"
});
```

Run: `pnpm vitest run packages/create-agent-stack/src/generate.test.ts`

Expected: FAIL because scripts are missing.

- [x] **Step 2: Update template scripts and docs**

Add root generated scripts:

```json
"inspect": "node scripts/agentstack.mjs inspect --env preview",
"doctor": "node scripts/agentstack.mjs doctor --env preview",
"dev": "node scripts/agentstack.mjs dev --env preview"
```

Update generated docs to tell agents:

- start with `pnpm run inspect`;
- use `pnpm run doctor` before provider, env, build, or deploy work;
- use `pnpm run dev` as a local preflight command that prints next commands but does not start real servers in the prototype;
- keep using `validate`, `env:inspect`, `sync:preview`, and `observe` for deeper checks.

Update README and spin-up pages with the lifecycle command story and a small scenario in `site.js`.

- [x] **Step 3: Run template and parity checks**

Run:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

Expected: PASS and no diff output.

## Verification

Run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
git diff --check
curl -fsS http://127.0.0.1:8765/workflows.html >/tmp/agentstack-workflows.html
curl -fsS http://127.0.0.1:8765/guardrails.html >/tmp/agentstack-guardrails.html
curl -fsS http://127.0.0.1:8765/generated-app.html >/tmp/agentstack-generated.html
rg -n "doctor|inspect|dev preflight" /tmp/agentstack-workflows.html /tmp/agentstack-guardrails.html /tmp/agentstack-generated.html
```

## Out Of Scope

- Starting real web, mobile, Convex, or Expo development servers.
- Real provider account inspection.
- Hosted control-plane state.
- Replacing the existing `validate`, `env inspect`, `sync`, or `observe` commands.
