# Agentstack Billing Plan Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `agentstack add billing-plan` so agents can create coherent billing-plan anchors across domain, Convex, web, mobile, telemetry, docs, and validation.

**Architecture:** Core owns deterministic billing-plan file planning and validation. CLI owns parsing, overwrite protection, manifest anchor registration, barrel updates, and command telemetry. Generated app docs teach agents to use the command instead of manually scattering billing gates across surfaces.

**Tech Stack:** TypeScript, Vitest, Agentstack CLI, generated B2B SaaS template, local JSON manifest anchors, JSONL command telemetry.

---

## File Structure

- Create `packages/core/src/billing-plans.ts`: parser and deterministic file planner for billing-plan anchors.
- Create `packages/core/src/billing-plans.test.ts`: TDD coverage for plan parsing, file paths, file content, and invalid inputs.
- Modify `packages/core/src/index.ts`: export billing-plan planner APIs.
- Modify `packages/cli/src/run.ts`: route `agentstack add billing-plan`, write generated files, update `packages/domain/src/billing-plans/index.ts`, register anchors, and emit command telemetry.
- Modify `packages/cli/src/run.test.ts`: CLI behavior, validation after deletion, duplicate refusal, invalid input diagnostics, and billing journey telemetry.
- Modify `tests/e2e/prototype.test.ts`: add billing-plan command to the executable workflow and observe the billing journey.
- Modify template docs in both `templates/b2b-saas/` and `packages/create-agent-stack/templates/b2b-saas/`: `AGENTS.md`, `docs/agentstack/workflows.md`, `docs/agentstack/local-development.md`, and `docs/agentstack/billing.md`.
- Modify `README.md`, `docs/spinup-site/workflows.html`, and `docs/spinup-site/timeline.html` for internal spin-up.

## Task 1: Core Billing Plan Planner

**Files:**
- Create: `packages/core/src/billing-plans.ts`
- Create: `packages/core/src/billing-plans.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/core/src/billing-plans.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseBillingPlanName, planBillingPlanFiles } from "./billing-plans.js";

describe("billing plan planning", () => {
  it("parses billing plan names into slug, title, camel, and pascal case", () => {
    expect(parseBillingPlanName("Growth Pro")).toEqual({
      input: "Growth Pro",
      slug: "growth-pro",
      title: "Growth Pro",
      camel: "growthPro",
      pascal: "GrowthPro"
    });
  });

  it("plans full-stack billing anchors for a plan", () => {
    const plan = planBillingPlanFiles("Pro", {
      entitlements: ["seats.included", "feature.auditLog"],
      seats: 10
    });

    expect(plan.files.map((file) => file.path)).toEqual([
      "packages/domain/src/billing-plans/pro.ts",
      "convex/billing-plans/pro.ts",
      "apps/web/src/billing-plans/pro.ts",
      "apps/mobile/src/billing-plans/pro.ts",
      "packages/telemetry/src/billing-plans/pro.ts",
      "docs/agentstack/billing-plans/pro.md"
    ]);
    expect(plan.files[0]?.content).toContain("proBillingPlan");
    expect(plan.files[0]?.content).toContain("readonly AgentstackEntitlement[]");
    expect(plan.files[1]?.content).toContain("billingSubscriptions");
    expect(plan.files[2]?.content).toContain('surface: "web"');
    expect(plan.files[3]?.content).toContain('surface: "mobile"');
    expect(plan.files[4]?.content).toContain("billing.plan.pro.entitlement.checked");
    expect(plan.files[5]?.content).toContain("# Pro Billing Plan");
  });

  it("defaults to seats.included and one included seat", () => {
    const plan = planBillingPlanFiles("Starter", {
      entitlements: [],
      seats: undefined
    });

    expect(plan.entitlements).toEqual(["seats.included"]);
    expect(plan.seats).toBe(1);
  });

  it("rejects invalid billing plan and entitlement input", () => {
    expect(() => parseBillingPlanName("!!!")).toThrow("Billing plan name must contain at least one letter or number.");
    expect(() =>
      planBillingPlanFiles("Pro", {
        entitlements: ["Feature Audit"],
        seats: 1
      })
    ).toThrow('Invalid entitlement key "Feature Audit".');
    expect(() =>
      planBillingPlanFiles("Pro", {
        entitlements: ["seats.included"],
        seats: 0
      })
    ).toThrow("Included seats must be a positive integer.");
  });
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm vitest run packages/core/src/billing-plans.test.ts
```

