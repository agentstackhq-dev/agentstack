# Agentstack Wave 0 Ledger Enforcement And Truth Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the provider resource ledger before supported live provider mutations and label every relevant command output with honest evidence scope.

**Architecture:** Add a small adapter-layer ledger parser and gate the CLI provider apply path before the provider executor is resolved or called. Keep local rehearsal commands local-only, add explicit `Evidence:` lines to command output, and update root docs, generated template docs, package-local template mirrors, and spinup-site copy in the same change.

**Tech Stack:** TypeScript, Vitest, Node `fs/promises`, pnpm workspaces, markdown ledger table parsing, existing `@agentstack/core` diagnostics, existing provider executor abstraction.

---

## Wave 0 Manifest Format Decision

Wave 0 standardizes on `agentstack.config.json` as the only manifest format. The implementation must replace `agentstack.config.ts` references across docs, specs, tests, generated guidance, and validation scans. Do not add TypeScript config readers, alternate manifest readers, aliases, migration shims, or fallback lookup paths in this slice.

## File Structure

- Modify: `README.md`
  - Explains evidence tiers, clarifies that `validate --cloud` is local-cloud rehearsal only in this slice, and states that `agentstack.config.json` is the Wave 0 manifest format.
- Create: `packages/adapters/src/provider-ledger.ts`
  - Owns markdown ledger parsing, status normalization, matching by `provider + environment + resource type + name`, and mutation-allow/block decisions.
- Modify: `packages/adapters/src/index.ts`
  - Exports the provider ledger parser and enforcement helpers.
- Modify: `packages/cli/src/run.ts`
  - Adds `Evidence:` lines to command output.
  - Calls ledger enforcement only for supported live mutation paths: `provider apply --service convex --env preview`, `provider apply --service convex --env production`, and `provider apply --service vercel --env preview`.
  - Leaves `provider plan`, `provider inspect`, unsupported apply paths, and local rehearsal commands free of ledger enforcement.
- Modify: `packages/cli/src/run.test.ts`
  - Adds ledger-gate tests, fake-executor non-execution assertions, and output evidence label assertions.
