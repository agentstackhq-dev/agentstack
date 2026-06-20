# Agentstack Guidance Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a versioned, repo-local Agentstack skill pack and validation/inspection support so coding agents can discover framework workflows without MCP or vendor-dashboard guesswork.

**Architecture:** Core owns the expected guidance version, required guidance anchors, and stale-version diagnostics. The CLI exposes `agentstack skills inspect` as the agent-readable inspection surface. The generated B2B SaaS template ships `skills/agentstack/` plus docs and package scripts so both repo-local agents and installable-skill-aware agents see the same workflow guidance.

**Tech Stack:** TypeScript, Vitest, existing Agentstack core/CLI packages, deterministic B2B SaaS templates, static spin-up HTML.

---

## File Structure

- Create `packages/core/src/guidance.ts` for guidance version constants, anchor lists, and stale guidance diagnostics.
- Modify `packages/core/src/validation.ts` to include guidance diagnostics in local validation and guidance files in required generated anchors.
- Modify `packages/core/src/index.ts` to export the guidance helpers.
- Modify `packages/core/src/validation.test.ts` or add `packages/core/src/guidance.test.ts` for stale version and anchor coverage.
- Modify `packages/cli/src/run.ts` to route `agentstack skills inspect`, print guidance version/anchors, and record command telemetry.
- Modify `tests/e2e/prototype.test.ts` and `packages/create-agent-stack/src/generate.test.ts` so generated projects exercise the new script and files.
- Create `templates/b2b-saas/skills/agentstack/SKILL.md` and reference files under `templates/b2b-saas/skills/agentstack/references/`.
- Create `templates/b2b-saas/docs/agentstack/skills.md`.
- Modify `templates/b2b-saas/AGENTS.md`, `templates/b2b-saas/package.json`, and mirrored package-local template files.
- Modify `README.md` and `docs/spinup-site/*.html`/assets as needed to explain the guidance layer.

## Task 1: Core Guidance Contract

**Files:**
- Create: `packages/core/src/guidance.ts`
- Modify: `packages/core/src/validation.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/guidance.test.ts`

- [x] **Step 1: Write the failing guidance tests**

```ts
import { describe, expect, it } from "vitest";
import { createDefaultManifest } from "./manifest.js";
import {
  expectedAgentstackGuidanceVersion,
  getGuidanceGeneratedAnchors,
  validateGuidancePolicy
} from "./guidance.js";
import { getRequiredGeneratedAnchors, validateLocalProject } from "./validation.js";

describe("guidance policy", () => {
  it("declares versioned guidance anchors for generated projects", () => {
    const manifest = createDefaultManifest("acme-crm");

    expect(getGuidanceGeneratedAnchors(manifest)).toEqual([
      "skills/agentstack/SKILL.md",
      "skills/agentstack/references/workflows.md",
      "skills/agentstack/references/guardrails.md",
      "skills/agentstack/references/observability.md",
      "docs/agentstack/skills.md"
    ]);
    expect(getRequiredGeneratedAnchors(manifest)).toEqual(
      expect.arrayContaining(getGuidanceGeneratedAnchors(manifest))
    );
  });

  it("warns when generated guidance is stale", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.guidanceVersion = "2026-01-01";

    expect(validateGuidancePolicy(manifest)).toEqual([
      expect.objectContaining({
        severity: "warn",
        code: "guidance.version.stale",
        path: "guidanceVersion"
      })
    ]);
  });

  it("includes stale guidance warnings in local validation without blocking validate", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.guidanceVersion = "2026-01-01";

    const result = validateLocalProject({ manifest, envValues: {} });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "guidance.version.stale" })
    ]);
  });

  it("keeps the expected guidance version aligned with the default manifest", () => {
    expect(createDefaultManifest("acme-crm").guidanceVersion).toBe(
      expectedAgentstackGuidanceVersion
    );
  });
});
```

- [x] **Step 2: Run the new test and verify it fails**

Run: `pnpm --filter @agentstack/core test -- guidance.test.ts`

Expected: failure because `./guidance.js` does not exist and validation does not include guidance diagnostics.

- [x] **Step 3: Implement the guidance helpers**

```ts
import type { Diagnostic } from "./diagnostics.js";
import type { AgentstackManifest } from "./manifest.js";

export const expectedAgentstackGuidanceVersion = "2026-06-20";

export const agentstackGuidanceAnchors = [
  "skills/agentstack/SKILL.md",
  "skills/agentstack/references/workflows.md",
  "skills/agentstack/references/guardrails.md",
  "skills/agentstack/references/observability.md",
  "docs/agentstack/skills.md"
] as const;

export function getGuidanceGeneratedAnchors(_manifest: AgentstackManifest): string[] {
  return [...agentstackGuidanceAnchors];
}

export function validateGuidancePolicy(manifest: AgentstackManifest): Diagnostic[] {
  if (manifest.guidanceVersion === expectedAgentstackGuidanceVersion) {
    return [];
  }

  return [
    {
      severity: "warn",
      code: "guidance.version.stale",
      path: "guidanceVersion",
      message: `Generated guidance ${manifest.guidanceVersion} is older than expected ${expectedAgentstackGuidanceVersion}.`,
      fix: "Regenerate or update docs/agentstack and skills/agentstack from the matching Agentstack version."
    }
  ];
}
```

