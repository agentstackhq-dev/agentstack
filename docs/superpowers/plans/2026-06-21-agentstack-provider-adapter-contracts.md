# Agentstack Provider Adapter Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the normalized provider adapter and provider-operation contract that real Convex, Clerk, Vercel, and EAS adapters will implement after the local-cloud rehearsal.

**Architecture:** The adapters package owns provider definitions and operation planning. Local-cloud inspection remains the state source for this prototype, but it can now be projected into provider operations such as `service.link`, `env.set`, `env.remove`, and future deploy/build operations. CLI lifecycle inspection surfaces those operations so agents can see the exact provider boundary without learning vendor-specific commands yet.

**Tech Stack:** TypeScript, Vitest, existing `@agentstack/adapters` local-cloud adapter, existing lifecycle summary and CLI inspect output, generated B2B SaaS docs.

**Final implementation notes:** Lifecycle cloud state keeps structured provider adapter and provider operation DTOs; CLI output formats those DTOs only at the presentation edge. Env operation IDs include the environment, service, operation kind, surface scope, and variable name, while omitting raw values and hashes. `inspect` now prints the lifecycle status (`PASS`, `WARN`, or `FAIL`) so pending provider operations are not hidden behind a success label.

---

## File Structure

- Create `packages/adapters/src/provider-operations.ts` for provider adapter definitions and provider operation plan helpers.
- Create `packages/adapters/src/provider-operations.test.ts` for operation planning and registry tests.
- Modify `packages/adapters/src/index.ts` to export the new contract.
- Modify `packages/core/src/lifecycle.ts` and `packages/core/src/lifecycle.test.ts` to carry provider operation summaries in lifecycle cloud state.
- Modify `packages/cli/src/run.ts` and `packages/cli/src/run.test.ts` so `agentstack inspect --env preview` prints provider adapters and pending provider operations.
- Modify `README.md`, `templates/b2b-saas/docs/agentstack/validation.md`, `templates/b2b-saas/docs/agentstack/environments.md`, and mirrored generated docs to explain that this is the provider boundary, not real provider mutation.
- Optionally update `docs/spinup-site/architecture.html` if the spin-up site needs to show the contract.

## Task 1: Provider Registry And Operation Planner

**Files:**
- Create: `packages/adapters/src/provider-operations.ts`
- Create: `packages/adapters/src/provider-operations.test.ts`
- Modify: `packages/adapters/src/index.ts`

- [x] **Step 1: Write failing tests for provider definitions**

Create `packages/adapters/src/provider-operations.test.ts` with tests that import:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "@agentstack/core";
import {
  createProviderOperationPlan,
  getEnabledProviderAdapterDefinitions,
  providerAdapterDefinitions
} from "./provider-operations.js";
```

Add a test:

```ts
it("defines provider adapter capabilities for the default services", () => {
  expect(Object.keys(providerAdapterDefinitions)).toEqual(["clerk", "convex", "vercel", "eas"]);
  expect(providerAdapterDefinitions.convex.capabilities).toEqual(
    expect.arrayContaining(["service.lifecycle", "env.sync", "backend.deploy"])
  );
  expect(providerAdapterDefinitions.vercel.capabilities).toEqual(
    expect.arrayContaining(["service.lifecycle", "env.sync", "web.deploy"])
  );
  expect(providerAdapterDefinitions.eas.capabilities).toEqual(
    expect.arrayContaining(["service.lifecycle", "env.sync", "mobile.build"])
  );
});
```

Add a test:

```ts
it("filters provider adapter definitions to enabled services", () => {
  const manifest = createDefaultManifest("acme-crm");
  manifest.services.eas.enabled = false;

  expect(getEnabledProviderAdapterDefinitions(manifest).map((definition) => definition.service)).toEqual([
    "clerk",
    "convex",
    "vercel"
  ]);
});
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/provider-operations.test.ts
```

Expected: fail because the module does not exist.

- [x] **Step 2: Write failing tests for operation planning**

In the same test file, add tests using an inspect-like report:

```ts
const report = {
  environment: "preview",
  expected: [],
  linked: [],
  missing: [{ environment: "preview", service: "convex", linked: true, env: {} }],
  stale: [{ environment: "preview", service: "legacy", linked: true, env: {} }],
  expectedEnv: [],
  syncedEnv: [],
  missingEnv: [
    {
      environment: "preview",
      service: "vercel",
      surface: "web",
      kind: "envVar",
      name: "STRIPE_MODE",
      required: true,
      secret: false,
      valueHash: "hash",
      synced: false
    }
  ],
  staleEnv: [
    {
      environment: "preview",
      service: "convex",
      surface: "convex",
      kind: "envVar",
      name: "LEGACY_FLAG",
      required: false,
      secret: false,
      valueHash: "legacy",
      synced: true
    }
  ],
  driftedEnv: [],
};
```

Assert:

```ts
const plan = createProviderOperationPlan(report);
expect(plan.operations.map((operation) => operation.kind)).toEqual([
  "service.link",
  "service.unlink",
  "env.set",
  "env.remove"
]);
expect(plan.operations).toContainEqual(
  expect.objectContaining({
    id: "preview.vercel.env.set.STRIPE_MODE",
    service: "vercel",
    target: "env:STRIPE_MODE",
    secret: false,
    requiresConfirmation: false
  })
);
expect(JSON.stringify(plan)).not.toContain("hash");
```

Also add a production test:

```ts
it("marks production operations as requiring confirmation", () => {
  const plan = createProviderOperationPlan({ ...report, environment: "production" });
  expect(plan.operations.every((operation) => operation.requiresConfirmation)).toBe(true);
});
```

- [x] **Step 3: Implement provider operation types**

Create `packages/adapters/src/provider-operations.ts`:

```ts
import type { AgentstackManifest, EnvironmentName, ServiceName } from "@agentstack/core";
import type { InspectEnvResource, InspectReport, InspectServiceResource } from "./types.js";

