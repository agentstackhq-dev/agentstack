# Agentstack Prototype Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first testable Agentstack prototype: a TypeScript monorepo with a manifest parser, environment graph, validation engine, local-cloud adapters, telemetry primitives, observability inspection commands, and a `create-agent-stack` generator for a minimal B2B SaaS project.

**Architecture:** The prototype separates framework kernel code from CLI orchestration and generated app templates. Real vendor APIs are represented by a filesystem-backed local-cloud adapter so the command contracts, drift model, validation loop, and observability interface can be tested without external credentials. Real Clerk, Convex, Vercel, and EAS adapters will implement the same adapter interfaces in a separate plan.

**Tech Stack:** TypeScript, Node.js ESM, pnpm workspaces, Vitest, Zod, tsx, Commander, fs-extra.

---

## Scope

This plan implements the first executable proof of the framework contract:

- `create-agent-stack` generates a minimal project.
- `agentstack validate` performs local manifest, env, telemetry, and template checks.
- `agentstack init cloud` creates local-cloud service state for development and preview.
- `agentstack validate --cloud` detects local-cloud drift.
- `agentstack sync --env preview --apply` reconciles drift.
- `agentstack observe ...` inspects redacted telemetry by environment, surface, journey, trace, and event family.

This plan does not call real Clerk, Convex, Vercel, or EAS APIs. It creates the interfaces and CLI semantics that real adapters will use.

## File Structure

Create these files in the framework repo root:

- `package.json`: root scripts and workspace dev dependencies.
- `pnpm-workspace.yaml`: workspace package declarations.
- `tsconfig.base.json`: shared TypeScript settings.
- `vitest.config.ts`: Vitest config for all packages.
- `.gitignore`: generated output and local state exclusions.

Create these package files:

- `packages/core/package.json`: core package metadata.
- `packages/core/src/index.ts`: core exports.
- `packages/core/src/diagnostics.ts`: normalized diagnostics and formatters.
- `packages/core/src/manifest.ts`: manifest schema, parsing, and default generation.
- `packages/core/src/env-graph.ts`: environment graph and custom env validation.
- `packages/core/src/validation.ts`: local validation orchestration.
- `packages/core/src/*.test.ts`: unit tests for core behavior.

- `packages/telemetry/package.json`: telemetry package metadata.
- `packages/telemetry/src/index.ts`: telemetry exports.
- `packages/telemetry/src/events.ts`: wide event types, creation, redaction, and filters.
- `packages/telemetry/src/store.ts`: JSONL telemetry store and query operations.
- `packages/telemetry/src/*.test.ts`: telemetry tests.

- `packages/adapters/package.json`: adapter package metadata.
- `packages/adapters/src/index.ts`: adapter exports.
- `packages/adapters/src/types.ts`: provider adapter interfaces.
- `packages/adapters/src/local-cloud.ts`: filesystem-backed Convex, Clerk, Vercel, EAS simulation.
- `packages/adapters/src/*.test.ts`: adapter drift and sync tests.

- `packages/cli/package.json`: CLI package metadata and bin entry.
- `packages/cli/src/bin.ts`: executable entrypoint.
- `packages/cli/src/run.ts`: command router.
- `packages/cli/src/context.ts`: project loading and path helpers.
- `packages/cli/src/commands/*.ts`: command implementations.
- `packages/cli/src/*.test.ts`: CLI command tests.

- `packages/create-agent-stack/package.json`: generator package metadata and bin entry.
- `packages/create-agent-stack/src/bin.ts`: executable entrypoint.
- `packages/create-agent-stack/src/generate.ts`: template copy and project naming.
- `packages/create-agent-stack/src/*.test.ts`: generator tests.

Create these template files:

- `templates/b2b-saas/package.json`: generated app workspace scripts.
- `templates/b2b-saas/agentstack.config.ts`: generated manifest.
- `templates/b2b-saas/AGENTS.md`: generated agent rules.
- `templates/b2b-saas/docs/agentstack/*.md`: generated workflow docs.
- `templates/b2b-saas/apps/web/package.json`: minimal web surface.
- `templates/b2b-saas/apps/mobile/package.json`: minimal mobile surface.
- `templates/b2b-saas/convex/schema.ts`: minimal Convex schema anchor.
- `templates/b2b-saas/packages/domain/src/index.ts`: shared domain anchor.
- `templates/b2b-saas/packages/theme/src/index.ts`: theme anchor.
- `templates/b2b-saas/packages/telemetry/src/events.ts`: app event definitions.

Create these end-to-end test files:

- `tests/e2e/prototype.test.ts`: generated app workflow test.

## Task 1: Workspace And Tooling

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Write root workspace files**

Create `package.json`:

```json
{
  "name": "agentstack-framework",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "build": "pnpm -r --if-present build",
    "typecheck": "tsc -p tsconfig.base.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "pnpm typecheck"
  },
  "devDependencies": {
    "@types/node": "^22.10.7",
    "commander": "^12.1.0",
    "fs-extra": "^11.2.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3",
    "vitest": "^2.1.8",
    "zod": "^3.24.1"
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node", "vitest/globals"]
  },
  "include": ["packages/**/*.ts", "tests/**/*.ts", "vitest.config.ts"],
  "exclude": ["**/dist/**", "**/node_modules/**", "**/.agentstack/**"]
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
    restoreMocks: true
  }
});
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
.agentstack/
.env
.env.*
!.env.example
coverage/
tmp/
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
pnpm install
```

Expected: pnpm creates `pnpm-lock.yaml` and exits with code 0.

- [ ] **Step 3: Run the empty test suite**

Run:

```bash
pnpm test
```

Expected: Vitest reports no test files or an empty successful run. If Vitest exits non-zero because no tests exist, continue after Task 2 adds the first tests.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.config.ts .gitignore pnpm-lock.yaml
git commit -m "chore: scaffold agentstack workspace"
```

## Task 2: Core Manifest And Diagnostics

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/src/diagnostics.ts`
- Create: `packages/core/src/manifest.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/manifest.test.ts`

- [ ] **Step 1: Write the failing manifest tests**

Create `packages/core/package.json`:

```json
{
  "name": "@agentstack/core",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "zod": "^3.24.1"
  }
}
```