- [x] **Step 4: Wire validation and exports**

In `packages/core/src/validation.ts`, import `getGuidanceGeneratedAnchors` and `validateGuidancePolicy`, add `...validateGuidancePolicy(input.manifest)` to local diagnostics, and add `anchors.push(...getGuidanceGeneratedAnchors(manifest));` before manifest-declared anchors.

In `packages/core/src/index.ts`, add:

```ts
export * from "./guidance.js";
```

- [x] **Step 5: Run focused verification**

Run: `pnpm --filter @agentstack/core test -- guidance.test.ts validation.test.ts`

Expected: all focused core tests pass.

## Task 2: CLI Guidance Inspection

**Files:**
- Modify: `packages/cli/src/run.ts`
- Test: `packages/cli/src/run.test.ts`
- Modify: `tests/e2e/prototype.test.ts`

- [x] **Step 1: Write failing CLI coverage**

Add a test that generates a temp app or uses the existing run helpers, then calls:

```ts
expect(await runAgentstack(["skills", "inspect"], { cwd: appDir, write })).toBe(0);
expect(output.join("\n")).toContain("PASS skills inspect");
expect(output.join("\n")).toContain("Guidance version: 2026-06-20");
expect(output.join("\n")).toContain("skills/agentstack/SKILL.md");
expect(output.join("\n")).toContain("No MCP dependency");
```

Also add the same command to the main e2e workflow after `inspect`.

- [x] **Step 2: Run focused tests and verify failure**

Run: `pnpm --filter @agentstack/cli test -- run.test.ts`

Expected: failure with `FAIL cli.unknown-command` or missing output.

- [x] **Step 3: Implement command routing**

Import `expectedAgentstackGuidanceVersion` and `getGuidanceGeneratedAnchors` from `@agentstack/core`. Route the command near the other top-level commands:

```ts
if (command === "skills" && subcommand === "inspect") {
  return await skillsInspectCommand(rest, io);
}
```

Add:

```ts
async function skillsInspectCommand(argv: string[], io: RunIo): Promise<number> {
  const { context, diagnostics, missingAnchors } = await runLocalValidationGate(io.cwd);
  const guidanceAnchors = getGuidanceGeneratedAnchors(context.manifest);
  const missingGuidance = missingAnchors.filter((path) => guidanceAnchors.includes(path));
  const stale = context.manifest.guidanceVersion !== expectedAgentstackGuidanceVersion;

  io.write(`${missingGuidance.length > 0 ? "FAIL" : "PASS"} skills inspect`);
  io.write(`Guidance version: ${context.manifest.guidanceVersion}`);
  io.write(`Expected guidance: ${expectedAgentstackGuidanceVersion}`);
  io.write("No MCP dependency: repo-local instructions and installable skills only");
  io.write("Guidance anchors:");
  for (const anchor of guidanceAnchors) {
    io.write(`- ${missingGuidance.includes(anchor) ? "missing" : "present"} ${anchor}`);
  }
  diagnostics
    .filter((diagnostic) => diagnostic.code.startsWith("guidance."))
    .forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));

  await recordCommandEvent(io, {
    name: "agentstack.skills.inspect.completed",
    environment: "development",
    journey: "agent-guidance",
    command: ["skills", "inspect", ...argv].join(" "),
    status: missingGuidance.length > 0 ? "fail" : "ok",
    state: {
      anchors: guidanceAnchors.length,
      missing: missingGuidance.length,
      stale
    }
  });

  return missingGuidance.length > 0 ? 1 : 0;
}
```

- [x] **Step 4: Run focused verification**

Run: `pnpm --filter @agentstack/cli test -- run.test.ts`

Expected: CLI tests pass and command telemetry records `agentstack.skills.inspect.completed`.

## Task 3: Generated Skill Pack And Docs

**Files:**
- Create: `templates/b2b-saas/skills/agentstack/SKILL.md`
- Create: `templates/b2b-saas/skills/agentstack/references/workflows.md`
- Create: `templates/b2b-saas/skills/agentstack/references/guardrails.md`
- Create: `templates/b2b-saas/skills/agentstack/references/observability.md`
- Create: `templates/b2b-saas/docs/agentstack/skills.md`
- Modify: `templates/b2b-saas/AGENTS.md`
- Modify: `templates/b2b-saas/package.json`
- Mirror: `packages/create-agent-stack/templates/b2b-saas/**`
- Test: `packages/create-agent-stack/src/generate.test.ts`

- [x] **Step 1: Write failing generator expectations**

Add these files to `generatedAnchorFiles`:

```ts
"docs/agentstack/skills.md",
"skills/agentstack/SKILL.md",
"skills/agentstack/references/workflows.md",
"skills/agentstack/references/guardrails.md",
"skills/agentstack/references/observability.md"
```