export type ProviderAdapterCapability =
  | "service.lifecycle"
  | "env.sync"
  | "auth.sync"
  | "billing.sync"
  | "webhook.sync"
  | "backend.deploy"
  | "web.deploy"
  | "mobile.build";

export type ProviderAdapterDefinition = {
  service: ServiceName;
  displayName: string;
  capabilities: ProviderAdapterCapability[];
  realAdapterStatus: "contract-only" | "available";
};

export type ProviderOperationKind = "service.link" | "service.unlink" | "env.set" | "env.remove";

export type ProviderOperation = {
  id: string;
  environment: EnvironmentName;
  service: ServiceName | string;
  kind: ProviderOperationKind;
  target: string;
  summary: string;
  secret: boolean;
  requiresConfirmation: boolean;
};

export type ProviderOperationPlan = {
  environment: EnvironmentName;
  operations: ProviderOperation[];
};
```

Export `providerAdapterDefinitions` for `clerk`, `convex`, `vercel`, and `eas` with `realAdapterStatus: "contract-only"`.

- [x] **Step 4: Implement registry and plan helpers**

Implement:

```ts
export function getEnabledProviderAdapterDefinitions(manifest: AgentstackManifest): ProviderAdapterDefinition[] {
  return providerOrder
    .filter((service) => manifest.services[service].enabled)
    .map((service) => providerAdapterDefinitions[service]);
}