Create `packages/core/src/manifest.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultManifest, parseManifest } from "./manifest.js";

describe("manifest parsing", () => {
  it("accepts the default B2B SaaS manifest", () => {
    const manifest = createDefaultManifest("acme-crm");

    expect(manifest.app.slug).toBe("acme-crm");
    expect(manifest.environments).toEqual(["development", "preview", "production"]);
    expect(manifest.surfaces).toEqual(["web", "mobile", "convex"]);
    expect(manifest.telemetry.enabled).toBe(true);
  });

  it("returns diagnostics for invalid manifests", () => {
    const result = parseManifest({
      app: { name: "", slug: "Bad Slug" },
      environments: ["development"],
      surfaces: ["web"],
      services: {},
      telemetry: { enabled: true, exporter: "otlp" }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("manifest.invalid");
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test packages/core/src/manifest.test.ts
```

Expected: FAIL because `./manifest.js` does not exist.

- [ ] **Step 3: Implement diagnostics**

Create `packages/core/src/diagnostics.ts`:

```ts
export type DiagnosticSeverity = "info" | "warn" | "fail";

export type Diagnostic = {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  fix?: string;
  blocks?: string[];
  path?: string;
};

export type Result<T> =
  | { ok: true; value: T; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };

export function pass<T>(value: T, diagnostics: Diagnostic[] = []): Result<T> {
  return { ok: true, value, diagnostics };
}

export function fail(diagnostics: Diagnostic[]): Result<never> {
  return { ok: false, diagnostics };
}

export function formatDiagnostic(diagnostic: Diagnostic): string {
  const lines = [
    `${diagnostic.severity.toUpperCase()} ${diagnostic.code}`,
    diagnostic.path ? `Path: ${diagnostic.path}` : undefined,
    diagnostic.message,
    diagnostic.fix ? `Fix: ${diagnostic.fix}` : undefined,
    diagnostic.blocks?.length ? `Blocks: ${diagnostic.blocks.join(", ")}` : undefined
  ].filter(Boolean);

  return lines.join("\n");
}
```

- [ ] **Step 4: Implement manifest parsing**

Create `packages/core/src/manifest.ts`:

```ts
import { z } from "zod";
import { fail, pass, type Diagnostic, type Result } from "./diagnostics.js";

export const environmentSchema = z.enum(["development", "preview", "production"]);
export const surfaceSchema = z.enum(["web", "mobile", "convex"]);
export const serviceSchema = z.enum(["clerk", "convex", "vercel", "eas"]);

export const customEnvSchema = z.object({
  surfaces: z.array(surfaceSchema).min(1),
  environments: z.array(environmentSchema).min(1),
  required: z.boolean().default(false),
  secret: z.boolean().default(false),
  validate: z.string().optional()
});

export const manifestSchema = z.object({
  app: z.object({
    name: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/)
  }),
  environments: z.array(environmentSchema).min(1),
  surfaces: z.array(surfaceSchema).min(1),
  services: z.object({
    clerk: z.object({ enabled: z.boolean() }),
    convex: z.object({ enabled: z.boolean() }),
    vercel: z.object({ enabled: z.boolean() }),
    eas: z.object({ enabled: z.boolean() })
  }),
  env: z.object({
    custom: z.record(customEnvSchema)
  }),
  telemetry: z.object({
    enabled: z.boolean(),
    exporter: z.enum(["local", "otlp", "control-plane"]),
    redaction: z.object({
      defaultPolicy: z.enum(["strict", "billing-safe", "debug"]),
      forbidRawSecrets: z.boolean()
    })
  })
});

export type AgentstackManifest = z.infer<typeof manifestSchema>;
export type EnvironmentName = z.infer<typeof environmentSchema>;
export type SurfaceName = z.infer<typeof surfaceSchema>;
export type ServiceName = z.infer<typeof serviceSchema>;

export function createDefaultManifest(slug: string): AgentstackManifest {
  const name = slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

  return {
    app: { name, slug },
    environments: ["development", "preview", "production"],
    surfaces: ["web", "mobile", "convex"],
    services: {
      clerk: { enabled: true },
      convex: { enabled: true },
      vercel: { enabled: true },
      eas: { enabled: true }
    },
    env: {
      custom: {}
    },
    telemetry: {
      enabled: true,
      exporter: "local",
      redaction: {
        defaultPolicy: "strict",
        forbidRawSecrets: true
      }
    }
  };
}

export function parseManifest(input: unknown): Result<AgentstackManifest> {
  const parsed = manifestSchema.safeParse(input);

  if (parsed.success) {
    return pass(parsed.data);
  }

  const diagnostics: Diagnostic[] = parsed.error.issues.map((issue) => ({
    severity: "fail",
    code: "manifest.invalid",
    path: issue.path.join("."),
    message: issue.message,
    fix: "Update agentstack.config.ts so it matches the Agentstack manifest schema.",
    blocks: ["validate", "validate --cloud", "deploy"]
  }));

  return fail(diagnostics);
}
```

- [ ] **Step 5: Export core functions**

Create `packages/core/src/index.ts`:

```ts
export * from "./diagnostics.js";
export * from "./manifest.js";
```

- [ ] **Step 6: Run the manifest tests**

Run:

```bash
pnpm test packages/core/src/manifest.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core
git commit -m "feat: add manifest parser"
```

## Task 3: Environment Graph And Custom Env Validation

**Files:**
- Create: `packages/core/src/env-graph.ts`
- Create: `packages/core/src/env-graph.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing env graph tests**

Create `packages/core/src/env-graph.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import { buildEnvGraph, validateCustomEnvValues } from "./env-graph.js";