Expected: fail because `./billing-plans.js` does not exist.

- [ ] **Step 3: Implement planner**

Create `packages/core/src/billing-plans.ts` with:

```ts
export interface ParsedBillingPlanName {
  input: string;
  slug: string;
  title: string;
  camel: string;
  pascal: string;
}

export interface BillingPlanOptions {
  entitlements: readonly string[];
  seats?: number;
}

export interface PlannedBillingPlanFile {
  path: string;
  content: string;
}

export interface BillingPlanFilePlan {
  name: ParsedBillingPlanName;
  entitlements: string[];
  seats: number;
  files: PlannedBillingPlanFile[];
}
```

Implement `parseBillingPlanName(input)` with the same normalization rules as `parseFeatureName`, but with billing-plan-specific error messages. Implement `planBillingPlanFiles(input, options)` to return exactly six files in this order:

```ts
packages/domain/src/billing-plans/${slug}.ts
convex/billing-plans/${slug}.ts
apps/web/src/billing-plans/${slug}.ts
apps/mobile/src/billing-plans/${slug}.ts
packages/telemetry/src/billing-plans/${slug}.ts
docs/agentstack/billing-plans/${slug}.md
```

Validation rules:

- default entitlements to `["seats.included"]` when none are provided;
- entitlement keys must match `/^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)+$/`;
- dedupe entitlements while preserving input order;
- default seats to `1`;
- seats must be a positive integer.

Generated domain file content should use this shape:

```ts
import type { AgentstackEntitlement } from "../saas-spine.js";

const proEntitlements: readonly AgentstackEntitlement[] = [
  "seats.included",
  "feature.auditLog"
];

export const proBillingPlan = {
  slug: "pro",
  title: "Pro",
  clerkPlanKey: "pro",
  clerkProductKey: "pro",
  includedSeats: 10,
  entitlements: proEntitlements
} as const;

export type ProBillingPlan = typeof proBillingPlan;

export function proPlanHasEntitlement(entitlement: AgentstackEntitlement): boolean {
  return proEntitlements.includes(entitlement);
}
```

Generated Convex file should import the domain plan and export metadata with `billingSubscriptions`, `entitlements`, `webhookEvents`, and a mutation name like `billing.applyProSubscriptionUpdate`.

Generated web and mobile files should import the domain plan and export a surface-specific gate object with `surface: "web"` or `surface: "mobile"`.

Generated telemetry file should export event names including `billing.plan.${slug}.viewed` and `billing.plan.${slug}.entitlement.checked`.

Generated docs should list all six generated files and include the entitlements and included seats.

Modify `packages/core/src/index.ts`:

```ts
export * from "./billing-plans.js";
```

- [ ] **Step 4: Run GREEN**

Run:

```bash
pnpm vitest run packages/core/src/billing-plans.test.ts
```

Expected: pass.