- Modify: `templates/b2b-saas/docs/agentstack/*.md`
  - Updates generated app guidance for `agentstack.config.json`, evidence tiers, local rehearsal wording, provider ledger gating, and explicit provider execution boundaries.
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/*.md`
  - Mirrors the template doc updates exactly with the root template.
- Modify: `docs/spinup-site/generated-app.html`, `docs/spinup-site/lab.html`, and related spinup data files if present
  - Keeps the static demo copy aligned with evidence tiers and local rehearsal boundaries.

## Evidence Tiers

- `local-rehearsal`: Command reads local files or writes local Agentstack artifacts only.
- `provider-command-plan`: Command prints provider CLI shapes and does not execute them.
- `live-read`: Command executes bounded read or diagnostic provider commands and performs no mutation.
- `live-mutation`: Command executes bounded provider mutation commands through the provider executor.

## Tasks

### Task 1: Enforce The Wave 0 Manifest Format In Docs And Scans

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-06-20-agent-first-meta-framework-design.md`
- Modify: `templates/b2b-saas/docs/agentstack/*.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/*.md`
- Modify: `docs/spinup-site/generated-app.html`
- Modify: `docs/spinup-site/lab.html`
- Test through scans only: no provider CLI commands

- [ ] **Step 1: Run the manifest-format scan before edits**

Run:

```bash
rg -n "agentstack\.config\.ts|agentstack\.config\.json" README.md docs/superpowers/specs/2026-06-20-agent-first-meta-framework-design.md templates packages/create-agent-stack/templates docs/spinup-site packages
```

Expected: the command may show both formats before edits. Record which files contain `agentstack.config.ts`; those are the runtime docs, source spec, templates, generated guidance, tests, and source files to update in this task unless later tasks deliberately edit additional generated guidance files. The Wave 0 implementation plan itself is intentionally outside this scan scope because it may name `agentstack.config.ts` as the removed format.

- [ ] **Step 2: Replace TypeScript manifest references with the JSON manifest**

In each file found in Step 1, replace references to `agentstack.config.ts` with `agentstack.config.json`. Use wording with this exact contract where a format decision is described:

```md
Wave 0 uses `agentstack.config.json` as the only Agentstack manifest format. Do not add `agentstack.config.ts` readers or fallback lookup paths in this slice.
```

- [ ] **Step 3: Add a manifest-format guard scan**

Run:

```bash
rg -n "agentstack\.config\.ts|TypeScript manifest|config reader fallback|fallback lookup path" README.md docs/superpowers/specs/2026-06-20-agent-first-meta-framework-design.md templates packages/create-agent-stack/templates docs/spinup-site packages
```

Expected: no output for `agentstack.config.ts`, TypeScript manifest support, or fallback manifest lookup in active docs, source spec, templates, generated guidance, tests, or source files. Hits for `agentstack.config.json` are allowed only if they refer to the JSON manifest as the required Wave 0 format. The Wave 0 implementation plan may still mention `agentstack.config.ts` only as the losing format workers must remove.

- [ ] **Step 4: Commit the manifest-format decision**

Run:

```bash
git add README.md docs/superpowers/specs/2026-06-20-agent-first-meta-framework-design.md templates/b2b-saas/docs/agentstack packages/create-agent-stack/templates/b2b-saas/docs/agentstack docs/spinup-site
git commit -m "docs: standardize wave 0 manifest format"
```

Expected: commit succeeds. No provider CLI commands are run.

### Task 2: Add Provider Ledger Parser Tests

**Files:**
- Modify: `packages/cli/src/run.test.ts`
- Test: `packages/adapters/src/provider-ledger.test.ts`
- Later create: `packages/adapters/src/provider-ledger.ts`

- [ ] **Step 1: Add a helper that writes a ledger table in CLI tests**

Add this helper near the other test helpers in `packages/cli/src/run.test.ts`:

```ts
async function writeProviderLedger(rows: string[]): Promise<void> {
  await mkdir(join(dir, "docs"), { recursive: true });
  await writeFile(
    join(dir, "docs/provider-resource-ledger.md"),
    [
      "# Provider Resource Ledger",
      "",
      "## Status Taxonomy",
      "",
      "| status | meaning |",
      "| --- | --- |",
      "| planned | approved but not yet created |",
      "| active | exists and is still needed |",
      "",
      "## Required Fields",
      "",
      "| field | required when |",
      "| --- | --- |",
      "| owner account/project | planned or active |",
      "| purpose | planned or active |",
      "",
      "## Ledger",
      "",
      "| id | provider | resource type | environment | owner account/project | name | external id/url | purpose | created by | created at | expected cleanup trigger/date | current status | cleanup command/procedure | cleaned at | evidence link/path | notes |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      ...rows,
      ""
    ].join("\n"),
    "utf8"
  );
}
```

- [ ] **Step 2: Add missing-ledger refusal test before implementation**

Add this test near the existing provider apply tests:

```ts
it("blocks Convex preview apply when the provider ledger has no matching deployment row", async () => {
  const code = await runAgentstack(["provider", "apply", "--service", "convex", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line),
    providerExecutor: createMockProviderExecutor("provider command should not run")
  });

  expect(code).toBe(1);
  expect(output.join("\n")).toContain("FAIL provider.ledger.missing");
  expect(output.join("\n")).toContain("Path: docs/provider-resource-ledger.md");
  expect(output.join("\n")).toContain("Blocks: provider apply");
  expect(output.join("\n")).toContain("convex preview deployment acme-crm-preview");
  expect(providerExecutions).toHaveLength(0);
});
```

- [ ] **Step 3: Add status-blocked refusal test before implementation**

Add this test after the missing-ledger test:

```ts
it("blocks provider apply when the matching ledger row is not planned or active", async () => {
  await writeProviderLedger([
    "| convex-preview | Convex | deployment | preview | test-account | acme-crm-preview | https://dashboard.convex.dev/example | Wave 0 test fixture | test | 2026-06-21 | after test | cleanup-pending | Delete deployment in Convex dashboard |  | docs/evidence/convex-preview.md | cleanup queued |"
  ]);

  const code = await runAgentstack(["provider", "apply", "--service", "convex", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line),
    providerExecutor: createMockProviderExecutor("provider command should not run")
  });

  expect(code).toBe(1);
  expect(output.join("\n")).toContain("FAIL provider.ledger.status-blocked");
  expect(output.join("\n")).toContain("cleanup-pending");
  expect(output.join("\n")).toContain("Fix: Change the matching ledger row to planned or active before running the provider mutation.");
  expect(providerExecutions).toHaveLength(0);
});
```

- [ ] **Step 4: Add allowed-ledger execution tests before implementation**

Add these tests after the blocked tests:

```ts
it("allows Convex preview apply when the ledger has a planned deployment row", async () => {
  await writeProviderEnvManifest();
  await writeLocalEnvValues({
    preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
  });
  await writeProviderLedger([
    "| convex-preview | Convex | deployment | preview | test-account | acme-crm-preview | pending | Wave 0 preview deployment | test | 2026-06-21 | after test | planned | Delete deployment in Convex dashboard |  | docs/evidence/convex-preview.md | planned fixture |"
  ]);

  const code = await runAgentstack(["provider", "apply", "--service", "convex", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line),
    providerExecutor: createMockProviderExecutor("set OPENAI_API_KEY=sk-local-provider-value")
  });

  expect(code).toBe(0);
  expect(output).toContain("APPLIED provider convex preview");
  expect(output).toContain("Evidence: live-mutation");
  expect(output).toContain("Mutation scope: bounded provider executor");
  expect(providerExecutions).toHaveLength(2);
});

it("allows Vercel preview apply when the ledger has a planned project row", async () => {
  const manifest = createDefaultManifest("acme-crm");
  manifest.env.custom.VERCEL_API_TOKEN = {
    surfaces: ["web"],
    environments: ["preview"],
    required: true,
    secret: true,
    providerTargets: vercelPreviewTarget
  };
  await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeLocalEnvValues({ preview: { web: { VERCEL_API_TOKEN: "provider-vercel-secret" } } });
  await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });
  await writeProviderLedger([
    "| vercel-preview | Vercel | project | preview | test-team | acme-crm | pending | Wave 0 Vercel preview project | test | 2026-06-21 | after test | planned | Delete project in Vercel dashboard |  | docs/evidence/vercel-preview.md | planned fixture |"
  ]);

  const code = await runAgentstack(["provider", "apply", "--service", "vercel", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line),
    providerExecutor: createMockProviderExecutor("deployed with API_TOKEN=provider-vercel-secret")
  });

  expect(code).toBe(0);
  expect(output).toContain("APPLIED provider vercel preview");
  expect(output).toContain("Evidence: live-mutation");
  expect(providerExecutions.map((execution) => execution.args.join(" "))).toEqual([
    "exec vercel deploy --target=preview"
  ]);
});
```

- [ ] **Step 5: Add incomplete-row tests before implementation**

Create `packages/adapters/src/provider-ledger.test.ts` with these tests:

```ts
import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { enforceProviderLedgerResource, parseProviderLedger } from "./provider-ledger.js";

const header = [
  "# Provider Resource Ledger",
  "",
  "## Status Taxonomy",
  "",
  "| status | meaning |",
  "| --- | --- |",
  "| planned | approved but not yet created |",
  "| active | exists and is still needed |",
  "",
  "## Required Fields",
  "",
  "| field | required when |",
  "| --- | --- |",
  "| owner account/project | planned or active |",
  "| purpose | planned or active |",
  "",
  "## Ledger",
  "",
  "| id | provider | resource type | environment | owner account/project | name | external id/url | purpose | created by | created at | expected cleanup trigger/date | current status | cleanup command/procedure | cleaned at | evidence link/path | notes |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
].join("\n");

const expectedMatch = {
  provider: "convex",
  environment: "preview",
  resourceType: "deployment",
  name: "acme-crm-preview"
} as const;

async function writeFixtureLedger(row: string): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), "agentstack-provider-ledger-"));
  await mkdir(join(cwd, "docs"), { recursive: true });
  await writeFile(join(cwd, "docs/provider-resource-ledger.md"), `${header}\n${row}\n`, "utf8");
  return cwd;
}

describe("enforceProviderLedgerResource", () => {
  it("fails closed when planned or active rows are missing required Wave 0 fields", async () => {
    await expect(
      enforceProviderLedgerResource(
        await writeFixtureLedger(
          "| convex-preview | Convex | deployment | preview |  | acme-crm-preview | pending | Wave 0 preview deployment | test | 2026-06-21 | after test | planned | Delete deployment in Convex dashboard |  | docs/evidence/convex-preview.md | missing owner |"
        ),
        expectedMatch
      )
    ).resolves.toMatchObject({ ok: false, reason: "incomplete", missingFields: ["owner account/project"] });

    await expect(
      enforceProviderLedgerResource(
        await writeFixtureLedger(
          "| convex-preview | Convex | deployment | preview | test-account | acme-crm-preview | pending |  | test | 2026-06-21 | after test | planned | Delete deployment in Convex dashboard |  | docs/evidence/convex-preview.md | missing purpose |"
        ),
        expectedMatch
      )
    ).resolves.toMatchObject({ ok: false, reason: "incomplete", missingFields: ["purpose"] });

    await expect(
      enforceProviderLedgerResource(
        await writeFixtureLedger(
          "| convex-preview | Convex | deployment | preview | test-account | acme-crm-preview | pending | Wave 0 preview deployment | test | 2026-06-21 | after test | active |  |  | docs/evidence/convex-preview.md | missing cleanup procedure |"
        ),
        expectedMatch
      )
    ).resolves.toMatchObject({ ok: false, reason: "incomplete", missingFields: ["cleanup command/procedure"] });

    await expect(
      enforceProviderLedgerResource(
        await writeFixtureLedger(
          "| convex-preview | Convex | deployment | preview | test-account | acme-crm-preview | pending | Wave 0 preview deployment | test | 2026-06-21 | after test | active | Delete deployment in Convex dashboard |  |  | missing evidence |"
        ),
        expectedMatch
      )
    ).resolves.toMatchObject({ ok: false, reason: "incomplete", missingFields: ["evidence link/path"] });
  });
});
```

These tests call `enforceProviderLedgerResource(cwd, expectedMatch)` because `parseProviderLedger()` owns syntactic parsing and status validation only. Required-field completeness belongs to the ledger enforcement decision so CLI formatting can emit the `provider.ledger.incomplete` diagnostic with `reason: "incomplete"`.

Required Wave 0 completeness fields for syntactically valid `planned` and `active` rows are `owner account/project`, `purpose`, `created by`, `created at`, `expected cleanup trigger/date`, `cleanup command/procedure`, and `evidence link/path`. Blank or unknown `current status` values are parser-invalid rows, not incomplete rows. `external id/url` and `cleaned at` may be blank or `pending` for planned resources.

- [ ] **Step 6: Add invalid-row tests before implementation**

Append these tests to `packages/adapters/src/provider-ledger.test.ts`:

```ts
describe("parseProviderLedger", () => {
  it("parses only the Ledger table and ignores earlier documentation tables", () => {
    expect(parseProviderLedger(`${header}
`)).toEqual([]);
  });

  it("fails closed on unknown ledger status", () => {
    expect(() =>
      parseProviderLedger(`${header}
| convex-preview | Convex | deployment | preview | test-account | acme-crm-preview | pending | Wave 0 preview deployment | test | 2026-06-21 | after test | pending-review | Delete deployment in Convex dashboard |  | docs/evidence/convex-preview.md | unknown status |
`)
    ).toThrow(/provider\.ledger\.invalid/);
  });

  it("fails closed on malformed ledger rows with the wrong cell count", () => {
    expect(() =>
      parseProviderLedger(`${header}
| convex-preview | Convex | deployment | preview | test-account | acme-crm-preview |
`)
    ).toThrow(/provider\.ledger\.invalid/);
  });
});
```

The parser must not silently drop malformed rows. Unknown status and bad cell count must produce an actionable invalid-ledger diagnostic that names `docs/provider-resource-ledger.md`, the row number, and the field problem.

- [ ] **Step 7: Run tests and verify they fail for the new behavior**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts packages/adapters/src/provider-ledger.test.ts
```

Expected: FAIL. Failures must show missing `provider.ledger.missing`, `provider.ledger.status-blocked`, `provider.ledger.incomplete`, or `provider.ledger.invalid` behavior or missing evidence lines, and no provider command may run in the blocked tests.

### Task 3: Implement Provider Ledger Parsing And Enforcement

**Files:**
- Create: `packages/adapters/src/provider-ledger.ts`
- Modify: `packages/adapters/src/index.ts`
- Modify: `packages/cli/src/run.ts`

- [ ] **Step 1: Create the ledger module**

Create `packages/adapters/src/provider-ledger.ts` with these exported types and functions:

```ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { EnvironmentName } from "@agentstack/core";

export type ProviderLedgerStatus =
  | "planned"
  | "active"
  | "cleanup-pending"
  | "cleaned"
  | "abandoned-with-reason";

export type ProviderLedgerResourceType =
  | "app"
  | "project"
  | "deployment"
  | "database"
  | "build"
  | "domain"
  | "integration";

export type ProviderLedgerRow = {
  id: string;
  provider: string;
  resourceType: string;
  environment: string;
  ownerAccountProject: string;
  name: string;
  externalIdUrl: string;
  purpose: string;
  createdBy: string;
  createdAt: string;
  expectedCleanupTriggerDate: string;
  currentStatus: ProviderLedgerStatus;
  cleanupCommandProcedure: string;
  cleanedAt: string;
  evidenceLinkPath: string;
  notes: string;
};

export type ProviderLedgerMatch = {
  provider: string;
  environment: EnvironmentName;
  resourceType: ProviderLedgerResourceType;
  name: string;
};

export type ProviderLedgerDecision =
  | { ok: true; row: ProviderLedgerRow; path: string }
  | { ok: false; reason: "missing"; expected: ProviderLedgerMatch; path: string }
  | { ok: false; reason: "invalid"; expected: ProviderLedgerMatch; path: string; message: string }
  | {
      ok: false;
      reason: "incomplete";
      expected: ProviderLedgerMatch;
      row: ProviderLedgerRow;
      path: string;
      missingFields: string[];
    }
  | {
      ok: false;
      reason: "status-blocked";
      expected: ProviderLedgerMatch;
      row: ProviderLedgerRow;
      path: string;
    };

const allowedStatuses = new Set<ProviderLedgerStatus>(["planned", "active"]);
const statuses = new Set<ProviderLedgerStatus>([
  "planned",
  "active",
  "cleanup-pending",
  "cleaned",
  "abandoned-with-reason"
]);

const requiredPlannedOrActiveFields: Array<[keyof ProviderLedgerRow, string]> = [
  ["ownerAccountProject", "owner account/project"],
  ["purpose", "purpose"],
  ["createdBy", "created by"],
  ["createdAt", "created at"],
  ["expectedCleanupTriggerDate", "expected cleanup trigger/date"],
  ["cleanupCommandProcedure", "cleanup command/procedure"],
  ["evidenceLinkPath", "evidence link/path"]
];

export async function enforceProviderLedgerResource(
  cwd: string,
  expected: ProviderLedgerMatch
): Promise<ProviderLedgerDecision> {
  const path = join(cwd, "docs/provider-resource-ledger.md");
  let text = "";
  try {
    text = await readFile(path, "utf8");
  } catch {
    return { ok: false, reason: "missing", expected, path: "docs/provider-resource-ledger.md" };
  }

  let rows: ProviderLedgerRow[] = [];
  try {
    rows = parseProviderLedger(text);
  } catch (error) {
    return {
      ok: false,
      reason: "invalid",
      expected,
      path: "docs/provider-resource-ledger.md",
      message: error instanceof Error ? error.message : "Provider resource ledger is invalid."
    };
  }

  const row = rows.find((candidate) => matchesProviderLedgerRow(candidate, expected));
  if (!row) {
    return { ok: false, reason: "missing", expected, path: "docs/provider-resource-ledger.md" };
  }

  const missingFields = missingRequiredLedgerFields(row);
  if (missingFields.length > 0) {
    return {
      ok: false,
      reason: "incomplete",
      expected,
      row,
      path: "docs/provider-resource-ledger.md",
      missingFields
    };
  }

  if (!allowedStatuses.has(row.currentStatus)) {
    return {
      ok: false,
      reason: "status-blocked",
      expected,
      row,
      path: "docs/provider-resource-ledger.md"
    };
  }

  return { ok: true, row, path: "docs/provider-resource-ledger.md" };
}

export function parseProviderLedger(text: string): ProviderLedgerRow[] {
  const lines = text.split(/\r?\n/);
  const ledgerHeadingIndex = lines.findIndex((line) => line.trim() === "## Ledger");
  if (ledgerHeadingIndex === -1) {
    return [];
  }

  const ledgerSectionLines: Array<{ line: string; rowNumber: number }> = [];
  for (let index = ledgerHeadingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith("## ")) {
      break;
    }
    ledgerSectionLines.push({ line, rowNumber: index + 1 });
  }

  return ledgerSectionLines
    .filter(({ line }) => line.trim().startsWith("|"))
    .filter(({ line }) => !line.includes("| ---"))
    .filter(({ line }) => !line.toLowerCase().includes("| id | provider | resource type |"))
    .map(({ line, rowNumber }) => parseLedgerRow(line, rowNumber));
}

function parseLedgerRow(line: string, rowNumber: number): ProviderLedgerRow {
  const cells = line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

  if (cells.length !== 16) {
    throw new Error(`provider.ledger.invalid: docs/provider-resource-ledger.md row ${rowNumber} has ${cells.length} cells; expected 16.`);
  }

  const currentStatus = cells[11].toLowerCase() as ProviderLedgerStatus;
  if (!statuses.has(currentStatus)) {
    throw new Error(`provider.ledger.invalid: docs/provider-resource-ledger.md row ${rowNumber} has unknown current status "${cells[11]}".`);
  }

  return {
    id: cells[0],
    provider: cells[1],
    resourceType: cells[2],
    environment: cells[3],
    ownerAccountProject: cells[4],
    name: cells[5],
    externalIdUrl: cells[6],
    purpose: cells[7],
    createdBy: cells[8],
    createdAt: cells[9],
    expectedCleanupTriggerDate: cells[10],
    currentStatus,
    cleanupCommandProcedure: cells[12],
    cleanedAt: cells[13],
    evidenceLinkPath: cells[14],
    notes: cells[15]
  };
}

function missingRequiredLedgerFields(row: ProviderLedgerRow): string[] {
  if (!allowedStatuses.has(row.currentStatus)) {
    return [];
  }

  return requiredPlannedOrActiveFields
    .filter(([field]) => row[field].trim() === "")
    .map(([, label]) => label);
}

function matchesProviderLedgerRow(row: ProviderLedgerRow, expected: ProviderLedgerMatch): boolean {
  return (
    normalize(row.provider) === normalize(expected.provider) &&
    normalize(row.environment) === normalize(expected.environment) &&
    normalize(row.resourceType) === normalize(expected.resourceType) &&
    row.name.trim() === expected.name
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
```

- [ ] **Step 2: Export the ledger module**

Add this line to `packages/adapters/src/index.ts`:

```ts
export * from "./provider-ledger.js";
```

- [ ] **Step 3: Import ledger helpers in the CLI**

Add these imports in `packages/cli/src/run.ts` from `@agentstack/adapters`:

```ts
  enforceProviderLedgerResource,
  type ProviderLedgerDecision,
  type ProviderLedgerMatch,
```

- [ ] **Step 4: Add provider apply ledger target calculation**

Add this helper near provider apply helpers in `packages/cli/src/run.ts`:

```ts
function providerApplyLedgerMatch(
  service: string,
  environment: "preview" | "production",
  manifest: AgentstackManifest
): ProviderLedgerMatch | undefined {
  if (service === "convex") {
    return {
      provider: "convex",
      environment,
      resourceType: "deployment",
      name: environment === "preview" ? `${manifest.app.slug}-preview` : "prod"
    };
  }

  if (service === "vercel" && environment === "preview") {
    return {
      provider: "vercel",
      environment,
      resourceType: "project",
      name: manifest.app.slug
    };
  }

  return undefined;
}
```

- [ ] **Step 5: Add provider ledger diagnostic formatting**

Add this helper in `packages/cli/src/run.ts`:

```ts
function providerLedgerDiagnostic(decision: Exclude<ProviderLedgerDecision, { ok: true }>): Diagnostic {
  const expected = decision.expected;
  const label = `${expected.provider} ${expected.environment} ${expected.resourceType} ${expected.name}`;

  if (decision.reason === "invalid") {
    return {
      severity: "fail",
      code: "provider.ledger.invalid",
      path: decision.path,
      message: decision.message,
      fix: "Fix the provider resource ledger row shape or status before running the provider mutation.",
      blocks: ["provider apply"]
    };
  }

  if (decision.reason === "missing") {
    return {
      severity: "fail",
      code: "provider.ledger.missing",
      path: decision.path,
      message: `Missing provider resource ledger row for ${label}.`,
      fix: `Add a ${expected.resourceType} row for ${expected.provider} ${expected.environment} named ${expected.name} with current status planned or active.`,
      blocks: ["provider apply"]
    };
  }

  if (decision.reason === "incomplete") {
    return {
      severity: "fail",
      code: "provider.ledger.incomplete",
      path: decision.path,
      message: `Provider resource ledger row for ${label} is missing required fields: ${decision.missingFields.join(", ")}.`,
      fix: "Complete the matching planned or active ledger row before running the provider mutation.",
      blocks: ["provider apply"]
    };
  }

  return {
    severity: "fail",
    code: "provider.ledger.status-blocked",
    path: decision.path,
    message: `Provider resource ledger row for ${label} has blocked status ${decision.row.currentStatus}.`,
    fix: "Change the matching ledger row to planned or active before running the provider mutation.",
    blocks: ["provider apply"]
  };
}
```

- [ ] **Step 6: Gate provider apply before resolving the executor**

In `providerApplyCommand` after local validation succeeds and before `resolveProviderExecutor(io)`, insert:

```ts
  const ledgerMatch = providerApplyLedgerMatch(service, environment, validation.context.manifest);
  if (ledgerMatch) {
    const ledgerDecision = await enforceProviderLedgerResource(io.cwd, ledgerMatch);
    if (!ledgerDecision.ok) {
      io.write(formatDiagnostic(providerLedgerDiagnostic(ledgerDecision)));
      await recordCommandEvent(io, {
        name: "agentstack.provider.apply.completed",
        environment,
        journey: "provider-apply",
        command: ["provider", "apply", ...argv].join(" "),
        status: "fail",
        state: { service, reason: ledgerDecision.reason }
      });
      return 1;
    }
  }
```

Expected placement detail: this must run before `const executor = resolveProviderExecutor(io);` so blocked mutations never call the fake executor in tests and never resolve the real executor in usage.

- [ ] **Step 7: Run focused tests**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts packages/adapters/src/provider-ledger.test.ts
```

Expected: provider ledger tests pass or fail only on output evidence labels that Task 3 will add.

- [ ] **Step 8: Commit ledger enforcement**

Run:

```bash
git add packages/adapters/src/provider-ledger.ts packages/adapters/src/provider-ledger.test.ts packages/adapters/src/index.ts packages/cli/src/run.ts packages/cli/src/run.test.ts
git commit -m "feat: enforce provider resource ledger before apply"
```

Expected: commit succeeds. No provider CLI commands are run.

### Task 4: Add Truthful Evidence Labels To CLI Output

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Add output assertions for evidence tiers before implementation**

Add assertions to existing tests:

```ts
expect(output).toContain("Evidence: local-rehearsal");
```

Use this assertion in tests for:

- `validates a local project`
- `loads local custom env values during cloud validation`
- `plans production provision without writing state and applies production provision`
- `plans preview deploy without writing a deployment artifact`
- `applies preview deploy and writes a deployment artifact`
- `plans a preview mobile build when EAS is linked`
- `applies a preview mobile build and writes an artifact`
- `applies preview cloud sync`

Add these provider-specific assertions:

```ts
expect(output).toContain("Evidence: provider-command-plan");
expect(output).toContain("Provider execution: none");
```

Use them in provider plan tests.

```ts
expect(output).toContain("Evidence: live-read");
expect(output).toContain("Mutation: none");
```

Use them in provider inspect tests.

```ts
expect(output).toContain("Evidence: live-mutation");
expect(output).toContain("Mutation scope: bounded provider executor");
```

Use them in supported provider apply tests.

- [ ] **Step 2: Run focused tests and confirm evidence failures**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts
```

Expected: FAIL with missing evidence label assertions.

- [ ] **Step 3: Add evidence lines to `validate` and `validate --cloud`**

In `validateCommand`, add:

```ts
  io.write("Evidence: local-rehearsal");
```

immediately after `PASS validate` and before any diagnostic formatting or early return.

For `validate --cloud`, keep the command name but emit evidence and scope immediately when entering the cloud validation branch, before local-cloud diagnostics are formatted and before any early return:

```ts
    io.write("Evidence: local-rehearsal");
    io.write("Scope: local-cloud state only; no live provider reads");
```

After local-cloud diagnostics pass, success may still print `PASS validate --cloud`. The evidence and scope lines must not depend on reaching that success path.

- [ ] **Step 4: Add evidence lines to provider commands**

In `providerPlanCommand`, after the plan header line, write:

```ts
  io.write("Evidence: provider-command-plan");
  io.write("Provider execution: none");
```

In `providerInspectCommand`, after the inspect header line, write:

```ts
  io.write("Evidence: live-read");
  io.write("Mutation: none");
```

In supported `providerApplyCommand`, after the apply/pass header line, write:

```ts
  io.write("Evidence: live-mutation");
  io.write("Mutation scope: bounded provider executor");
```

Do not add live-mutation labels to unsupported Clerk, EAS, Vercel production, or unsupported service refusal paths because those paths do not execute provider mutations.

- [ ] **Step 5: Add local rehearsal labels to local apply/plan commands**

Add this line immediately after each command header:

```ts
  io.write("Evidence: local-rehearsal");
```

Apply it to:

- `syncCommand` after `${plan.applied ? "APPLIED" : "PLAN"} ${plan.environment}`
- `deployCommand` after `${deployPlan.applied ? "APPLIED" : "PLAN"} deploy ${deployPlan.environment}`
- `prodProvisionCommand` after `${plan.applied ? "APPLIED" : "PLAN"} prod provision production`
- `buildMobileCommand` after `${mobilePlan.applied ? "APPLIED" : "PLAN"} mobile build ${mobilePlan.environment}`

Do not rename package scripts or CLI commands in this slice.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit truth labels**

Run:

```bash
git add packages/cli/src/run.ts packages/cli/src/run.test.ts
git commit -m "feat: label command evidence tiers"
```

Expected: commit succeeds.

### Task 5: Add Provider Plan Ledger Status Output

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Add provider plan ledger-status tests before implementation**

Add tests near existing provider plan tests in `packages/cli/src/run.test.ts`:

```ts
it("prints missing ledger status during supported provider plan without requiring a row", async () => {
  const code = await runAgentstack(["provider", "plan", "--service", "convex", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line),
    providerExecutor: createMockProviderExecutor("provider command should not run")
  });

  expect(code).toBe(0);
  expect(output).toContain("PLAN provider convex preview");
  expect(output).toContain("Evidence: provider-command-plan");
  expect(output).toContain("Provider execution: none");
  expect(output).toContain("Ledger: missing");
  expect(providerExecutions).toHaveLength(0);
});

it("prints planned ledger status during supported provider plan", async () => {
  await writeProviderLedger([
    "| convex-preview | Convex | deployment | preview | test-account | acme-crm-preview | pending | Wave 0 preview deployment | test | 2026-06-21 | after test | planned | Delete deployment in Convex dashboard |  | docs/evidence/convex-preview.md | planned fixture |"
  ]);

  const code = await runAgentstack(["provider", "plan", "--service", "convex", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line),
    providerExecutor: createMockProviderExecutor("provider command should not run")
  });

  expect(code).toBe(0);
  expect(output).toContain("Ledger: planned convex-preview");
  expect(providerExecutions).toHaveLength(0);
});

it("prints active ledger status during supported provider plan", async () => {
  await writeProviderLedger([
    "| convex-preview | Convex | deployment | preview | test-account | acme-crm-preview | https://dashboard.convex.dev/example | Wave 0 preview deployment | test | 2026-06-21 | after test | active | Delete deployment in Convex dashboard |  | docs/evidence/convex-preview.md | active fixture |"
  ]);

  const code = await runAgentstack(["provider", "plan", "--service", "convex", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line),
    providerExecutor: createMockProviderExecutor("provider command should not run")
  });

  expect(code).toBe(0);
  expect(output).toContain("Ledger: active convex-preview");
  expect(providerExecutions).toHaveLength(0);
});

it("prints blocked ledger status during supported provider plan", async () => {
  await writeProviderLedger([
    "| convex-preview | Convex | deployment | preview | test-account | acme-crm-preview | https://dashboard.convex.dev/example | Wave 0 preview deployment | test | 2026-06-21 | after test | cleanup-pending | Delete deployment in Convex dashboard |  | docs/evidence/convex-preview.md | cleanup queued |"
  ]);

  const code = await runAgentstack(["provider", "plan", "--service", "convex", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line),
    providerExecutor: createMockProviderExecutor("provider command should not run")
  });

  expect(code).toBe(0);
  expect(output).toContain("Ledger: blocked cleanup-pending convex-preview");
  expect(providerExecutions).toHaveLength(0);
});

it("prints invalid ledger status during supported provider plan", async () => {
  await writeProviderLedger([
    "| convex-preview | Convex | deployment | preview | test-account | acme-crm-preview | pending | Wave 0 preview deployment | test | 2026-06-21 | after test | pending-review | Delete deployment in Convex dashboard |  | docs/evidence/convex-preview.md | invalid status |"
  ]);

  const code = await runAgentstack(["provider", "plan", "--service", "convex", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line),
    providerExecutor: createMockProviderExecutor("provider command should not run")
  });

  expect(code).toBe(0);
  expect(output).toContain("Ledger: invalid");
  expect(providerExecutions).toHaveLength(0);
});
```

- [ ] **Step 2: Implement non-blocking ledger status for supported provider plan targets**

Add a helper in `packages/cli/src/run.ts`:

```ts
function providerPlanLedgerLine(decision: ProviderLedgerDecision): string {
  if (decision.ok) {
    return `Ledger: ${decision.row.currentStatus} ${decision.row.id}`;
  }

  if (decision.reason === "missing") {
    return "Ledger: missing";
  }

  if (decision.reason === "invalid" || decision.reason === "incomplete") {
    return "Ledger: invalid";
  }

  return `Ledger: blocked ${decision.row.currentStatus} ${decision.row.id}`;
}
```

In `providerPlanCommand`, after the evidence lines and before printing command shapes, compute `providerApplyLedgerMatch(service, environment, validation.context.manifest)`. If it returns a match, call `enforceProviderLedgerResource(io.cwd, ledgerMatch)` and print `providerPlanLedgerLine(decision)`.

Provider plan must never require a ledger row, must never mutate the ledger, must never resolve or run the provider executor, and must return success for `Ledger: missing`, `Ledger: planned <id>`, `Ledger: active <id>`, `Ledger: blocked <status> <id>`, and `Ledger: invalid`. This status is advisory output that tells the operator whether a later supported apply would be ledger-blocked.

- [ ] **Step 3: Run focused provider plan tests**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts
```

Expected: PASS for provider plan ledger-status output.

- [ ] **Step 4: Commit provider plan ledger status**

Run:

```bash
git add packages/cli/src/run.ts packages/cli/src/run.test.ts
git commit -m "feat: show provider plan ledger status"
```

Expected: commit succeeds.

### Task 6: Update Root Docs And Template Mirrors

**Files:**
- Modify: `README.md`
- Modify: `templates/b2b-saas/docs/agentstack/environments.md`
- Modify: `templates/b2b-saas/docs/agentstack/validation.md`
- Modify: `templates/b2b-saas/docs/agentstack/preview.md`
- Modify: `templates/b2b-saas/docs/agentstack/release.md`
- Modify: `templates/b2b-saas/docs/agentstack/workflows.md`
- Modify: `templates/b2b-saas/docs/agentstack/mobile.md`
- Modify: matching files under `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/`
- Modify: `docs/spinup-site/generated-app.html`
- Modify: `docs/spinup-site/lab.html`

- [ ] **Step 1: Update README evidence contract**

In `README.md`, add a concise evidence-tier block near the command-contract description:

```md
Command output includes an `Evidence: <tier>` line on relevant workflows:

- `local-rehearsal`: local files and `.agentstack/*` artifacts only.
- `provider-command-plan`: provider CLI command shapes are printed and no provider command is executed.
- `live-read`: bounded provider read or diagnostic commands are executed and no mutation is performed.
- `live-mutation`: bounded provider mutation commands are executed through the provider executor.

`agentstack validate --cloud` keeps its current name in this slice, but it prints `Evidence: local-rehearsal` and `Scope: local-cloud state only; no live provider reads`.
```

- [ ] **Step 2: Update README provider ledger boundary**

Add this paragraph near the provider apply description:

```md
Supported live mutations are ledger-gated. `agentstack provider apply --service convex --env preview`, `agentstack provider apply --service convex --env production`, and `agentstack provider apply --service vercel --env preview` refuse to execute unless `docs/provider-resource-ledger.md` has a matching `planned` or `active` row. Convex preview matches a `deployment` row named `<app-slug>-preview`; Convex production matches a `deployment` row named `prod`; Vercel preview matches a `project` row named the manifest app slug. Missing, incomplete, invalid, or blocked rows emit `FAIL provider.ledger.missing`, `FAIL provider.ledger.incomplete`, `FAIL provider.ledger.invalid`, or `FAIL provider.ledger.status-blocked`.
```

- [ ] **Step 3: Update template docs in both mirrors**

For every edited file under `templates/b2b-saas/docs/agentstack/`, make the same semantic edit under `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/`.

Required wording to include in both mirrors:

```md
`validate --cloud` is a local-cloud state check in this slice. It prints `Evidence: local-rehearsal` and `Scope: local-cloud state only; no live provider reads`.
```

```md
Provider command evidence tiers are explicit: `provider plan` prints `Evidence: provider-command-plan`, `provider inspect` prints `Evidence: live-read`, and supported `provider apply` paths print `Evidence: live-mutation`.
```

```md
Supported provider apply paths require a matching `planned` or `active` row in `docs/provider-resource-ledger.md` before the provider executor runs. Missing, incomplete, invalid, cleanup-pending, cleaned, and abandoned-with-reason rows block mutation.
```

```md
`provider plan` does not require or mutate the provider ledger. For supported apply targets it prints one of `Ledger: missing`, `Ledger: planned <id>`, `Ledger: active <id>`, `Ledger: blocked <status> <id>`, or `Ledger: invalid` so the operator can see whether apply would be ledger-blocked.
```

- [ ] **Step 4: Update spinup-site copy**

Update `docs/spinup-site/generated-app.html` and `docs/spinup-site/lab.html` so visible copy does not imply `validate --cloud`, preview deploy rehearsal, production provision rehearsal, or mobile build rehearsal performs live provider reads or mutations. Include `Evidence: local-rehearsal`, `Evidence: provider-command-plan`, `Evidence: live-read`, and `Evidence: live-mutation` where command output examples are shown.

- [ ] **Step 5: Verify template mirror parity**

First run the parity diff before editing:

```bash
diff -ru templates/b2b-saas/docs/agentstack packages/create-agent-stack/templates/b2b-saas/docs/agentstack
```

Expected before edits: if there is no output, the mirrors are already equal. If there is output, save the list of differing files and do not try to repair unrelated pre-existing differences in this task.

Run:

```bash
diff -ru templates/b2b-saas/docs/agentstack packages/create-agent-stack/templates/b2b-saas/docs/agentstack
```

Expected after edits: no output if the pre-edit diff was empty. If the pre-edit diff showed existing differences, acceptance is restricted to files edited by this task: each edited file under `templates/b2b-saas/docs/agentstack/` must match its package-local mirror, and pre-existing differences in unedited files may remain untouched.

- [ ] **Step 6: Commit docs**

Run:

```bash
git add README.md templates/b2b-saas/docs/agentstack packages/create-agent-stack/templates/b2b-saas/docs/agentstack docs/spinup-site
git commit -m "docs: clarify evidence tiers and ledger-gated provider apply"
```

Expected: commit succeeds.

### Task 7: Final Verification

**Files:**
- Verify only: no roadmap or progress document edits

- [ ] **Step 1: Run focused tests for changed files**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts packages/adapters/src/provider-ledger.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run repository typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 4: Run whitespace diff check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Scan for ambiguous output labels**

Run:

```bash
rg -n "validate --cloud|cloud validation|live provider|provider execution|deploy rehearsal|mobile build rehearsal|local-cloud" README.md templates packages/create-agent-stack/templates docs/spinup-site packages/cli/src/run.ts packages/cli/src/run.test.ts
```

Expected: each hit either states a clear evidence tier, says local-cloud only, says provider execution is explicit through `provider inspect/apply`, or names an unsupported path. Update wording for any hit that implies local rehearsal is live provider proof.

## Acceptance Criteria

- `agentstack.config.json` is the only Wave 0 manifest format named as supported or source of truth in active docs, source spec, templates, generated guidance, tests, source files, and validation scans. The source spec is updated to JSON in this implementation. The Wave 0 implementation plan itself may mention `agentstack.config.ts` only as the removed format; no active docs/source/templates/generated guidance continue naming it as supported or source of truth.
- `packages/adapters/src/provider-ledger.ts` parses `docs/provider-resource-ledger.md` and exports reusable ledger enforcement helpers.
- `packages/adapters/src/index.ts` exports the ledger module.
- Supported live mutations require a matching `planned` or `active` ledger row before the provider executor runs:
  - Convex preview: provider `convex`, environment `preview`, resource type `deployment`, name `${manifest.app.slug}-preview`.
  - Convex production: provider `convex`, environment `production`, resource type `deployment`, name `prod`.
  - Vercel preview: provider `vercel`, environment `preview`, resource type `project`, name matching the manifest app slug.
- Missing rows emit `FAIL provider.ledger.missing` with path, message, fix, and blocks fields.
- Syntactically valid planned or active rows missing owner account/project, purpose, created by, created at, expected cleanup trigger/date, cleanup command/procedure, or evidence link/path emit `FAIL provider.ledger.incomplete` with path, message, fix, and blocks fields.
- Malformed rows, unknown statuses, and bad cell counts emit `FAIL provider.ledger.invalid` with path, message, fix, and blocks fields; the parser does not silently drop malformed rows.
- `cleanup-pending`, `cleaned`, and `abandoned-with-reason` rows emit `FAIL provider.ledger.status-blocked` with path, message, fix, and blocks fields.
- Tests prove the fake provider executor is not called when ledger enforcement blocks mutation.
- `provider plan` does not require a ledger row and prints `Evidence: provider-command-plan` plus `Provider execution: none`.
- `provider plan` prints `Ledger: missing`, `Ledger: planned <id>`, `Ledger: active <id>`, `Ledger: blocked <status> <id>`, or `Ledger: invalid` for supported apply targets without mutating state.
- `provider inspect` does not require a ledger row and prints `Evidence: live-read` plus `Mutation: none`.
- Unsupported apply paths do not require a ledger row and continue to fail before executor usage.
- `provider apply` on supported paths prints `Evidence: live-mutation` plus `Mutation scope: bounded provider executor`.
- `validate --cloud` keeps its command name but prints `Evidence: local-rehearsal` and `Scope: local-cloud state only; no live provider reads`.
- `sync`, `deploy`, `prod provision`, and `build mobile` plan/apply outputs print `Evidence: local-rehearsal`.
- README, generated template docs, package-local template mirrors, and spinup-site copy agree on the same evidence tiers and provider ledger boundary.
- No scripts are renamed in this slice.
- No external provider resources are created, mutated, adopted, linked, or deleted while implementing this plan.

## Final Verification Commands

Run these before finalizing framework changes:

```bash
pnpm vitest run packages/cli/src/run.test.ts
pnpm vitest run packages/cli/src/run.test.ts packages/adapters/src/provider-ledger.test.ts
pnpm typecheck
pnpm test
git diff --check
rg -n "validate --cloud|cloud validation|live provider|provider execution|deploy rehearsal|mobile build rehearsal|local-cloud" README.md templates packages/create-agent-stack/templates docs/spinup-site packages/cli/src/run.ts packages/cli/src/run.test.ts
```

Expected final state: all tests and typecheck pass, `git diff --check` is clean, the `rg` scan has only clearly scoped evidence-tier wording, and the provider resource ledger still records no provider resources created by this implementation unless a user explicitly requested real provider work in a separate task.