describe("environment graph", () => {
  it("creates service nodes for each environment", () => {
    const manifest = createDefaultManifest("acme-crm");
    const graph = buildEnvGraph(manifest);

    expect(graph.nodes.map((node) => `${node.environment}:${node.service}`)).toContain("preview:clerk");
    expect(graph.nodes.map((node) => `${node.environment}:${node.service}`)).toContain("production:eas");
  });

  it("validates scoped custom env values", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.OPENAI_API_KEY = {
      surfaces: ["convex"],
      environments: ["development", "preview", "production"],
      required: true,
      secret: true
    };

    const diagnostics = validateCustomEnvValues(manifest, {
      development: { convex: { OPENAI_API_KEY: "dev-key" } },
      preview: { convex: {} },
      production: { convex: { OPENAI_API_KEY: "prod-key" } }
    });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "env.custom.missing",
        path: "preview.convex.OPENAI_API_KEY"
      })
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test packages/core/src/env-graph.test.ts
```

Expected: FAIL because `./env-graph.js` does not exist.

- [ ] **Step 3: Implement env graph helpers**

Create `packages/core/src/env-graph.ts`:

```ts
import type { AgentstackManifest, EnvironmentName, ServiceName, SurfaceName } from "./manifest.js";
import type { Diagnostic } from "./diagnostics.js";

export type EnvGraphNode = {
  environment: EnvironmentName;
  service: ServiceName;
  managed: boolean;
};

export type EnvGraph = {
  nodes: EnvGraphNode[];
};

export type EnvValueState = Partial<
  Record<EnvironmentName, Partial<Record<SurfaceName, Record<string, string | undefined>>>>
>;

const serviceOrder: ServiceName[] = ["clerk", "convex", "vercel", "eas"];

export function buildEnvGraph(manifest: AgentstackManifest): EnvGraph {
  const nodes: EnvGraphNode[] = [];

  for (const environment of manifest.environments) {
    for (const service of serviceOrder) {
      if (manifest.services[service].enabled) {
        nodes.push({ environment, service, managed: true });
      }
    }
  }

  return { nodes };
}

export function validateCustomEnvValues(
  manifest: AgentstackManifest,
  values: EnvValueState
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const [name, declaration] of Object.entries(manifest.env.custom)) {
    if (!declaration.required) {
      continue;
    }

    for (const environment of declaration.environments) {
      for (const surface of declaration.surfaces) {
        const value = values[environment]?.[surface]?.[name];
        if (!value) {
          diagnostics.push({
            severity: "fail",
            code: "env.custom.missing",
            path: `${environment}.${surface}.${name}`,
            message: `${name} is required for ${surface} in ${environment}, but no value is present.`,
            fix: `Run agentstack env set ${name} --env ${environment} --surface ${surface}.`,
            blocks: ["validate", "validate --cloud"]
          });
        }
      }
    }
  }

  return diagnostics;
}
```

- [ ] **Step 4: Export env graph helpers**

Modify `packages/core/src/index.ts`:

```ts
export * from "./diagnostics.js";
export * from "./env-graph.js";
export * from "./manifest.js";
```

- [ ] **Step 5: Run env graph tests**

Run:

```bash
pnpm test packages/core/src/env-graph.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/env-graph.ts packages/core/src/env-graph.test.ts packages/core/src/index.ts
git commit -m "feat: add environment graph validation"
```

## Task 4: Telemetry Wide Events And Redacted Store

**Files:**
- Create: `packages/telemetry/package.json`
- Create: `packages/telemetry/src/events.ts`
- Create: `packages/telemetry/src/store.ts`
- Create: `packages/telemetry/src/index.ts`
- Create: `packages/telemetry/src/events.test.ts`

- [ ] **Step 1: Write failing telemetry tests**

Create `packages/telemetry/package.json`:

```json
{
  "name": "@agentstack/telemetry",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

Create `packages/telemetry/src/events.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWideEvent, JsonlTelemetryStore, redactEvent } from "./index.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentstack-telemetry-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("wide telemetry events", () => {
  it("creates correlated wide events", () => {
    const event = createWideEvent("billing.subscription.updated", {
      environment: "preview",
      surface: "convex",
      journey: "billing",
      actorId: "user_123",
      orgId: "org_123",
      correlationId: "corr_123",
      state: { plan: "pro" }
    });

    expect(event.name).toBe("billing.subscription.updated");
    expect(event.traceId).toMatch(/^trace_/);
    expect(event.state).toEqual({ plan: "pro" });
  });

  it("redacts secret-like state values", () => {
    const event = createWideEvent("auth.session.created", {
      environment: "production",
      surface: "web",
      journey: "authentication",
      actorId: "user_123",
      correlationId: "corr_123",
      state: {
        email: "person@example.com",
        CLERK_SECRET_KEY: "sk_live_secret",
        nested: { token: "abc123" }
      }
    });

    expect(redactEvent(event).state).toEqual({
      email: "[redacted]",
      CLERK_SECRET_KEY: "[redacted]",
      nested: { token: "[redacted]" }
    });
  });

  it("stores and queries redacted events", async () => {
    const store = new JsonlTelemetryStore(join(dir, "events.jsonl"));
    await store.append(
      createWideEvent("billing.subscription.updated", {
        environment: "preview",
        surface: "convex",
        journey: "billing",
        actorId: "user_123",
        correlationId: "corr_123",
        state: { plan: "pro" }
      })
    );

    const events = await store.query({ environment: "preview", event: "billing.*" });
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe("billing.subscription.updated");
  });
});
```

- [ ] **Step 2: Run telemetry tests to verify failure**

Run:

```bash
pnpm test packages/telemetry/src/events.test.ts
```

Expected: FAIL because telemetry exports do not exist.

- [ ] **Step 3: Implement event primitives**

Create `packages/telemetry/src/events.ts`:

```ts
import { randomUUID } from "node:crypto";

export type TelemetryEnvironment = "development" | "preview" | "production";
export type TelemetrySurface =
  | "web"
  | "mobile"
  | "convex"
  | "clerk"
  | "vercel"
  | "eas"
  | "cli"
  | "control-plane";

export type WideEvent = {
  id: string;
  name: string;
  timestamp: string;
  environment: TelemetryEnvironment;
  surface: TelemetrySurface;
  journey?: string;
  traceId: string;
  correlationId: string;
  journeyId?: string;
  actorId?: string;
  orgId?: string;
  releaseId?: string;
  state: Record<string, unknown>;
};

export type WideEventInput = {
  environment: TelemetryEnvironment;
  surface: TelemetrySurface;
  journey?: string;
  traceId?: string;
  correlationId?: string;
  journeyId?: string;
  actorId?: string;
  orgId?: string;
  releaseId?: string;
  state?: Record<string, unknown>;
};

const sensitivePattern = /(secret|token|password|email|key)/i;

export function createWideEvent(name: string, input: WideEventInput): WideEvent {
  return {
    id: `evt_${randomUUID()}`,
    name,
    timestamp: new Date().toISOString(),
    environment: input.environment,
    surface: input.surface,
    journey: input.journey,
    traceId: input.traceId ?? `trace_${randomUUID()}`,
    correlationId: input.correlationId ?? `corr_${randomUUID()}`,
    journeyId: input.journeyId,
    actorId: input.actorId,
    orgId: input.orgId,
    releaseId: input.releaseId,
    state: input.state ?? {}
  };
}

export function redactValue(key: string, value: unknown): unknown {
  if (sensitivePattern.test(key)) {
    return "[redacted]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(key, item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactValue(childKey, childValue)
      ])
    );
  }

  return value;
}

export function redactEvent(event: WideEvent): WideEvent {
  return {
    ...event,
    actorId: event.actorId ? "[redacted]" : undefined,
    orgId: event.orgId,
    state: Object.fromEntries(
      Object.entries(event.state).map(([key, value]) => [key, redactValue(key, value)])
    )
  };
}

export function eventNameMatches(name: string, pattern: string): boolean {
  if (pattern.endsWith("*")) {
    return name.startsWith(pattern.slice(0, -1));
  }

  return name === pattern;
}
```

- [ ] **Step 4: Implement JSONL store**

Create `packages/telemetry/src/store.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { eventNameMatches, redactEvent, type TelemetryEnvironment, type TelemetrySurface, type WideEvent } from "./events.js";

export type TelemetryQuery = {
  environment?: TelemetryEnvironment;
  surface?: TelemetrySurface;
  event?: string;
  journey?: string;
  traceId?: string;
  correlationId?: string;
  journeyId?: string;
};

export class JsonlTelemetryStore {
  constructor(private readonly path: string) {}

  async append(event: WideEvent): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const existing = await this.readRaw();
    await writeFile(this.path, `${existing}${JSON.stringify(event)}\n`, "utf8");
  }

  async query(query: TelemetryQuery): Promise<WideEvent[]> {
    const events = await this.readEvents();

    return events
      .filter((event) => !query.environment || event.environment === query.environment)
      .filter((event) => !query.surface || event.surface === query.surface)
      .filter((event) => !query.event || eventNameMatches(event.name, query.event))
      .filter((event) => !query.journey || event.journey === query.journey)
      .filter((event) => !query.traceId || event.traceId === query.traceId)
      .filter((event) => !query.correlationId || event.correlationId === query.correlationId)
      .filter((event) => !query.journeyId || event.journeyId === query.journeyId)
      .map(redactEvent)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private async readRaw(): Promise<string> {
    try {
      return await readFile(this.path, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return "";
      }
      throw error;
    }
  }

  private async readEvents(): Promise<WideEvent[]> {
    const raw = await this.readRaw();
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as WideEvent);
  }
}
```

- [ ] **Step 5: Export telemetry**

Create `packages/telemetry/src/index.ts`:

```ts
export * from "./events.js";
export * from "./store.js";
```

- [ ] **Step 6: Run telemetry tests**

Run:

```bash
pnpm test packages/telemetry/src/events.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/telemetry
git commit -m "feat: add wide telemetry primitives"
```

## Task 5: Local-Cloud Adapter And Drift Model

**Files:**
- Create: `packages/adapters/package.json`
- Create: `packages/adapters/src/types.ts`
- Create: `packages/adapters/src/local-cloud.ts`
- Create: `packages/adapters/src/index.ts`
- Create: `packages/adapters/src/local-cloud.test.ts`

- [ ] **Step 1: Write failing local-cloud tests**

Create `packages/adapters/package.json`:

```json
{
  "name": "@agentstack/adapters",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@agentstack/core": "workspace:*"
  }
}
```

Create `packages/adapters/src/local-cloud.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultManifest } from "@agentstack/core";
import { LocalCloudAdapter } from "./local-cloud.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentstack-cloud-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("local-cloud adapter", () => {
  it("detects missing managed service state", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const diagnostics = await adapter.validate(createDefaultManifest("acme-crm"), "preview");

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("cloud.service.missing");
  });

  it("reconciles preview service state", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    await adapter.sync(manifest, "preview", { apply: true });
    const diagnostics = await adapter.validate(manifest, "preview");

    expect(diagnostics).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test packages/adapters/src/local-cloud.test.ts
```

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Define adapter interfaces**

Create `packages/adapters/src/types.ts`:

```ts
import type { AgentstackManifest, Diagnostic, EnvironmentName } from "@agentstack/core";

export type SyncOptions = {
  apply: boolean;
};

export type SyncPlan = {
  environment: EnvironmentName;
  changes: string[];
  applied: boolean;
};

export interface CloudAdapter {
  validate(manifest: AgentstackManifest, environment: EnvironmentName): Promise<Diagnostic[]>;
  sync(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options: SyncOptions
  ): Promise<SyncPlan>;
}
```

- [ ] **Step 4: Implement local-cloud adapter**

Create `packages/adapters/src/local-cloud.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildEnvGraph, type AgentstackManifest, type Diagnostic, type EnvironmentName, type ServiceName } from "@agentstack/core";
import type { CloudAdapter, SyncOptions, SyncPlan } from "./types.js";

type LocalCloudServiceState = {
  service: ServiceName;
  environment: EnvironmentName;
  linked: boolean;
  env: Record<string, string>;
};

type LocalCloudState = {
  services: LocalCloudServiceState[];
};

export class LocalCloudAdapter implements CloudAdapter {
  constructor(private readonly projectRoot: string) {}

  async validate(manifest: AgentstackManifest, environment: EnvironmentName): Promise<Diagnostic[]> {
    const state = await this.readState();
    const required = buildEnvGraph(manifest).nodes.filter((node) => node.environment === environment);

    return required.flatMap((node) => {
      const service = state.services.find(
        (candidate) => candidate.environment === environment && candidate.service === node.service
      );

      if (service?.linked) {
        return [];
      }

      return [
        {
          severity: "fail" as const,
          code: "cloud.service.missing",
          path: `${environment}.${node.service}`,
          message: `${node.service} is not linked in ${environment}.`,
          fix: `Run agentstack sync --env ${environment} --apply.`,
          blocks: ["validate --cloud"]
        }
      ];
    });
  }

  async sync(
    manifest: AgentstackManifest,
    environment: EnvironmentName,
    options: SyncOptions
  ): Promise<SyncPlan> {
    const state = await this.readState();
    const required = buildEnvGraph(manifest).nodes.filter((node) => node.environment === environment);
    const changes: string[] = [];

    for (const node of required) {
      const index = state.services.findIndex(
        (candidate) => candidate.environment === environment && candidate.service === node.service
      );

      if (index === -1) {
        changes.push(`link ${environment}.${node.service}`);
        if (options.apply) {
          state.services.push({
            environment,
            service: node.service,
            linked: true,
            env: {}
          });
        }
      }
    }

    if (options.apply) {
      await this.writeState(state);
    }

    return { environment, changes, applied: options.apply };
  }

  private get statePath(): string {
    return join(this.projectRoot, ".agentstack", "local-cloud.json");
  }

  private async readState(): Promise<LocalCloudState> {
    try {
      return JSON.parse(await readFile(this.statePath, "utf8")) as LocalCloudState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { services: [] };
      }
      throw error;
    }
  }

  private async writeState(state: LocalCloudState): Promise<void> {
    await mkdir(join(this.projectRoot, ".agentstack"), { recursive: true });
    await writeFile(this.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }
}
```

- [ ] **Step 5: Export adapters**

Create `packages/adapters/src/index.ts`:

```ts
export * from "./types.js";
export * from "./local-cloud.js";
```

- [ ] **Step 6: Run local-cloud tests**

Run:

```bash
pnpm test packages/adapters/src/local-cloud.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/adapters
git commit -m "feat: add local cloud adapter"
```

## Task 6: Local Validation Engine

**Files:**
- Create: `packages/core/src/validation.ts`
- Create: `packages/core/src/validation.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing validation tests**

Create `packages/core/src/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import { validateLocalProject } from "./validation.js";

describe("local validation", () => {
  it("passes a valid default manifest", () => {
    const result = validateLocalProject({
      manifest: createDefaultManifest("acme-crm"),
      envValues: {}
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  it("fails when telemetry redaction is disabled for a production-capable project", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.telemetry.redaction.forbidRawSecrets = false;

    const result = validateLocalProject({ manifest, envValues: {} });

    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "telemetry.redaction.disabled"
      })
    ]);
  });
});
```

- [ ] **Step 2: Run validation tests to verify failure**

Run:

```bash
pnpm test packages/core/src/validation.test.ts
```

Expected: FAIL because `validation.ts` does not exist.

- [ ] **Step 3: Implement local validation**

Create `packages/core/src/validation.ts`:

```ts
import { validateCustomEnvValues, type EnvValueState } from "./env-graph.js";
import type { Diagnostic, Result } from "./diagnostics.js";
import type { AgentstackManifest } from "./manifest.js";