## Task 2: CLI Billing Plan Command

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`
- Modify: `tests/e2e/prototype.test.ts`

- [ ] **Step 1: Write failing CLI tests**

In `packages/cli/src/run.test.ts`, add tests after the `add event` tests:

```ts
it("adds a typed billing plan across domain, Convex, web, mobile, telemetry, and docs", async () => {
  const code = await runAgentstack(
    ["add", "billing-plan", "Pro", "--entitlements", "feature.auditLog,feature.advancedReports", "--seats", "10"],
    { cwd: dir, write: (line) => output.push(line) }
  );

  expect(code).toBe(0);
  expect(output).toContain("CREATED billing-plan pro");
  expect(output).toContain("- packages/domain/src/billing-plans/pro.ts");
  expect(output).toContain("- packages/domain/src/billing-plans/index.ts");
  expect(output).toContain("- convex/billing-plans/pro.ts");
  expect(output).toContain("- apps/web/src/billing-plans/pro.ts");
  expect(output).toContain("- apps/mobile/src/billing-plans/pro.ts");
  await expect(readFile(join(dir, "packages/domain/src/billing-plans/pro.ts"), "utf8")).resolves.toContain(
    "proBillingPlan"
  );
  await expect(readFile(join(dir, "packages/domain/src/billing-plans/index.ts"), "utf8")).resolves.toContain(
    'export * from "./pro.js";'
  );
  const manifest = JSON.parse(await readFile(join(dir, "agentstack.config.json"), "utf8")) as {
    generated: { requiredAnchors: string[] };
  };
  expect(manifest.generated.requiredAnchors).toEqual(
    expect.arrayContaining([
      "packages/domain/src/billing-plans/pro.ts",
      "packages/domain/src/billing-plans/index.ts",
      "convex/billing-plans/pro.ts",
      "apps/web/src/billing-plans/pro.ts",
      "apps/mobile/src/billing-plans/pro.ts",
      "packages/telemetry/src/billing-plans/pro.ts",
      "docs/agentstack/billing-plans/pro.md"
    ])
  );
});
```

Add tests for:

- deleting `apps/web/src/billing-plans/pro.ts` after generation makes `validate` fail with `template.anchor.missing`;
- running the same command twice fails with `FAIL billing-plan.file.exists`;
- invalid entitlements fail with `FAIL billing-plan.invalid` and actionable fix text;
- telemetry timeline for `--journey billing` contains `agentstack.billing-plan.added`.

In `tests/e2e/prototype.test.ts`, run the command in the generated app workflow:

```ts
expect(
  await runAgentstack(
    ["add", "billing-plan", "pro", "--entitlements", "feature.auditLog,feature.advancedReports", "--seats", "10"],
    { cwd: appDir, write }
  )
).toBe(0);
await expect(readFile(join(appDir, "packages/domain/src/billing-plans/pro.ts"), "utf8")).resolves.toContain(
  "proBillingPlan"
);
```

Also observe the billing journey:

```ts
expect(
  await runAgentstack(["observe", "timeline", "--env", "development", "--journey", "billing"], {
    cwd: appDir,
    write
  })
).toBe(0);
```

And assert rendered output contains `CREATED billing-plan pro` and `agentstack.billing-plan.added`.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts tests/e2e/prototype.test.ts
```

Expected: fail with `FAIL cli.unknown-command` for `add billing-plan` or missing planner import.

- [ ] **Step 3: Implement CLI route**

Modify the core imports in `packages/cli/src/run.ts`:

```ts
planBillingPlanFiles,
```

Add route near existing add commands:

```ts
if (command === "add" && subcommand === "billing-plan") {
  return await addBillingPlanCommand(rest, io);
}
```

Add `addBillingPlanCommand(argv, io)`:

```ts
async function addBillingPlanCommand(argv: string[], io: RunIo): Promise<number> {
  const [planName, ...rest] = argv;
  const fix =
    "Run agentstack add billing-plan pro --entitlements feature.auditLog,feature.advancedReports --seats 10.";
  if (!planName || planName.startsWith("--")) {
    throw new Error(["FAIL billing-plan.name.missing", "Billing plan name is required.", `Fix: ${fix}`].join("\n"));
  }

  const options = parseOptions(rest);
  if (options.entitlements === true) {
    throwMissingOption("entitlements", fix);
  }
  if (options.seats === true) {
    throwMissingOption("seats", fix);
  }

  let plan: ReturnType<typeof planBillingPlanFiles>;
  try {
    plan = planBillingPlanFiles(planName, {
      entitlements:
        typeof options.entitlements === "string"
          ? options.entitlements.split(",").map((item) => item.trim()).filter(Boolean)
          : [],
      seats: typeof options.seats === "string" ? Number(options.seats) : undefined
    });
  } catch (error) {
    throw new Error(["FAIL billing-plan.invalid", (error as Error).message, `Fix: ${fix}`].join("\n"));
  }

  const existing = await findExistingFeatureFiles(io.cwd, plan.files);
  if (existing.length > 0) {
    throw new Error(
      [
        "FAIL billing-plan.file.exists",
        "Billing-plan generation refuses to overwrite existing files.",
        ...existing.map((path) => `Path: ${path}`),
        "Fix: Choose a new billing plan name or update the existing billing-plan anchors intentionally."
      ].join("\n")
    );
  }

  for (const file of plan.files) {
    const path = join(io.cwd, file.path);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, file.content, "utf8");
  }
  const billingPlanBarrelPath = await updateBillingPlanBarrel(io.cwd, plan.name.slug);
  const generatedPaths = [...plan.files.map((file) => file.path), billingPlanBarrelPath];
  await registerGeneratedAnchors(io.cwd, generatedPaths);

  io.write(`CREATED billing-plan ${plan.name.slug}`);
  generatedPaths.forEach((path) => io.write(`- ${path}`));

  await recordCommandEvent(io, {
    name: "agentstack.billing-plan.added",
    environment: "development",
    journey: "billing",
    command: ["add", "billing-plan", ...argv].join(" "),
    status: "ok",
    state: {
      billingPlan: plan.name.slug,
      entitlements: plan.entitlements,
      includedSeats: plan.seats,
      files: generatedPaths
    }
  });
  return 0;
}
```