export function createProviderOperationPlan(report: InspectReport): ProviderOperationPlan {
  return {
    environment: report.environment,
    operations: [
      ...report.missing.map((resource) => serviceOperation(report.environment, "service.link", resource)),
      ...report.stale.map((resource) => serviceOperation(report.environment, "service.unlink", resource)),
      ...report.missingEnv.filter(hasValueHash).map((resource) => envOperation(report.environment, "env.set", resource)),
      ...report.driftedEnv.filter(hasValueHash).map((resource) => envOperation(report.environment, "env.set", resource)),
      ...report.staleEnv.map((resource) => envOperation(report.environment, "env.remove", resource))
    ]
  };
}
```

Rules:

- Operation IDs must be stable: service operations use `${environment}.${service}.${kind}`, and env operations use `${environment}.${service}.${kind}.${scope}.${targetName}`.
- `env.set` operations must not include `valueHash` or raw values.
- `requiresConfirmation` is `true` for production and `false` otherwise.
- `secret` is true only for env operations where the inspected resource is secret.

- [x] **Step 5: Export and verify**

Modify `packages/adapters/src/index.ts`:

```ts
export * from "./provider-operations.js";
```

Run:

```bash
pnpm exec vitest run packages/adapters/src/provider-operations.test.ts
pnpm typecheck
```

Expected: provider operation tests and typecheck pass.

## Task 2: Lifecycle And CLI Inspection Surface

**Files:**
- Modify: `packages/core/src/lifecycle.ts`
- Modify: `packages/core/src/lifecycle.test.ts`
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [x] **Step 1: Write failing lifecycle tests**

In `packages/core/src/lifecycle.test.ts`, update the cloud summary fixture to include:

```ts
providerAdapters: [
  {
    service: "clerk",
    displayName: "Clerk",
    capabilities: ["service.lifecycle", "auth.sync", "billing.sync", "webhook.sync", "env.sync"],
    realAdapterStatus: "contract-only"
  },
  {
    service: "convex",
    displayName: "Convex",
    capabilities: ["service.lifecycle", "env.sync", "backend.deploy"],
    realAdapterStatus: "contract-only"
  }
],
providerOperations: [
  {
    id: "preview.convex.service.link",
    environment: "preview",
    service: "convex",
    kind: "service.link",
    scope: "service",
    target: "service",
    summary: "Link convex service for preview.",
    secret: false,
    requiresConfirmation: false
  }
]
```

Assert lifecycle output carries those fields through and next command recommendations still include sync when operations exist.

Run:

```bash
pnpm exec vitest run packages/core/src/lifecycle.test.ts
```

Expected: fail because lifecycle cloud summary does not include provider adapter/operation fields.

- [x] **Step 2: Add lifecycle cloud fields**

In `packages/core/src/lifecycle.ts`, extend `LifecycleCloudSummary`:

```ts
providerAdapters: LifecycleProviderAdapterSummary[];
providerOperations: LifecycleProviderOperationSummary[];
```

Update `recommendLifecycleCommands` so provider operations also recommend:

```text
agentstack sync --env <environment> --apply
```

- [x] **Step 3: Write failing CLI inspect tests**

In `packages/cli/src/run.test.ts`, update the lifecycle inspection test to expect:

```ts
expect(output.join("\n")).toContain("Provider adapters: clerk:contract-only,convex:contract-only,vercel:contract-only,eas:contract-only");
expect(output.join("\n")).toContain("Provider operations: none");
```

Add a test where preview cloud is not synced:

```ts
const code = await runAgentstack(["inspect", "--env", "preview"], ...);
expect(output.join("\n")).toContain("Provider operations:");
expect(output.join("\n")).toContain("preview.clerk.service.link");
expect(output.join("\n")).toContain("preview.convex.service.link");
```

Run:

```bash
pnpm exec vitest run packages/cli/src/run.test.ts
```

Expected: fail because inspect output does not print provider adapters or operations.

- [x] **Step 4: Wire provider operations into lifecycle summary**

In `packages/cli/src/run.ts`, import:

```ts
createProviderOperationPlan,
getEnabledProviderAdapterDefinitions
```

Inside `loadLifecycleSummary`, after `cloudReport`, build:

```ts
const providerOperationPlan = createProviderOperationPlan(cloudReport);
```

Set cloud summary fields:

```ts
providerAdapters: getEnabledProviderAdapterDefinitions(validation.context.manifest)
  .map(toLifecycleProviderAdapterSummary),
providerOperations: providerOperationPlan.operations.map(toLifecycleProviderOperationSummary),
```

In `writeLifecycleSummary`, print:

```ts
io.write(`Provider adapters: ${formatList(formatProviderAdapters(summary.cloud.providerAdapters))}`);
io.write(`Provider operations: ${formatList(formatProviderOperations(summary.cloud.providerOperations))}`);
```

- [x] **Step 5: Verify lifecycle and CLI tests**

Run:

```bash
pnpm exec vitest run packages/core/src/lifecycle.test.ts packages/cli/src/run.test.ts
pnpm typecheck
```

Expected: tests and typecheck pass.

## Task 3: Docs, Spin-Up, Review, And Commit

**Files:**
- Modify: `README.md`
- Modify: `templates/b2b-saas/docs/agentstack/validation.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/validation.md`
- Modify: `templates/b2b-saas/docs/agentstack/environments.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/environments.md`
- Modify: `docs/spinup-site/architecture.html`

- [x] **Step 1: Update docs**

Document:

- `inspect` now shows provider adapter contract status and pending provider operation IDs.
- `contract-only` means the framework has normalized the provider boundary but still uses local-cloud rehearsal in this prototype.
- Provider operation IDs are stable and redacted; env operations show surface scope and names, not values or hashes.
- Real Convex, Clerk, Vercel, and EAS adapters will implement these operation kinds later.

- [x] **Step 2: Verify docs and templates**

Run:

```bash
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
git diff --check
node --check docs/spinup-site/assets/site.js
```

Expected: all commands exit 0.

- [x] **Step 3: Run final gate**

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

- `pnpm install --frozen-lockfile` exited 0.
- `pnpm typecheck` exited 0.
- `pnpm test` exited 0: 19 files, 237 tests passed.
- `diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas` exited 0.
- `git diff --check` exited 0.
- `node --check docs/spinup-site/assets/site.js` exited 0.
- `curl -fsS http://127.0.0.1:8765/index.html >/tmp/agentstack-site-index.html` exited 0.
- Spec re-review: no remaining spec compliance issues.
- Integration re-review: no remaining code quality or integration issues.

- [x] **Step 4: Review and commit**

Run final subagent quality review, fix all blocking findings, rerun the relevant gate, then commit:

```bash
git status --short
git add README.md docs packages templates
git commit -m "feat: add provider adapter operation contracts"
git status --short
```

Expected: commit succeeds and worktree is clean.

Commit evidence: committed with message `feat: add provider adapter operation contracts`.