export type LocalValidationInput = {
  manifest: AgentstackManifest;
  envValues: EnvValueState;
};

export type LocalValidationReport = {
  diagnostics: Diagnostic[];
};

export function validateLocalProject(input: LocalValidationInput): Result<LocalValidationReport> {
  const diagnostics: Diagnostic[] = [
    ...validateCustomEnvValues(input.manifest, input.envValues),
    ...validateTelemetryPolicy(input.manifest)
  ];

  if (diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return { ok: false, diagnostics };
  }

  return { ok: true, value: { diagnostics }, diagnostics };
}

function validateTelemetryPolicy(manifest: AgentstackManifest): Diagnostic[] {
  if (!manifest.telemetry.enabled) {
    return [
      {
        severity: "warn",
        code: "telemetry.disabled",
        message: "Telemetry is disabled, so journey inspection will not be available.",
        fix: "Set telemetry.enabled to true in agentstack.config.ts."
      }
    ];
  }

  if (!manifest.telemetry.redaction.forbidRawSecrets) {
    return [
      {
        severity: "fail",
        code: "telemetry.redaction.disabled",
        path: "telemetry.redaction.forbidRawSecrets",
        message: "Telemetry redaction must forbid raw secrets.",
        fix: "Set telemetry.redaction.forbidRawSecrets to true.",
        blocks: ["validate", "validate --cloud", "deploy"]
      }
    ];
  }

  return [];
}
```

- [ ] **Step 4: Export validation**

Modify `packages/core/src/index.ts`:

```ts
export * from "./diagnostics.js";
export * from "./env-graph.js";
export * from "./manifest.js";
export * from "./validation.js";
```

- [ ] **Step 5: Run validation tests**

Run:

```bash
pnpm test packages/core/src/validation.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/validation.ts packages/core/src/validation.test.ts packages/core/src/index.ts
git commit -m "feat: add local validation engine"
```

## Task 7: CLI Project Context And Commands

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/src/context.ts`
- Create: `packages/cli/src/run.ts`
- Create: `packages/cli/src/bin.ts`
- Create: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Create `packages/cli/package.json`:

```json
{
  "name": "@agentstack/cli",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "bin": {
    "agentstack": "src/bin.ts"
  },
  "dependencies": {
    "@agentstack/adapters": "workspace:*",
    "@agentstack/core": "workspace:*",
    "@agentstack/telemetry": "workspace:*",
    "commander": "^12.1.0"
  }
}
```

Create `packages/cli/src/run.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultManifest } from "@agentstack/core";
import { createWideEvent, JsonlTelemetryStore } from "@agentstack/telemetry";
import { runAgentstack } from "./run.js";

let dir: string;
let output: string[];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentstack-cli-"));
  output = [];
  const manifest = createDefaultManifest("acme-crm");
  await writeFile(
    join(dir, "agentstack.config.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("agentstack cli", () => {
  it("validates local project state", async () => {
    const code = await runAgentstack(["validate"], { cwd: dir, write: (line) => output.push(line) });

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("PASS validate");
  });

  it("detects missing cloud state", async () => {
    const code = await runAgentstack(["validate", "--cloud"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cloud.service.missing");
  });

  it("syncs preview cloud state", async () => {
    const code = await runAgentstack(["sync", "--env", "preview", "--apply"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("APPLIED preview");
  });

  it("queries redacted telemetry", async () => {
    await mkdir(join(dir, ".agentstack"), { recursive: true });
    const store = new JsonlTelemetryStore(join(dir, ".agentstack", "events.jsonl"));
    await store.append(
      createWideEvent("billing.subscription.updated", {
        environment: "preview",
        surface: "convex",
        journey: "billing",
        actorId: "user_123",
        correlationId: "corr_123",
        state: { email: "person@example.com", plan: "pro" }
      })
    );

    const code = await runAgentstack(
      ["observe", "query", "--env", "preview", "--event", "billing.*"],
      { cwd: dir, write: (line) => output.push(line) }
    );

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("billing.subscription.updated");
    expect(output.join("\n")).toContain("[redacted]");
  });
});
```

- [ ] **Step 2: Run CLI tests to verify failure**

Run:

```bash
pnpm test packages/cli/src/run.test.ts
```

Expected: FAIL because `run.ts` does not exist.

- [ ] **Step 3: Implement project context**

Create `packages/cli/src/context.ts`:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseManifest, type AgentstackManifest } from "@agentstack/core";