Add `updateBillingPlanBarrel(cwd, planSlug)` like `updateTelemetryEventBarrel`, writing `packages/domain/src/billing-plans/index.ts` and deduping `export * from "./${planSlug}.js";`.

- [ ] **Step 4: Run GREEN**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts tests/e2e/prototype.test.ts
```

Expected: pass.

## Task 3: Generated Docs And Spin-Up Updates

**Files:**
- Modify: `templates/b2b-saas/AGENTS.md`
- Modify: `templates/b2b-saas/docs/agentstack/workflows.md`
- Modify: `templates/b2b-saas/docs/agentstack/local-development.md`
- Modify: `templates/b2b-saas/docs/agentstack/billing.md`
- Mirror the same files under `packages/create-agent-stack/templates/b2b-saas/`
- Modify: `README.md`
- Modify: `docs/spinup-site/workflows.html`
- Modify: `docs/spinup-site/timeline.html`

- [ ] **Step 1: Write the failing check**

Run before editing:

```bash
rg "add billing-plan|billing-plan pro|agentstack.billing-plan.added" README.md docs/spinup-site templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

Expected: no matches or only the spec file outside these targets.

- [ ] **Step 2: Update generated docs**

Add `agentstack add billing-plan pro --entitlements feature.auditLog,feature.advancedReports --seats 10` to generated workflows and local development docs. In `billing.md`, state that the command creates:

- `packages/domain/src/billing-plans/<plan>.ts`;
- `convex/billing-plans/<plan>.ts`;
- `apps/web/src/billing-plans/<plan>.ts`;
- `apps/mobile/src/billing-plans/<plan>.ts`;
- `packages/telemetry/src/billing-plans/<plan>.ts`;
- `docs/agentstack/billing-plans/<plan>.md`.

Add an `AGENTS.md` rule that billing plans should start with `agentstack add billing-plan` before surface-specific gating code.

Mirror the four template docs byte-for-byte.

- [ ] **Step 3: Update human-facing docs**

Update `README.md` smoke commands and expected output to include:

```bash
node scripts/agentstack.mjs add billing-plan pro --entitlements feature.auditLog,feature.advancedReports --seats 10
node scripts/agentstack.mjs observe timeline --env development --journey billing
```

Expected output should include:

```txt
CREATED billing-plan pro
agentstack.billing-plan.added
```

Update `docs/spinup-site/workflows.html` happy-path command list, “what each command proves,” and failure/repair table if useful. Update `docs/spinup-site/timeline.html` with a new “Billing plan generation” event and final verification count can remain generic until final verification updates it.

- [ ] **Step 4: Run docs and parity checks**

Run:

```bash
rg "add billing-plan|billing-plan pro|agentstack.billing-plan.added" README.md docs/spinup-site templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

Expected: search finds the new docs and parity diff has no output.

## Final Verification

- [ ] Run `pnpm install --frozen-lockfile`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas`.
- [ ] Run `git diff --check`.
- [ ] Confirm the LAN spin-up site serves the billing-plan docs:

```bash
curl -fsS http://127.0.0.1:8765/workflows.html | rg "billing-plan|agentstack.billing-plan.added"
curl -fsS http://192.168.10.142:8765/workflows.html | rg "billing-plan|agentstack.billing-plan.added"
```

- [ ] Commit with message `feat: add billing plan generator`.