Add package script expectation:

```ts
"skills:inspect": "node scripts/agentstack.mjs skills inspect"
```

Add content checks:

```ts
await expect(readFile(join(targetDir, "skills/agentstack/SKILL.md"), "utf8")).resolves.toContain(
  "No MCP dependency"
);
await expect(readFile(join(targetDir, "docs/agentstack/skills.md"), "utf8")).resolves.toContain(
  "agentstack skills inspect"
);
```

- [x] **Step 2: Run generator test and verify failure**

Run: `pnpm --filter create-agent-stack test -- generate.test.ts`

Expected: missing file/script failures.

- [x] **Step 3: Add template skill content**

`skills/agentstack/SKILL.md` should be concise and reference deeper files:

```md
---
name: agentstack
description: Use when working inside a generated Agentstack app to bootstrap, validate, add features, manage env state, inspect telemetry, theme UI, rehearse mobile builds, or prepare releases.
---

# Agentstack Generated App Skill

Use this skill after opening a generated Agentstack repository.

Start with:

```bash
pnpm run inspect
pnpm run skills:inspect
pnpm run validate
```

No MCP dependency: Agentstack guidance is repo-local documentation plus installable skills for agents that support them.

Read the references that match the task:

- `references/workflows.md` for adding features, billing plans, env values, mobile builds, and releases.
- `references/guardrails.md` for generated boundaries, source policy, secrets, validation, and cloud drift.
- `references/observability.md` for wide events, command telemetry, incident timelines, and journey inspection.
```

- [x] **Step 4: Add docs and AGENTS/package updates**

`docs/agentstack/skills.md` should explain what can be installed, what stays repo-local, why MCP is not required, and how `agentstack skills inspect` validates the guidance pack.

Update `AGENTS.md` with:

```md
- Run `pnpm run skills:inspect` when entering the repo to confirm guidance files and versions.
- Use `skills/agentstack/SKILL.md` and its references for deeper workflows; there is no MCP dependency.
```

Add the package script to both template package manifests.

- [x] **Step 5: Mirror templates and run focused verification**

Copy the new/changed template files from `templates/b2b-saas` to `packages/create-agent-stack/templates/b2b-saas`, preserving exact content.

Run: `pnpm --filter create-agent-stack test -- generate.test.ts`

Expected: generated project tests pass and the template parity test confirms both template roots match.

## Task 4: Integration Docs, Spin-Up Site, And Final Gate

**Files:**
- Modify: `README.md`
- Modify: `docs/spinup-site/index.html`
- Modify: `docs/spinup-site/workflows.html`
- Modify: `docs/spinup-site/guardrails.html`
- Modify: `docs/spinup-site/generated-app.html`
- Modify: `docs/spinup-site/assets/site.js` if the lab command list changes

- [x] **Step 1: Update docs with the new lifecycle step**

Add `pnpm run skills:inspect` to the README smoke sequence and describe the skill pack alongside `inspect`, `doctor`, `validate`, and `observe`.

- [x] **Step 2: Update spin-up pages**

Add a guidance-layer explanation to the generated app and guardrails pages:

```html
<tr>
  <td>Agent guidance</td>
  <td><code>AGENTS.md</code>, <code>skills/agentstack/</code>, <code>docs/agentstack/skills.md</code></td>
  <td>Gives agents a versioned workflow pack without making MCP a dependency.</td>
</tr>
```

Add `skills:inspect` to any command journey or lab command lists that show the app entry sequence.

- [x] **Step 3: Run full verification**

Run these commands:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm --filter create-agent-stack test -- generate.test.ts
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
git diff --check
node --check docs/spinup-site/assets/site.js
curl -fsS http://127.0.0.1:8765/index.html >/tmp/agentstack-site-index.html
```

Expected: all commands exit 0.

- [x] **Step 4: Commit the slice**

Run:

```bash
git status --short
git add README.md docs packages templates tests
git commit -m "feat: add versioned agent guidance skills"
git status --short
```

Expected: commit succeeds and worktree is clean.

## Self-Review

- Spec coverage: this plan implements installable skills, repo-local guidance, no MCP dependency, versioned guidance, and stale guidance validation from the approved spec.
- Placeholder scan: no placeholders or deferred behavior are included.
- Type consistency: the planned names are `expectedAgentstackGuidanceVersion`, `getGuidanceGeneratedAnchors`, `validateGuidancePolicy`, and `agentstack skills inspect`.

## Post-Review Adjustments

- Core is the source of truth for guidance anchors; generated manifests no longer duplicate those paths in `generated.requiredAnchors`.
- `getRequiredGeneratedAnchors()` dedupes before returning so lifecycle summaries and inspect counts stay accurate even if a manifest declares an anchor already derived by core.
- `expectedAgentstackGuidanceVersion` lives in `manifest.ts` with the default manifest value, and guidance policy consumes that shared constant.
- `agentstack skills inspect` has passing and missing-anchor tests, including fail telemetry for missing guidance files.
