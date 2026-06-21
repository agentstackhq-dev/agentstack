# Agentstack Wave 2 Provider Inventory Link Adopt Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Wave 2 provider inventory/link/adopt control-plane slice without real provider mutation.

**Wave 2 Scope Boundary:** This is an initial control-plane slice below full Wave 2 acceptance. `adopt` is print-only now; real ledger/project-state adoption, live provider reads, and any provider-backed existence checks remain subsequent Wave 2 work.

**Architecture:** Add provider intent helpers in `@agentstack/adapters` that derive truthful local inventory evidence, gate link writes through planned or active provider ledger rows, and render adopt proposals without updating the root ledger. Wire those helpers into `agentstack provider inventory|link|adopt` beside existing `provider plan|inspect|apply`, keeping local simulator state distinct from ledger-backed provider resource records.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Node `fs/promises`, existing `@agentstack/core`, `@agentstack/adapters`, `@agentstack/cli`, and generated B2B SaaS templates.

---

## File Structure

- Create: `packages/adapters/src/provider-control-plane.ts`
  - Owns provider inventory/link/adopt intent models and pure helpers.
  - Reads local `.agentstack/provider-links.json` state through explicit helper calls only.
  - Builds inventory rows from expected manifest resources, root/provider ledger rows, and local Agentstack provider-link state.
  - Produces adopt proposals as redacted markdown or structured rows without mutating `docs/provider-resource-ledger.md`.
- Create: `packages/adapters/src/provider-control-plane.test.ts`
  - Verifies inventory evidence labels, local simulator separation, ledger-gated link decisions, redaction, and print-only adopt proposals.
- Modify: `packages/adapters/src/index.ts`
  - Exports provider control-plane types and helpers.
- Modify: `packages/cli/src/run.ts`
  - Adds `agentstack provider inventory`, `agentstack provider link`, and `agentstack provider adopt` dispatch and command implementations.
  - Reuses existing option parsing, validation, ledger diagnostics, local context loading, and redaction helpers. Telemetry remains limited to inventory/link in this slice; print-only adopt must not record a command event.
  - Does not call `resolveProviderExecutor`, `inspect*ReadOnly`, or `execute*Apply` from the new commands.
- Modify: `packages/cli/src/run.test.ts`
  - Adds CLI contract tests for inventory/link/adopt, invalid service/env handling, no provider executor calls, redacted output, root ledger unchanged, and no stale aliases.
- Modify: `templates/b2b-saas/package.json`
  - Adds generated package scripts for provider inventory/link/adopt preview and production workflows.
- Modify: `packages/create-agent-stack/templates/b2b-saas/package.json`
  - Mirrors the root template package scripts exactly.
- Modify: `templates/b2b-saas/apps/mobile/package.json`
  - Adds EAS-focused mobile provider inventory/link/adopt scripts where the existing mobile template already exposes EAS provider plan/inspect scripts.
- Modify: `packages/create-agent-stack/templates/b2b-saas/apps/mobile/package.json`
  - Mirrors the root mobile template package scripts exactly.
- Modify: `templates/b2b-saas/docs/agentstack/environments.md`
  - Documents inventory/link/adopt semantics, evidence labels, local provider-link state, ledger gating, redaction, and non-mutation boundaries.
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/environments.md`
  - Mirrors the root template docs exactly, preserving `__APP_SLUG__` tokens.
- Modify: `templates/b2b-saas/docs/agentstack/preview.md`
  - Adds preview runbook commands for local inventory, ledger-gated link, and print-only adopt proposal.
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/preview.md`
  - Mirrors the root template docs exactly, preserving `__APP_SLUG__` tokens.
- Modify: `templates/b2b-saas/docs/agentstack/workflows.md`
  - Adds workflow guidance that `sync` local service links are not proof of external provider existence.
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/workflows.md`
  - Mirrors the root template docs exactly.
- Modify: `packages/create-agent-stack/src/generate.test.ts`
  - Updates generated script and doc assertions for new commands and template parity.
- Do not modify: `docs/provider-resource-ledger.md`
  - The root provider ledger remains unchanged by this implementation.
- Do not modify: `docs/consumer-production-readiness-progress.md`
  - Progress updates happen only after implementation, outside this plan.

## Command Contract

New commands:

```bash
agentstack provider inventory --service <clerk|convex|vercel|eas> --env <preview|production>
agentstack provider link --service <clerk|convex|vercel|eas> --env <preview|production> --resource-type <type> --name <name>
agentstack provider adopt --service <clerk|convex|vercel|eas> --env <preview|production> --resource-type <type> --name <name> --external-id <id-or-url>
```

`inventory` is read-only and writes no files. It prints `Evidence: local-inventory` when derived from manifest and local state only, and `Evidence: ledger-local-inventory` when a matching ledger row contributes evidence. It never prints `Evidence: live-read`.

`link` writes only `.agentstack/provider-links.json` after a matching `planned` or `active` ledger row is found. It does not call provider CLIs, create resources, mutate the root ledger, or treat `.agentstack/local-cloud.json` `sync` links as proof of existence.

`adopt` is print-only in this slice. It prints a safe ledger proposal for an operator to review and manually add to `docs/provider-resource-ledger.md`; it does not write the root ledger, local provider-link state, telemetry files, or any other files. Do not record command telemetry from `providerAdoptCommand` in this first slice.

Output must not contain raw secrets, values that look like `sk_...`, `pk_...`, `..._secret_...`, or raw provider ledger row IDs. Ledger status may be printed, but row IDs and secret-like external IDs must be redacted.

## Tasks

### Task 1: Adapter Models and Intent Helpers

**Files:**
- Create: `packages/adapters/src/provider-control-plane.ts`
- Create: `packages/adapters/src/provider-control-plane.test.ts`
- Modify: `packages/adapters/src/index.ts`

- [ ] **Step 1: Write failing adapter tests**

Add `packages/adapters/src/provider-control-plane.test.ts` with these test cases:

```ts
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDefaultManifest } from "@agentstack/core";
import { describe, expect, it } from "vitest";
import {
  buildProviderAdoptProposal,
  createProviderInventory,
  linkLedgerBackedProviderResource,
  readProviderLinkState
} from "./provider-control-plane.js";
import { parseProviderLedger } from "./provider-ledger.js";