export type ProjectContext = {
  cwd: string;
  manifest: AgentstackManifest;
};

export async function loadProject(cwd: string): Promise<ProjectContext> {
  const path = join(cwd, "agentstack.config.json");
  const raw = await readFile(path, "utf8");
  const parsed = parseManifest(JSON.parse(raw));

  if (!parsed.ok) {
    const message = parsed.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
    throw new Error(message);
  }

  return { cwd, manifest: parsed.value };
}
```

- [ ] **Step 4: Implement command runner**

Create `packages/cli/src/run.ts`:

```ts
import { join } from "node:path";
import { formatDiagnostic, validateLocalProject, type EnvironmentName } from "@agentstack/core";
import { LocalCloudAdapter } from "@agentstack/adapters";
import { JsonlTelemetryStore } from "@agentstack/telemetry";
import { loadProject } from "./context.js";

export type RunIo = {
  cwd: string;
  write: (line: string) => void;
};

export async function runAgentstack(argv: string[], io: RunIo): Promise<number> {
  const [command, subcommand] = argv;

  if (command === "validate") {
    return runValidate(argv, io);
  }

  if (command === "sync") {
    return runSync(argv, io);
  }

  if (command === "init" && subcommand === "cloud") {
    return runInitCloud(io);
  }

  if (command === "observe") {
    return runObserve(argv, io);
  }

  io.write(`FAIL cli.unknown-command\nUnknown command: ${argv.join(" ")}`);
  return 1;
}

async function runValidate(argv: string[], io: RunIo): Promise<number> {
  const project = await loadProject(io.cwd);
  const local = validateLocalProject({ manifest: project.manifest, envValues: {} });

  for (const diagnostic of local.diagnostics) {
    io.write(formatDiagnostic(diagnostic));
  }

  if (!local.ok) {
    return 1;
  }

  if (argv.includes("--cloud")) {
    const adapter = new LocalCloudAdapter(project.cwd);
    const diagnostics = await adapter.validate(project.manifest, "preview");
    for (const diagnostic of diagnostics) {
      io.write(formatDiagnostic(diagnostic));
    }
    return diagnostics.some((diagnostic) => diagnostic.severity === "fail") ? 1 : 0;
  }

  io.write("PASS validate");
  return 0;
}

async function runSync(argv: string[], io: RunIo): Promise<number> {
  const project = await loadProject(io.cwd);
  const environment = readOption(argv, "--env") as EnvironmentName;
  const apply = argv.includes("--apply");
  const adapter = new LocalCloudAdapter(project.cwd);
  const plan = await adapter.sync(project.manifest, environment, { apply });

  io.write(`${plan.applied ? "APPLIED" : "PLAN"} ${plan.environment}`);
  for (const change of plan.changes) {
    io.write(`- ${change}`);
  }
  return 0;
}

async function runInitCloud(io: RunIo): Promise<number> {
  const project = await loadProject(io.cwd);
  const adapter = new LocalCloudAdapter(project.cwd);

  await adapter.sync(project.manifest, "development", { apply: true });
  await adapter.sync(project.manifest, "preview", { apply: true });
  io.write("APPLIED development");
  io.write("APPLIED preview");
  return 0;
}

async function runObserve(argv: string[], io: RunIo): Promise<number> {
  const mode = argv[1];
  const store = new JsonlTelemetryStore(join(io.cwd, ".agentstack", "events.jsonl"));
  const events = await store.query({
    environment: readOption(argv, "--env") as never,
    surface: readOption(argv, "--surface") as never,
    event: readOption(argv, "--event"),
    journey: readOption(argv, "--journey"),
    traceId: readOption(argv, "--trace"),
    correlationId: readOption(argv, "--correlation"),
    journeyId: readOption(argv, "--journey-id")
  });

  io.write(`PASS observe ${mode ?? "query"} ${events.length}`);
  for (const event of events) {
    io.write(`${event.timestamp} ${event.environment}.${event.surface} ${event.name}`);
    io.write(JSON.stringify(event.state));
  }
  return 0;
}

function readOption(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}
```

- [ ] **Step 5: Implement executable entrypoint**

Create `packages/cli/src/bin.ts`:

```ts
#!/usr/bin/env tsx
import { runAgentstack } from "./run.js";

const code = await runAgentstack(process.argv.slice(2), {
  cwd: process.cwd(),
  write: (line) => process.stdout.write(`${line}\n`)
});