describe("provider control plane", () => {
  it("labels manifest and local provider-link inventory as local-inventory without using local-cloud as external proof", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentstack-provider-control-"));
    try {
      await mkdir(join(dir, ".agentstack"), { recursive: true });
      await writeFile(
        join(dir, ".agentstack", "local-cloud.json"),
        JSON.stringify({ services: [{ service: "convex", environment: "preview", linked: true, env: {} }] }),
        "utf8"
      );

      const inventory = await createProviderInventory({
        cwd: dir,
        manifest: createDefaultManifest("acme-crm"),
        service: "convex",
        environment: "preview",
        ledgerRows: []
      });

      expect(inventory.evidence).toBe("local-inventory");
      expect(inventory.rows).toContainEqual(
        expect.objectContaining({
          service: "convex",
          environment: "preview",
          resourceType: "deployment",
          name: "acme-crm-preview",
          evidence: "expected",
          localLink: "missing",
          ledgerStatus: "missing"
        })
      );
      expect(JSON.stringify(inventory)).not.toContain("local-cloud");
      expect(JSON.stringify(inventory)).not.toContain("external-exists");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("labels inventory as ledger-local-inventory when an allowed ledger row matches", async () => {
    const ledgerRows = parseProviderLedger([
      "## Ledger",
      "| id | provider | resource type | environment | owner account/project | name | external id/url | purpose | created by | created at | expected cleanup trigger/date | current status | cleanup command/procedure | cleaned at | evidence link/path | notes |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      "| row-secret-123 | convex | deployment | preview | team | acme-crm-preview | https://dashboard.convex.dev/d/acme | preview deployment | jc | 2026-06-21 | remove after tests | active | convex dashboard delete |  | evidence/provider.md | ok |"
    ].join("\n"));
    const inventory = await createProviderInventory({
      cwd: "/tmp/no-state",
      manifest: createDefaultManifest("acme-crm"),
      service: "convex",
      environment: "preview",
      ledgerRows
    });

    expect(inventory.evidence).toBe("ledger-local-inventory");
    expect(inventory.rows[0]).toMatchObject({ ledgerStatus: "active", externalIdSummary: "redacted" });
    expect(JSON.stringify(inventory)).not.toContain("row-secret-123");
    expect(JSON.stringify(inventory)).not.toContain("dashboard.convex.dev/d/acme");
  });

  it("writes local provider link state only when the ledger row is planned or active", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentstack-provider-link-"));
    try {
      const rows = parseProviderLedger([
        "## Ledger",
        "| id | provider | resource type | environment | owner account/project | name | external id/url | purpose | created by | created at | expected cleanup trigger/date | current status | cleanup command/procedure | cleaned at | evidence link/path | notes |",
        "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
        "| row-convex-preview | convex | deployment | preview | team | acme-crm-preview | convex-preview | preview deployment | jc | 2026-06-21 | remove after tests | planned | convex dashboard delete |  | evidence/provider.md | ok |"
      ].join("\n"));

      const result = await linkLedgerBackedProviderResource({
        cwd: dir,
        service: "convex",
        environment: "preview",
        resourceType: "deployment",
        name: "acme-crm-preview",
        ledgerRows: rows
      });

      expect(result.ok).toBe(true);
      expect(result.evidence).toBe("ledger-local-inventory");
      const state = await readProviderLinkState(dir);
      expect(state.links).toContainEqual(
        expect.objectContaining({
          service: "convex",
          environment: "preview",
          resourceType: "deployment",
          name: "acme-crm-preview",
          ledgerStatus: "planned"
        })
      );
      expect(JSON.stringify(state)).not.toContain("row-convex-preview");
      expect(JSON.stringify(state)).not.toContain("convex-preview");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("blocks link for missing, incomplete, or blocked ledger rows without writing state", async () => {
    const dir = await mkdtemp(join(tmpdir(), "agentstack-provider-link-blocked-"));
    try {
      const result = await linkLedgerBackedProviderResource({
        cwd: dir,
        service: "vercel",
        environment: "preview",
        resourceType: "project",
        name: "acme-crm",
        ledgerRows: []
      });

      expect(result.ok).toBe(false);
      await expect(readFile(join(dir, ".agentstack", "provider-links.json"), "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("prints adopt proposals without writing root ledger truth or leaking raw external identifiers", async () => {
    const proposal = buildProviderAdoptProposal({
      service: "clerk",
      environment: "production",
      resourceType: "application",
      name: "acme-crm",
      externalIdOrUrl: "sk_live_secret_123456789",
      ownerAccountOrProject: "cardinal",
      purpose: "production auth application",
      createdBy: "jc",
      createdAt: "2026-06-21",
      expectedCleanupTriggerOrDate: "project retirement",
      cleanupCommandOrProcedure: "delete through Clerk dashboard",
      evidenceLinkOrPath: "docs/evidence/clerk-production.md",
      notes: "adopted existing resource"
    });

    expect(proposal.mode).toBe("print-only");
    expect(proposal.lines.join("\n")).toContain("Provider ledger proposal");
    expect(proposal.lines.join("\n")).toContain("external id/url: redacted");
    expect(proposal.lines.join("\n")).not.toContain("sk_live_secret_123456789");
    expect(proposal.lines.join("\n")).not.toContain("row-");
  });
});
```

- [ ] **Step 2: Run adapter test to verify RED**

Run:

```bash
pnpm vitest run packages/adapters/src/provider-control-plane.test.ts
```

Expected: FAIL because `packages/adapters/src/provider-control-plane.ts` does not exist and the exported helpers are missing.

- [ ] **Step 3: Implement provider control-plane helpers**

Create `packages/adapters/src/provider-control-plane.ts` with these exported types and functions:

```ts
export type ProviderInventoryEvidence = "local-inventory" | "ledger-local-inventory";
export type ProviderResourceEvidence = "expected" | "ledger" | "local-link";
export type ProviderLocalLinkStatus = "missing" | "linked";

export type ProviderLinkRecord = {
  service: ServiceName | string;
  environment: "preview" | "production";
  resourceType: string;
  name: string;
  ledgerStatus: "planned" | "active";
  linkedAt: string;
};

export type ProviderLinkState = {
  version: 1;
  links: ProviderLinkRecord[];
};

export type ProviderInventoryRow = {
  service: ServiceName | string;
  environment: "preview" | "production";
  resourceType: string;
  name: string;
  evidence: ProviderResourceEvidence;
  localLink: ProviderLocalLinkStatus;
  ledgerStatus: ProviderLedgerStatus | "missing";
  externalIdSummary: "none" | "redacted";
};

export type ProviderInventory = {
  service: ServiceName | string;
  environment: "preview" | "production";
  evidence: ProviderInventoryEvidence;
  rows: ProviderInventoryRow[];
};
```

Implementation requirements:

- `ProviderLedgerRow` currently exposes ledger fields as `status` and `resourceName`. The `ledgerStatus` and `name` fields shown below are new provider-control-plane output/local-state fields, mapped from ledger `status` and `resourceName` where a ledger row contributes evidence. Do not treat `ledgerStatus` or `name` as existing ledger row fields.
- `createProviderInventory({ cwd, manifest, service, environment, ledgerRows })` returns expected provider resources for the selected service/env:
  - `convex`: `deployment`, preview name `${manifest.app.slug}-preview`, production name `prod`.
  - `vercel`: `project`, name `${manifest.app.slug}`.
  - `clerk`: `application`, name `${manifest.app.slug}-${environment}`.
  - `eas`: `project`, name `${manifest.app.slug}`.
- Read `.agentstack/provider-links.json` when present. Treat invalid JSON as empty state for inventory only.
- Never read `.agentstack/local-cloud.json` in these helpers.
- `externalIdSummary` is `redacted` when the matching ledger row has a non-empty `externalIdOrUrl`, otherwise `none`.
- `linkLedgerBackedProviderResource(...)` uses `enforceProviderLedgerResource(rows, expectedMatch)` and writes `.agentstack/provider-links.json` only when the decision is `ok`.
- The provider link file stores service, environment, resourceType, name, allowed ledger status, and `linkedAt`; it does not store row ID or external ID.
- `buildProviderAdoptProposal(...)` returns `{ mode: "print-only", lines: string[] }`, includes all explicit row fields, and redacts `externalIdOrUrl` in printable output.
- Add small internal helpers for `redactExternalId`, `expectedProviderResource`, and `providerLinkStatePath`; do not add alias command names or compatibility fallback names.

- [ ] **Step 4: Export helpers**

Modify `packages/adapters/src/index.ts`:

```ts
export * from "./provider-control-plane.js";
```

- [ ] **Step 5: Run adapter test to verify GREEN**

Run:

```bash
pnpm vitest run packages/adapters/src/provider-control-plane.test.ts
```

Expected: PASS. Confirm the test output has no provider CLI execution and no raw `row-secret-123`, `convex-preview`, or `sk_live_secret_123456789` strings in assertion failure output.

### Task 2: CLI Provider Inventory Link Adopt Commands

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Write failing CLI contract tests**

Add focused tests to `packages/cli/src/run.test.ts` near the existing provider command tests:

```ts
it("prints provider inventory from ledger and local state without provider executor calls", async () => {
  await writeProviderLedger([
    "| row-convex-preview | convex | deployment | preview | team | acme-crm-preview | https://dashboard.convex.dev/d/secret | preview deployment | jc | 2026-06-21 | remove after tests | active | convex dashboard delete |  | evidence/provider.md | ok |"
  ]);

  const code = await runAgentstack(["provider", "inventory", "--service", "convex", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line),
    providerExecutor: fakeProviderExecutor
  });

  expect(code).toBe(0);
  expect(providerExecutions).toEqual([]);
  expect(output).toContain("PASS provider inventory convex preview");
  expect(output).toContain("Evidence: ledger-local-inventory");
  expect(output.join("\n")).toContain("Resource: convex preview deployment acme-crm-preview ledger=active local-link=missing external-id=redacted evidence=ledger");
  expect(output.join("\n")).not.toContain("row-convex-preview");
  expect(output.join("\n")).not.toContain("dashboard.convex.dev/d/secret");
  expect(output.join("\n")).not.toContain("live-read");
});

it("links a ledger-backed provider resource into local Agentstack state only", async () => {
  await writeProviderLedger([
    "| row-vercel-preview | vercel | project | preview | team | acme-crm | vercel-secret-id | preview project | jc | 2026-06-21 | remove after tests | planned | vercel dashboard delete |  | evidence/provider.md | ok |"
  ]);

  const beforeLedger = await readFile(join(dir, "docs/provider-resource-ledger.md"), "utf8");
  const code = await runAgentstack(
    ["provider", "link", "--service", "vercel", "--env", "preview", "--resource-type", "project", "--name", "acme-crm"],
    { cwd: dir, write: (line) => output.push(line), providerExecutor: fakeProviderExecutor }
  );
  const afterLedger = await readFile(join(dir, "docs/provider-resource-ledger.md"), "utf8");
  const localLinks = JSON.parse(await readFile(join(dir, ".agentstack/provider-links.json"), "utf8"));

  expect(code).toBe(0);
  expect(providerExecutions).toEqual([]);
  expect(afterLedger).toBe(beforeLedger);
  expect(output).toContain("LINKED provider vercel preview");
  expect(output).toContain("Evidence: ledger-local-inventory");
  expect(output.join("\n")).not.toContain("row-vercel-preview");
  expect(output.join("\n")).not.toContain("vercel-secret-id");
  expect(localLinks.links).toContainEqual(
    expect.objectContaining({ service: "vercel", environment: "preview", resourceType: "project", name: "acme-crm" })
  );
});

it("blocks provider link without a planned or active ledger row", async () => {
  const code = await runAgentstack(
    ["provider", "link", "--service", "vercel", "--env", "preview", "--resource-type", "project", "--name", "acme-crm"],
    { cwd: dir, write: (line) => output.push(line), providerExecutor: fakeProviderExecutor }
  );

  expect(code).toBe(1);
  expect(providerExecutions).toEqual([]);
  expect(output.join("\n")).toContain("FAIL provider.ledger.missing");
  await expect(readFile(join(dir, ".agentstack/provider-links.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
});

it("prints provider adopt proposal without mutating ledger or local link state", async () => {
  const beforeLedger = await readFile(join(dir, "docs/provider-resource-ledger.md"), "utf8");
  const code = await runAgentstack(
    [
      "provider", "adopt",
      "--service", "clerk",
      "--env", "production",
      "--resource-type", "application",
      "--name", "acme-crm-production",
      "--external-id", "sk_live_secret_123456789",
      "--owner", "cardinal",
      "--purpose", "production auth application",
      "--created-by", "jc",
      "--created-at", "2026-06-21",
      "--cleanup", "delete through Clerk dashboard",
      "--cleanup-trigger", "project retirement",
      "--evidence", "docs/evidence/clerk-production.md",
      "--notes", "adopted existing resource"
    ],
    { cwd: dir, write: (line) => output.push(line), providerExecutor: fakeProviderExecutor }
  );
  const afterLedger = await readFile(join(dir, "docs/provider-resource-ledger.md"), "utf8");

  expect(code).toBe(0);
  expect(providerExecutions).toEqual([]);
  expect(afterLedger).toBe(beforeLedger);
  expect(output).toContain("PROPOSED provider adopt clerk production");
  expect(output).toContain("Mutation: none");
  expect(output.join("\n")).toContain("Provider ledger proposal");
  expect(output.join("\n")).not.toContain("sk_live_secret_123456789");
  await expect(readFile(join(dir, ".agentstack/provider-links.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
});

it("rejects stale provider aliases", async () => {
  for (const alias of ["import", "connect", "attach", "discover", "resources"]) {
    output = [];
    const code = await runAgentstack(["provider", alias, "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });
    expect(code).toBe(1);
    expect(output).toContain("FAIL cli.unknown-command");
  }
});
```

Add a test helper in the same file:

```ts
async function writeProviderLedger(rows: string[]): Promise<void> {
  await mkdir(join(dir, "docs"), { recursive: true });
  await writeFile(
    join(dir, "docs/provider-resource-ledger.md"),
    [
      "# Provider Resource Ledger",
      "",
      "## Ledger",
      "| id | provider | resource type | environment | owner account/project | name | external id/url | purpose | created by | created at | expected cleanup trigger/date | current status | cleanup command/procedure | cleaned at | evidence link/path | notes |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      ...rows,
      ""
    ].join("\n"),
    "utf8"
  );
}

const fakeProviderExecutor: ProviderCommandExecutor = async ({ command, args, stdin }) => {
  providerExecutions.push({ command, args, stdin });
  return { commandKind: "test", status: "succeeded", exitCode: 0, stdoutSummary: "ok", stderrSummary: "" };
};
```

- [ ] **Step 2: Run CLI tests to verify RED**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "provider inventory|links a ledger-backed|blocks provider link|provider adopt|stale provider aliases"
```

Expected: FAIL because `provider inventory`, `provider link`, and `provider adopt` dispatch paths are missing.

- [ ] **Step 3: Add command dispatch and imports**

Modify `packages/cli/src/run.ts` imports from `@agentstack/adapters` to include:

```ts
  buildProviderAdoptProposal,
  createProviderInventory,
  linkLedgerBackedProviderResource,
  parseProviderLedger,
  providerLedgerPath,
  type ProviderInventoryRow
```

Add dispatch beside existing provider subcommands:

```ts
    if (command === "provider" && subcommand === "inventory") {
      return await providerInventoryCommand(rest, io);
    }

    if (command === "provider" && subcommand === "link") {
      return await providerLinkCommand(rest, io);
    }

    if (command === "provider" && subcommand === "adopt") {
      return await providerAdoptCommand(rest, io);
    }
```

- [ ] **Step 4: Implement local ledger loading and service/env validation helpers**

Add helpers near provider command helpers:

```ts
async function readProviderLedgerRowsForControlPlane(cwd: string): Promise<ReturnType<typeof parseProviderLedger>> {
  try {
    return parseProviderLedger(await readFile(join(cwd, providerLedgerPath), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function readProviderControlService(value: string | boolean | undefined, fix: string): "clerk" | "convex" | "vercel" | "eas" {
  const service = readRequiredStringOption(value, "service", fix);
  if (service === "clerk" || service === "convex" || service === "vercel" || service === "eas") {
    return service;
  }
  throw new Error(["FAIL cli.option.invalid", `Invalid --service value: ${service}. Expected one of: clerk, convex, vercel, eas.`, `Fix: ${fix}`].join("\n"));
}

function readProviderControlEnvironment(value: string | boolean | undefined, fix: string): "preview" | "production" {
  return readProviderRuntimeEnvironmentOption(value, fix);
}

function formatInventoryRow(row: ProviderInventoryRow): string {
  return `Resource: ${row.service} ${row.environment} ${row.resourceType} ${row.name} ledger=${row.ledgerStatus} local-link=${row.localLink} external-id=${row.externalIdSummary} evidence=${row.evidence}`;
}
```

- [ ] **Step 5: Implement `provider inventory`**

Add:

```ts
async function providerInventoryCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const fix = "Run agentstack provider inventory --service clerk --env preview.";
  const service = readProviderControlService(options.service, fix);
  const environment = readProviderControlEnvironment(options.env, fix);
  const validation = await runLocalValidationGate(io.cwd);
  validation.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return 1;
  }

  const inventory = await createProviderInventory({
    cwd: io.cwd,
    manifest: validation.context.manifest,
    service,
    environment,
    ledgerRows: await readProviderLedgerRowsForControlPlane(io.cwd)
  });

  io.write(`PASS provider inventory ${service} ${environment}`);
  io.write(`Evidence: ${inventory.evidence}`);
  io.write("Mutation: none");
  inventory.rows.forEach((row) => io.write(formatInventoryRow(row)));
  await recordCommandEvent(io, {
    name: "agentstack.provider.inventory.completed",
    environment,
    journey: "provider-inventory",
    command: ["provider", "inventory", ...argv].join(" "),
    status: "ok",
    state: { service, evidence: inventory.evidence, resources: inventory.rows.length }
  });
  return 0;
}
```

- [ ] **Step 6: Implement `provider link`**

Add:

```ts
async function providerLinkCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const fix = "Run agentstack provider link --service convex --env preview --resource-type deployment --name acme-crm-preview.";
  const service = readProviderControlService(options.service, fix);
  const environment = readProviderControlEnvironment(options.env, fix);
  const resourceType = readRequiredStringOption(options["resource-type"], "resource-type", fix);
  const name = readRequiredStringOption(options.name, "name", fix);
  const validation = await runLocalValidationGate(io.cwd);
  validation.diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  if (validation.diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return 1;
  }

  const result = await linkLedgerBackedProviderResource({
    cwd: io.cwd,
    service,
    environment,
    resourceType,
    name,
    ledgerRows: await readProviderLedgerRowsForControlPlane(io.cwd)
  });

  if (!result.ok) {
    io.write(providerLedgerDiagnostic(result.decision));
    return 1;
  }

  io.write(`LINKED provider ${service} ${environment}`);
  io.write("Evidence: ledger-local-inventory");
  io.write("Mutation scope: local Agentstack provider link state");
  io.write(`Resource: ${service} ${environment} ${resourceType} ${name} ledger=${result.ledgerStatus} external-id=redacted`);
  await recordCommandEvent(io, {
    name: "agentstack.provider.link.completed",
    environment,
    journey: "provider-link",
    command: ["provider", "link", ...argv].join(" "),
    status: "ok",
    state: { service, resourceType }
  });
  return 0;
}
```

- [ ] **Step 7: Implement `provider adopt` as print-only**

Add:

```ts
async function providerAdoptCommand(argv: string[], io: RunIo): Promise<number> {
  const options = parseOptions(argv);
  const fix = "Run agentstack provider adopt --service clerk --env preview --resource-type application --name acme-crm-preview --external-id <redacted> --owner <owner> --purpose <purpose> --created-by <name> --created-at 2026-06-21 --cleanup <procedure> --cleanup-trigger <trigger> --evidence <path>.";
  const service = readProviderControlService(options.service, fix);
  const environment = readProviderControlEnvironment(options.env, fix);
  const proposal = buildProviderAdoptProposal({
    service,
    environment,
    resourceType: readRequiredStringOption(options["resource-type"], "resource-type", fix),
    name: readRequiredStringOption(options.name, "name", fix),
    externalIdOrUrl: readRequiredStringOption(options["external-id"], "external-id", fix),
    ownerAccountOrProject: readRequiredStringOption(options.owner, "owner", fix),
    purpose: readRequiredStringOption(options.purpose, "purpose", fix),
    createdBy: readRequiredStringOption(options["created-by"], "created-by", fix),
    createdAt: readRequiredStringOption(options["created-at"], "created-at", fix),
    expectedCleanupTriggerOrDate: readRequiredStringOption(options["cleanup-trigger"], "cleanup-trigger", fix),
    cleanupCommandOrProcedure: readRequiredStringOption(options.cleanup, "cleanup", fix),
    evidenceLinkOrPath: readRequiredStringOption(options.evidence, "evidence", fix),
    notes: typeof options.notes === "string" ? options.notes : ""
  });

  io.write(`PROPOSED provider adopt ${service} ${environment}`);
  io.write("Evidence: local-inventory");
  io.write("Mutation: none");
  proposal.lines.forEach((line) => io.write(line));
  return 0;
}
```

Do not add telemetry to `providerAdoptCommand` in this first slice. In particular, never record unredacted adopt command arguments, because they can include `--external-id`; if adopt telemetry is added in a later slice, it must use a purpose-built redacted event payload that omits the external ID entirely.

- [ ] **Step 8: Run CLI focused tests to verify GREEN**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "provider inventory|links a ledger-backed|blocks provider link|provider adopt|stale provider aliases"
```

Expected: PASS. Confirm `providerExecutions` stays empty in inventory/link/adopt tests.

### Task 3: Template Scripts, Docs, and Generator Tests

**Files:**
- Modify: `templates/b2b-saas/package.json`
- Modify: `packages/create-agent-stack/templates/b2b-saas/package.json`
- Modify: `templates/b2b-saas/apps/mobile/package.json`
- Modify: `packages/create-agent-stack/templates/b2b-saas/apps/mobile/package.json`
- Modify: `templates/b2b-saas/docs/agentstack/environments.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/environments.md`
- Modify: `templates/b2b-saas/docs/agentstack/preview.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/preview.md`
- Modify: `templates/b2b-saas/docs/agentstack/workflows.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/workflows.md`
- Modify: `packages/create-agent-stack/src/generate.test.ts`

- [ ] **Step 1: Write failing generator assertions**

In `packages/create-agent-stack/src/generate.test.ts`, extend the root package script assertion:

```ts
        "provider:clerk:inventory:preview": "node scripts/agentstack.mjs provider inventory --service clerk --env preview",
        "provider:clerk:link:preview": "node scripts/agentstack.mjs provider link --service clerk --env preview --resource-type application --name __APP_SLUG__-preview",
        "provider:clerk:adopt:preview": "node scripts/agentstack.mjs provider adopt --service clerk --env preview --resource-type application --name __APP_SLUG__-preview",
        "provider:convex:inventory:preview": "node scripts/agentstack.mjs provider inventory --service convex --env preview",
        "provider:convex:link:preview": "node scripts/agentstack.mjs provider link --service convex --env preview --resource-type deployment --name __APP_SLUG__-preview",
        "provider:convex:adopt:preview": "node scripts/agentstack.mjs provider adopt --service convex --env preview --resource-type deployment --name __APP_SLUG__-preview",
        "provider:vercel:inventory:preview": "node scripts/agentstack.mjs provider inventory --service vercel --env preview",
        "provider:vercel:link:preview": "node scripts/agentstack.mjs provider link --service vercel --env preview --resource-type project --name __APP_SLUG__",
        "provider:vercel:adopt:preview": "node scripts/agentstack.mjs provider adopt --service vercel --env preview --resource-type project --name __APP_SLUG__",
        "provider:eas:inventory:preview": "node scripts/agentstack.mjs provider inventory --service eas --env preview",
        "provider:eas:link:preview": "node scripts/agentstack.mjs provider link --service eas --env preview --resource-type project --name __APP_SLUG__",
        "provider:eas:adopt:preview": "node scripts/agentstack.mjs provider adopt --service eas --env preview --resource-type project --name __APP_SLUG__"
```

Also assert generated docs contain the key invariants:

```ts
      await expect(readFile(join(targetDir, "docs/agentstack/environments.md"), "utf8")).resolves.toContain(
        "provider inventory"
      );
      await expect(readFile(join(targetDir, "docs/agentstack/environments.md"), "utf8")).resolves.toContain(
        "Evidence: ledger-local-inventory"
      );
      await expect(readFile(join(targetDir, "docs/agentstack/environments.md"), "utf8")).resolves.toContain(
        "does not treat `.agentstack/local-cloud.json` as external provider evidence"
      );
      await expect(readFile(join(targetDir, "docs/agentstack/preview.md"), "utf8")).resolves.toContain(
        "provider link"
      );
      await expect(readFile(join(targetDir, "docs/agentstack/workflows.md"), "utf8")).resolves.toContain(
        "sync local service links are not proof of external provider existence"
      );
```

Add negative assertions:

```ts
      expect(packageManifest.scripts).not.toHaveProperty("provider:clerk:import:preview");
      expect(packageManifest.scripts).not.toHaveProperty("provider:convex:connect:preview");
      expect(packageManifest.scripts).not.toHaveProperty("provider:vercel:attach:preview");
      expect(packageManifest.scripts).not.toHaveProperty("provider:eas:discover:preview");
      expect(packageManifest.scripts).not.toHaveProperty("provider:resources:preview");
```

- [ ] **Step 2: Run generator test to verify RED**

Run:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
```

Expected: FAIL because template scripts and docs do not yet contain inventory/link/adopt guidance.

- [ ] **Step 3: Update root and package-local root package scripts**

In both `templates/b2b-saas/package.json` and `packages/create-agent-stack/templates/b2b-saas/package.json`, add scripts with tokenized names where the generator can replace `__APP_SLUG__`:

```json
"provider:clerk:inventory:preview": "node scripts/agentstack.mjs provider inventory --service clerk --env preview",
"provider:clerk:link:preview": "node scripts/agentstack.mjs provider link --service clerk --env preview --resource-type application --name __APP_SLUG__-preview",
"provider:clerk:adopt:preview": "node scripts/agentstack.mjs provider adopt --service clerk --env preview --resource-type application --name __APP_SLUG__-preview",
"provider:clerk:inventory:production": "node scripts/agentstack.mjs provider inventory --service clerk --env production",
"provider:clerk:link:production": "node scripts/agentstack.mjs provider link --service clerk --env production --resource-type application --name __APP_SLUG__-production",
"provider:clerk:adopt:production": "node scripts/agentstack.mjs provider adopt --service clerk --env production --resource-type application --name __APP_SLUG__-production",
"provider:convex:inventory:preview": "node scripts/agentstack.mjs provider inventory --service convex --env preview",
"provider:convex:link:preview": "node scripts/agentstack.mjs provider link --service convex --env preview --resource-type deployment --name __APP_SLUG__-preview",
"provider:convex:adopt:preview": "node scripts/agentstack.mjs provider adopt --service convex --env preview --resource-type deployment --name __APP_SLUG__-preview",
"provider:convex:inventory:production": "node scripts/agentstack.mjs provider inventory --service convex --env production",
"provider:convex:link:production": "node scripts/agentstack.mjs provider link --service convex --env production --resource-type deployment --name prod",
"provider:convex:adopt:production": "node scripts/agentstack.mjs provider adopt --service convex --env production --resource-type deployment --name prod",
"provider:vercel:inventory:preview": "node scripts/agentstack.mjs provider inventory --service vercel --env preview",
"provider:vercel:link:preview": "node scripts/agentstack.mjs provider link --service vercel --env preview --resource-type project --name __APP_SLUG__",
"provider:vercel:adopt:preview": "node scripts/agentstack.mjs provider adopt --service vercel --env preview --resource-type project --name __APP_SLUG__",
"provider:vercel:inventory:production": "node scripts/agentstack.mjs provider inventory --service vercel --env production",
"provider:vercel:link:production": "node scripts/agentstack.mjs provider link --service vercel --env production --resource-type project --name __APP_SLUG__",
"provider:vercel:adopt:production": "node scripts/agentstack.mjs provider adopt --service vercel --env production --resource-type project --name __APP_SLUG__",
"provider:eas:inventory:preview": "node scripts/agentstack.mjs provider inventory --service eas --env preview",
"provider:eas:link:preview": "node scripts/agentstack.mjs provider link --service eas --env preview --resource-type project --name __APP_SLUG__",
"provider:eas:adopt:preview": "node scripts/agentstack.mjs provider adopt --service eas --env preview --resource-type project --name __APP_SLUG__",
"provider:eas:inventory:production": "node scripts/agentstack.mjs provider inventory --service eas --env production",
"provider:eas:link:production": "node scripts/agentstack.mjs provider link --service eas --env production --resource-type project --name __APP_SLUG__",
"provider:eas:adopt:production": "node scripts/agentstack.mjs provider adopt --service eas --env production --resource-type project --name __APP_SLUG__"
```

- [ ] **Step 4: Update mobile EAS scripts in both template mirrors**

In both `templates/b2b-saas/apps/mobile/package.json` and `packages/create-agent-stack/templates/b2b-saas/apps/mobile/package.json`, add:

```json
"provider:eas:inventory:preview": "node ../../scripts/agentstack.mjs provider inventory --service eas --env preview",
"provider:eas:link:preview": "node ../../scripts/agentstack.mjs provider link --service eas --env preview --resource-type project --name __APP_SLUG__",
"provider:eas:adopt:preview": "node ../../scripts/agentstack.mjs provider adopt --service eas --env preview --resource-type project --name __APP_SLUG__",
"provider:eas:inventory:production": "node ../../scripts/agentstack.mjs provider inventory --service eas --env production",
"provider:eas:link:production": "node ../../scripts/agentstack.mjs provider link --service eas --env production --resource-type project --name __APP_SLUG__",
"provider:eas:adopt:production": "node ../../scripts/agentstack.mjs provider adopt --service eas --env production --resource-type project --name __APP_SLUG__"
```

- [ ] **Step 5: Update generated docs in both template mirrors**

Add this exact semantics to `docs/agentstack/environments.md` in both template trees:

```md
### Provider Inventory, Link, and Adopt

Use `agentstack provider inventory --service <clerk|convex|vercel|eas> --env <preview|production>` to inspect Agentstack's local control-plane view of expected provider resources. Inventory is read-only, prints `Evidence: local-inventory` or `Evidence: ledger-local-inventory`, and does not call provider CLIs. It does not treat `.agentstack/local-cloud.json` as external provider evidence; sync local service links are simulator state only.

Use `agentstack provider link --service <service> --env <env> --resource-type <type> --name <name>` only after the root provider ledger has a matching `planned` or `active` row. Link writes `.agentstack/provider-links.json` in the local project and does not mutate providers or `docs/provider-resource-ledger.md`. Output redacts provider ledger row IDs and external IDs.

Use `agentstack provider adopt --service <service> --env <env> --resource-type <type> --name <name> --external-id <id-or-url> --owner <owner> --purpose <purpose> --created-by <name> --created-at <yyyy-mm-dd> --cleanup <procedure> --cleanup-trigger <trigger> --evidence <path>` to print a safe ledger proposal. Adopt is print-only in this slice; it does not write the root ledger and does not write local link state.
```

Add preview usage to `docs/agentstack/preview.md` in both template trees:

```md
Inventory provider control-plane state:

```bash
pnpm run provider:convex:inventory:preview
pnpm run provider:vercel:inventory:preview
```

Link a ledger-backed preview resource after adding a `planned` or `active` root ledger row:

```bash
pnpm run provider:convex:link:preview
```

Print an adoption proposal for an existing provider resource without changing the root ledger:

```bash
pnpm run provider:convex:adopt:preview -- --external-id <redacted> --owner <owner> --purpose "preview deployment" --created-by <name> --created-at 2026-06-21 --cleanup "delete through provider dashboard" --cleanup-trigger "project retirement" --evidence docs/evidence/convex-preview.md
```
```

Add the workflow invariant to `docs/agentstack/workflows.md` in both template trees:

```md
Provider inventory/link/adopt are separate from sync. Sync local service links are not proof of external provider existence; `.agentstack/local-cloud.json` is simulator state for rehearsal. Use `provider inventory` for the local control-plane view, `provider link` only for ledger-backed known resources, and `provider adopt` to print a proposal for manual ledger review.
```

- [ ] **Step 6: Run generator test to verify GREEN**

Run:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
```

Expected: PASS.

- [ ] **Step 7: Check template parity**

Run:

```bash
diff -ru templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

Expected: no output. If there is output, update the stale mirror so the command exits `0`.

### Task 4: Spec Review and Verification

**Files:**
- Review: `packages/adapters/src/provider-control-plane.ts`
- Review: `packages/adapters/src/provider-control-plane.test.ts`
- Review: `packages/cli/src/run.ts`
- Review: `packages/cli/src/run.test.ts`
- Review: `templates/b2b-saas/**`
- Review: `packages/create-agent-stack/templates/b2b-saas/**`
- Review: `docs/provider-resource-ledger.md`

- [ ] **Step 1: Run focused adapter tests**

Run:

```bash
pnpm vitest run packages/adapters/src/provider-control-plane.test.ts packages/adapters/src/provider-ledger.test.ts packages/adapters/src/provider-operations.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused CLI tests**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "provider"
```

Expected: PASS. Confirm the inventory/link/adopt tests assert `providerExecutions` remains `[]`.

- [ ] **Step 3: Run generator tests**

Run:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
```

Expected: PASS.

- [ ] **Step 4: Verify no provider CLIs are invoked by new commands**

Run:

```bash
rg -n "providerInventoryCommand|providerLinkCommand|providerAdoptCommand|resolveProviderExecutor|inspectClerkReadOnly|inspectConvexReadOnly|inspectEasPreviewReadOnly|executeConvexApply|executeVercelPreviewApply" packages/cli/src/run.ts
```

Expected: `providerInventoryCommand`, `providerLinkCommand`, and `providerAdoptCommand` appear; none of those function bodies call `resolveProviderExecutor`, `inspect*ReadOnly`, or `execute*Apply`.

- [ ] **Step 5: Verify root ledger unchanged**

Run:

```bash
git diff -- docs/provider-resource-ledger.md
```

Expected: no output.

- [ ] **Step 6: Verify no stale aliases shipped**

Run:

```bash
rg -n "provider (import|connect|attach|discover|resources)|provider:(clerk|convex|vercel|eas):(import|connect|attach|discover|resources)|provider:resources" packages templates docs
```

Expected: no output.

- [ ] **Step 7: Verify no secret or raw row-id leakage in tests and docs**

Run:

```bash
rg -n "row-[a-z0-9-]+|sk_live_secret|sk-local-provider-value|dashboard\\.convex\\.dev/d/secret|vercel-secret-id|external id/url: [^r]" packages/adapters/src/provider-control-plane.ts packages/cli/src/run.ts templates packages/create-agent-stack/templates
```

Expected: no output, except test fixtures may contain secret-like strings only in test input setup and must also assert those strings are absent from command/helper output.

- [ ] **Step 8: Verify template parity**

Run:

```bash
diff -ru templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

Expected: no output.

- [ ] **Step 9: Run framework gates**

Run:

```bash
pnpm typecheck
pnpm test
```

Expected: both commands pass.

## Acceptance Checks

- `agentstack provider inventory --service <clerk|convex|vercel|eas> --env <preview|production>` exists, is read-only, does not write `.agentstack/local-cloud.json`, does not write `.agentstack/provider-links.json`, does not mutate `docs/provider-resource-ledger.md`, and does not call provider CLIs.
- `inventory` labels evidence truthfully as `local-inventory` or `ledger-local-inventory`; it never prints `live-read` unless a future implementation actually executes read-only provider commands.
- `agentstack provider link --service <clerk|convex|vercel|eas> --env <preview|production> --resource-type <type> --name <name>` writes only `.agentstack/provider-links.json` and only after a matching `planned` or `active` ledger row.
- `link` does not call provider CLIs, does not create external resources, does not mutate the root provider ledger, and does not reuse `sync` local service links as proof of external existence.
- `agentstack provider adopt --service <clerk|convex|vercel|eas> --env <preview|production> ...` prints a safe ledger proposal and writes no files in this first slice.
- Root provider ledger `docs/provider-resource-ledger.md` remains unchanged by the implementation.
- No aliases or command names are introduced for `import`, `connect`, `attach`, `discover`, or `resources`.
- Output redacts raw secrets, secret-like external IDs, and raw provider ledger row IDs.
- Root templates and `packages/create-agent-stack` template mirrors are byte-for-byte aligned.
- Focused tests pass, then `pnpm typecheck` and `pnpm test` pass.

## Assumptions

- Provider resource names in this first slice are deterministic from the current manifest: Convex preview `${app.slug}-preview`, Convex production `prod`, Vercel project `${app.slug}`, Clerk application `${app.slug}-${environment}`, and EAS project `${app.slug}`.
- `.agentstack/provider-links.json` is the new local Agentstack project state for ledger-backed provider links; `.agentstack/local-cloud.json` remains simulator state and is not read by provider control-plane helpers.
- Adopt remains print-only for this wave to avoid laundering local guesses into authoritative ledger truth.