process.exitCode = code;
```

- [ ] **Step 6: Run CLI tests**

Run:

```bash
pnpm test packages/cli/src/run.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/cli
git commit -m "feat: add agentstack cli prototype"
```

## Task 8: B2B SaaS Template And Generator

**Files:**
- Create: `packages/create-agent-stack/package.json`
- Create: `packages/create-agent-stack/src/generate.ts`
- Create: `packages/create-agent-stack/src/bin.ts`
- Create: `packages/create-agent-stack/src/generate.test.ts`
- Create: `templates/b2b-saas/package.json`
- Create: `templates/b2b-saas/agentstack.config.json`
- Create: `templates/b2b-saas/AGENTS.md`
- Create: `templates/b2b-saas/docs/agentstack/workflows.md`
- Create: `templates/b2b-saas/docs/agentstack/environments.md`
- Create: `templates/b2b-saas/docs/agentstack/validation.md`
- Create: `templates/b2b-saas/docs/agentstack/observability.md`
- Create: `templates/b2b-saas/docs/agentstack/release.md`
- Create: `templates/b2b-saas/docs/agentstack/theming.md`
- Create: `templates/b2b-saas/docs/agentstack/generated-boundaries.md`
- Create: `templates/b2b-saas/apps/web/package.json`
- Create: `templates/b2b-saas/apps/mobile/package.json`
- Create: `templates/b2b-saas/convex/schema.ts`
- Create: `templates/b2b-saas/packages/domain/src/index.ts`
- Create: `templates/b2b-saas/packages/theme/src/index.ts`
- Create: `templates/b2b-saas/packages/telemetry/src/events.ts`

- [ ] **Step 1: Write failing generator test**

Create `packages/create-agent-stack/package.json`:

```json
{
  "name": "create-agent-stack",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "bin": {
    "create-agent-stack": "src/bin.ts"
  },
  "dependencies": {
    "@agentstack/core": "workspace:*",
    "fs-extra": "^11.2.0"
  }
}
```

Create `packages/create-agent-stack/src/generate.test.ts`:

```ts
import { readFile, rm, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateProject } from "./generate.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "create-agent-stack-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("create-agent-stack", () => {
  it("generates a B2B SaaS project", async () => {
    const target = join(dir, "acme-crm");
    await generateProject({ name: "acme-crm", targetDir: target });

    const manifest = JSON.parse(await readFile(join(target, "agentstack.config.json"), "utf8"));
    const agents = await readFile(join(target, "AGENTS.md"), "utf8");

    expect(manifest.app.slug).toBe("acme-crm");
    expect(agents).toContain("Run `agentstack validate` before completion.");
  });
});
```

- [ ] **Step 2: Run generator test to verify failure**

Run:

```bash
pnpm test packages/create-agent-stack/src/generate.test.ts
```

Expected: FAIL because `generate.ts` and the template do not exist.

- [ ] **Step 3: Create template manifest and package file**

Create `templates/b2b-saas/package.json`:

```json
{
  "name": "__APP_SLUG__",
  "private": true,
  "type": "module",
  "scripts": {
    "validate": "agentstack validate",
    "validate:cloud": "agentstack validate --cloud",
    "init:cloud": "agentstack init cloud"
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

Create `templates/b2b-saas/agentstack.config.json`:

```json
{
  "app": {
    "name": "__APP_NAME__",
    "slug": "__APP_SLUG__"
  },
  "environments": ["development", "preview", "production"],
  "surfaces": ["web", "mobile", "convex"],
  "services": {
    "clerk": { "enabled": true },
    "convex": { "enabled": true },
    "vercel": { "enabled": true },
    "eas": { "enabled": true }
  },
  "env": {
    "custom": {}
  },
  "telemetry": {
    "enabled": true,
    "exporter": "local",
    "redaction": {
      "defaultPolicy": "strict",
      "forbidRawSecrets": true
    }
  }
}
```

- [ ] **Step 4: Create generated agent docs**

Create `templates/b2b-saas/AGENTS.md`:

```md
# Agent Instructions

- Run `agentstack validate` before completion.
- Use `agentstack init cloud`, `agentstack env`, and `agentstack sync` instead of editing vendor dashboards manually.
- Use framework telemetry primitives for product events and diagnostics.
- Do not edit generated vendor glue directly.
- Add custom environment values through `agentstack.config.json`.
- Inspect system behavior with `agentstack observe`.
- Release only through framework commands.
```

Create `templates/b2b-saas/docs/agentstack/workflows.md`:

```md
# Workflows

Use `agentstack validate` for the fast local loop. Use `agentstack validate --cloud` when service state matters. Use `agentstack observe` when investigating user journeys, releases, webhooks, or production incidents.
```

Create `templates/b2b-saas/docs/agentstack/environments.md`:

```md
# Environments

Agentstack manages development, preview, and production as named environments. Custom environment values must be declared in `agentstack.config.json` with surfaces, environments, secret policy, and validation rules.
```

Create `templates/b2b-saas/docs/agentstack/validation.md`:

```md
# Validation

`agentstack validate` checks local manifest, custom env declarations, telemetry policy, and generated boundaries. `agentstack validate --cloud` also checks managed service state.
```

Create `templates/b2b-saas/docs/agentstack/observability.md`:

```md
# Observability

Use wide, typed, redacted telemetry events. Inspect events with `agentstack observe query`, timelines with `agentstack observe timeline`, and production incidents with scoped filters such as environment, surface, event family, trace, journey, release, or component.
```

Create `templates/b2b-saas/docs/agentstack/release.md`:

```md
# Release

Production mutations require an explicit plan and apply flow. Run `agentstack validate --release prod` before production deployment once release commands are enabled.
```

Create `templates/b2b-saas/docs/agentstack/theming.md`:

```md
# Theming

Use shared theme tokens and unstyled primitives. Keep complex screens platform-native while preserving shared accessibility and interaction expectations.
```

Create `templates/b2b-saas/docs/agentstack/generated-boundaries.md`:

```md
# Generated Boundaries

Product code is safe to edit. Framework-owned vendor glue is regenerated by Agentstack commands and should not be edited directly.
```

- [ ] **Step 5: Create minimal generated app anchors**

Create `templates/b2b-saas/apps/web/package.json`:

```json
{
  "name": "@app/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "echo web dev",
    "build": "echo web build"
  }
}
```

Create `templates/b2b-saas/apps/mobile/package.json`:

```json
{
  "name": "@app/mobile",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "echo mobile dev",
    "build": "echo mobile build"
  }
}
```

Create `templates/b2b-saas/convex/schema.ts`:

```ts
export const schemaVersion = 1;
```

Create `templates/b2b-saas/packages/domain/src/index.ts`:

```ts
export type Role = "owner" | "admin" | "member";

export type Entitlement = {
  key: string;
  enabled: boolean;
};
```

Create `templates/b2b-saas/packages/theme/src/index.ts`:

```ts
export type ThemeTokens = {
  color: Record<string, string>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
};

export const defaultTheme: ThemeTokens = {
  color: {
    background: "#ffffff",
    foreground: "#111111",
    accent: "#2563eb"
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24
  },
  radius: {
    sm: 4,
    md: 8
  }
};
```

Create `templates/b2b-saas/packages/telemetry/src/events.ts`:

```ts
export const appTelemetryEvents = [
  "authentication.session.started",
  "onboarding.step.completed",
  "billing.subscription.updated"
] as const;

export type AppTelemetryEvent = (typeof appTelemetryEvents)[number];
```

- [ ] **Step 6: Implement generator**

Create `packages/create-agent-stack/src/generate.ts`:

```ts
import { cp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export type GenerateProjectInput = {
  name: string;
  targetDir: string;
};

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(packageRoot));
const templateRoot = join(repoRoot, "templates", "b2b-saas");

export async function generateProject(input: GenerateProjectInput): Promise<void> {
  const appSlug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const appName = appSlug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

  await cp(templateRoot, input.targetDir, { recursive: true });
  await replaceTokens(input.targetDir, {
    __APP_SLUG__: appSlug,
    __APP_NAME__: appName
  });
}

async function replaceTokens(dir: string, replacements: Record<string, string>): Promise<void> {
  for (const entry of await readdir(dir)) {
    const path = join(dir, entry);
    const info = await stat(path);

    if (info.isDirectory()) {
      await replaceTokens(path, replacements);
      continue;
    }

    const relativePath = relative(dir, path);
    if (relativePath.includes("node_modules")) {
      continue;
    }

    const raw = await readFile(path, "utf8");
    const updated = Object.entries(replacements).reduce(
      (text, [token, value]) => text.replaceAll(token, value),
      raw
    );
    await writeFile(path, updated, "utf8");
  }
}
```

Create `packages/create-agent-stack/src/bin.ts`:

```ts
#!/usr/bin/env tsx
import { resolve } from "node:path";
import { generateProject } from "./generate.js";

const name = process.argv[2];

if (!name) {
  process.stderr.write("Usage: create-agent-stack <app-name>\n");
  process.exitCode = 1;
} else {
  await generateProject({ name, targetDir: resolve(process.cwd(), name) });
  process.stdout.write(`Created ${name}\n`);
}
```

- [ ] **Step 7: Run generator tests**

Run:

```bash
pnpm test packages/create-agent-stack/src/generate.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/create-agent-stack templates/b2b-saas
git commit -m "feat: add b2b saas generator"
```

## Task 9: End-To-End Prototype Workflow

**Files:**
- Create: `tests/e2e/prototype.test.ts`

- [ ] **Step 1: Write failing end-to-end test**

Create `tests/e2e/prototype.test.ts`:

```ts
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateProject } from "../../packages/create-agent-stack/src/generate.js";
import { runAgentstack } from "../../packages/cli/src/run.js";
import { createWideEvent, JsonlTelemetryStore } from "../../packages/telemetry/src/index.js";

let dir: string;
let appDir: string;
let output: string[];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentstack-e2e-"));
  appDir = join(dir, "acme-crm");
  output = [];
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("prototype workflow", () => {
  it("generates, validates, syncs, observes, and validates cloud state", async () => {
    await generateProject({ name: "acme-crm", targetDir: appDir });

    expect(await run(["validate"])).toBe(0);
    expect(await run(["validate", "--cloud"])).toBe(1);
    expect(await run(["init", "cloud"])).toBe(0);
    expect(await run(["validate", "--cloud"])).toBe(0);

    await mkdir(join(appDir, ".agentstack"), { recursive: true });
    const store = new JsonlTelemetryStore(join(appDir, ".agentstack", "events.jsonl"));
    await store.append(
      createWideEvent("onboarding.step.completed", {
        environment: "preview",
        surface: "web",
        journey: "onboarding",
        actorId: "user_123",
        orgId: "org_123",
        correlationId: "corr_onboarding",
        state: {
          step: "create_workspace",
          email: "person@example.com"
        }
      })
    );

    expect(
      await run(["observe", "query", "--env", "preview", "--journey", "onboarding"])
    ).toBe(0);
    expect(output.join("\n")).toContain("onboarding.step.completed");
    expect(output.join("\n")).toContain("[redacted]");
  });
});

async function run(argv: string[]): Promise<number> {
  return runAgentstack(argv, {
    cwd: appDir,
    write: (line) => output.push(line)
  });
}
```

- [ ] **Step 2: Run the end-to-end test to verify current gaps**

Run:

```bash
pnpm test tests/e2e/prototype.test.ts
```

Expected: FAIL if package path resolution or template copy paths need adjustment.

- [ ] **Step 3: Fix package path resolution if the generator cannot locate the template**

If `generateProject()` cannot find `templates/b2b-saas`, replace the `repoRoot` calculation in `packages/create-agent-stack/src/generate.ts` with:

```ts
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(packageRoot));
const templateRoot = join(repoRoot, "templates", "b2b-saas");
```

Expected: `templateRoot` resolves to `<repo>/templates/b2b-saas` when tests run from source.

- [ ] **Step 4: Run the end-to-end test**

Run:

```bash
pnpm test tests/e2e/prototype.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run:

```bash
pnpm test
```

Expected: PASS for all package and e2e tests.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/prototype.test.ts packages/create-agent-stack/src/generate.ts
git commit -m "test: cover prototype workflow"
```

## Task 10: Manual CLI Smoke And Documentation

**Files:**
- Create: `README.md`

- [ ] **Step 1: Add concise human-facing README**

Create `README.md`:

````md
# Agentstack

Agentstack is an agent-first control framework for building B2B SaaS products on Convex, Clerk, React, React Native, Vercel, Expo/EAS, and OpenTelemetry.

This prototype proves the local command contract:

```bash
pnpm install
pnpm test
pnpm tsx packages/create-agent-stack/src/bin.ts acme-crm
cd acme-crm
pnpm tsx ../packages/cli/src/bin.ts validate
pnpm tsx ../packages/cli/src/bin.ts init cloud
pnpm tsx ../packages/cli/src/bin.ts validate --cloud
```

The first prototype uses a filesystem-backed local-cloud adapter. Real provider adapters implement the same validation, sync, and inspection contracts.
````

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run full tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 4: Run manual generator smoke**

Run:

```bash
rm -rf tmp/acme-crm
mkdir -p tmp
cd tmp
pnpm --dir .. tsx ../packages/create-agent-stack/src/bin.ts acme-crm
cd acme-crm
pnpm --dir ../.. tsx ../../packages/cli/src/bin.ts validate
pnpm --dir ../.. tsx ../../packages/cli/src/bin.ts init cloud
pnpm --dir ../.. tsx ../../packages/cli/src/bin.ts validate --cloud
```

Expected output includes:

```txt
Created acme-crm
PASS validate
APPLIED development
APPLIED preview
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document prototype workflow"
```

## Self-Review Checklist

- Spec coverage:
  - Manifest source of truth: Task 2.
  - Environment graph and custom env validation: Task 3.
  - Wide telemetry and redacted observability: Task 4.
  - Local-cloud adapter drift model: Task 5.
  - Validation contract: Task 6.
  - CLI commands for validate, init, sync, observe: Task 7.
  - Generated B2B SaaS project and agent docs: Task 8.
  - End-to-end prototype proof: Task 9.
  - Human-facing smoke workflow: Task 10.
- Type consistency:
  - `EnvironmentName`, `SurfaceName`, and `ServiceName` originate in `@agentstack/core`.
  - `LocalCloudAdapter` implements `CloudAdapter`.
  - `runAgentstack()` is used by CLI tests and e2e tests.
  - `JsonlTelemetryStore` is used by package tests, CLI tests, and e2e tests.
- Deferred to a separate plan:
  - Real Clerk, Convex, Vercel, and EAS API adapters.
  - Production `--plan` and `--apply` approval policy.
  - Full React, React Native, Convex, and Clerk generated application code.
  - Hosted control plane.
