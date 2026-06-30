# Agentstack Codex Skills Install Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `agentstack skills install codex` so a generated Agentstack app can explicitly scaffold Codex-discoverable repo skills after `agentstack create`.

**Architecture:** Keep `agentstack create` lean and unchanged. Store the Agentstack skill pack inside the installed `@agentstack/cli` package, then have the package-owned CLI copy that pack into the current app root at `.agents/skills/agentstack/`. The command does not edit `.gitignore`; installed skills are normal scaffold files and the user decides whether to track them.

**Tech Stack:** TypeScript, Node ESM, Vitest, filesystem copy helpers, existing Agentstack CLI dispatcher, Codex `.agents/skills/<skill>/SKILL.md` repo skill layout.

---

## Scope

This is a post-M4 local framework feature. It does not start M5, public npm publishing, hosted control-plane work, production gates, or live provider mutation.

The desired consumer flow is:

```sh
agentstack create acme-crm
cd acme-crm
agentstack skills install codex
```

or, when `agentstack` is on PATH:

```sh
agentstack skills install codex
```

The command writes:

```text
.agents/skills/agentstack/SKILL.md
.agents/skills/agentstack/references/workflows.md
.agents/skills/agentstack/references/guardrails.md
.agents/skills/agentstack/references/validation.md
```

The command must:

- require the current working directory to be an Agentstack app root by checking for `agentstack.config.ts`
- install only Codex for this slice
- refuse to overwrite user-edited skill files unless `--force` is passed
- be idempotent when the existing files already match the packaged skill pack
- avoid writing `.agentstack/`, `.gitignore`, generated `docs/`, generated `scripts/`, root `convex/`, or framework internals
- leave `agentstack create` output unchanged and still free of generated skills

## File Structure

- Create `packages/cli/src/skills.ts`: pure installer logic, package-root asset discovery, recursive file listing, conflict detection, and copy behavior.
- Create `packages/cli/skills/codex/agentstack/SKILL.md`: Codex skill entrypoint installed into `.agents/skills/agentstack/SKILL.md`.
- Create `packages/cli/skills/codex/agentstack/references/workflows.md`: package-owned command workflow reference.
- Create `packages/cli/skills/codex/agentstack/references/guardrails.md`: lean generated-app and no-live-mutation guardrails.
- Create `packages/cli/skills/codex/agentstack/references/validation.md`: validation and evidence commands.
- Modify `packages/cli/src/run.ts`: route `skills --help`, `skills install codex`, and include `skills` in top-level help.
- Modify `packages/cli/src/run.test.ts`: verify help, scaffold output, idempotency, conflict refusal, force overwrite, no `.gitignore` mutation, and telemetry.
- Modify `packages/agentstack/src/create/generate.test.ts`: keep `agentstack create` lean by asserting no `.agents/`, `.claude/`, or legacy `skills/` output.
- Modify `packages/agentstack/templates/b2b-saas/AGENTS.md` and `templates/b2b-saas/AGENTS.md`: mention the optional package-owned skill install command without adding generated skill files.
- Modify `README.md` and `docs/README.md`: document the optional command as post-create scaffolding.
- Modify `docs/milestones/M4-clean-machine-smoke.md` only if the M4 smoke command list needs to mention the new non-M4 command; do not mark a new milestone checkbox.

## Task 1: Tests For The Public Contract

**Files:**
- Modify: `packages/cli/src/run.test.ts`
- Modify: `packages/agentstack/src/create/generate.test.ts`

- [ ] **Step 1: Add failing CLI coverage for `skills --help`**

In `packages/cli/src/run.test.ts`, add this test near the existing help tests:

```ts
  it("prints skills usage without requiring a subcommand", async () => {
    const code = await runAgentstack(["skills", "--help"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("Usage: agentstack skills <command>");
    expect(output.join("\n")).toContain("install codex");
    expect(output.join("\n")).toContain(".agents/skills/agentstack");
  });
```

- [ ] **Step 2: Add failing install coverage**

In `packages/cli/src/run.test.ts`, add this test near the existing `skills inspect` tests:

```ts
  it("installs the Codex Agentstack skill scaffold without mutating gitignore", async () => {
    const beforeGitignore = await readFile(join(dir, ".gitignore"), "utf8");

    const code = await runAgentstack(["skills", "install", "codex"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS skills install codex");
    expect(output.join("\n")).toContain("Destination: .agents/skills/agentstack");
    expect(output.join("\n")).toContain(".agents/skills/agentstack/SKILL.md");

    const skill = await readFile(join(dir, ".agents/skills/agentstack/SKILL.md"), "utf8");
    const workflows = await readFile(
      join(dir, ".agents/skills/agentstack/references/workflows.md"),
      "utf8"
    );
    const guardrails = await readFile(
      join(dir, ".agents/skills/agentstack/references/guardrails.md"),
      "utf8"
    );
    const validation = await readFile(
      join(dir, ".agents/skills/agentstack/references/validation.md"),
      "utf8"
    );

    expect(skill).toContain("name: agentstack");
    expect(skill).toContain("agentstack skills install codex");
    expect(workflows).toContain("preview:up");
    expect(guardrails).toContain("Do not add generated docs, scripts, or framework internals");
    expect(validation).toContain("corepack pnpm run validate");
    expect(await readFile(join(dir, ".gitignore"), "utf8")).toBe(beforeGitignore);
  });
```

- [ ] **Step 3: Add failing idempotency and overwrite coverage**

In `packages/cli/src/run.test.ts`, add these tests after the install test:

```ts
  it("treats an already installed matching Codex skill scaffold as unchanged", async () => {
    expect(
      await runAgentstack(["skills", "install", "codex"], {
        cwd: dir,
        write: (line) => output.push(line)
      })
    ).toBe(0);

    output = [];
    expect(
      await runAgentstack(["skills", "install", "codex"], {
        cwd: dir,
        write: (line) => output.push(line)
      })
    ).toBe(0);

    expect(output).toContain("PASS skills install codex");
    expect(output.join("\n")).toContain("Unchanged: 4");
    expect(output.join("\n")).toContain("Created: 0");
  });

  it("refuses to overwrite user-edited Codex skill files without force", async () => {
    expect(
      await runAgentstack(["skills", "install", "codex"], {
        cwd: dir,
        write: (line) => output.push(line)
      })
    ).toBe(0);
    await writeFile(
      join(dir, ".agents/skills/agentstack/SKILL.md"),
      "---\nname: agentstack\ndescription: user edit\n---\n\nUser edited content.\n",
      "utf8"
    );

    output = [];
    const code = await runAgentstack(["skills", "install", "codex"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output).toContain("FAIL skills.install.conflict");
    expect(output.join("\n")).toContain(".agents/skills/agentstack/SKILL.md");
    expect(output.join("\n")).toContain("Fix: Re-run agentstack skills install codex --force");
  });

  it("overwrites user-edited Codex skill files with force", async () => {
    expect(
      await runAgentstack(["skills", "install", "codex"], {
        cwd: dir,
        write: (line) => output.push(line)
      })
    ).toBe(0);
    await writeFile(
      join(dir, ".agents/skills/agentstack/SKILL.md"),
      "---\nname: agentstack\ndescription: user edit\n---\n\nUser edited content.\n",
      "utf8"
    );

    output = [];
    const code = await runAgentstack(["skills", "install", "codex", "--force"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS skills install codex");
    expect(output.join("\n")).toContain("Overwritten: 1");
    expect(await readFile(join(dir, ".agents/skills/agentstack/SKILL.md"), "utf8")).toContain(
      "agentstack skills install codex"
    );
  });
```

- [ ] **Step 4: Add failing unsupported harness coverage**

In `packages/cli/src/run.test.ts`, add:

```ts
  it("fails unsupported skill harness installs with a supported command", async () => {
    const code = await runAgentstack(["skills", "install", "claude"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output).toContain("FAIL skills.install.unsupported-harness");
    expect(output.join("\n")).toContain("Supported harnesses: codex");
  });
```

- [ ] **Step 5: Add failing telemetry coverage**

In `packages/cli/src/run.test.ts`, extend the install test or add a separate test:

```ts
  it("records skills install telemetry", async () => {
    expect(
      await runAgentstack(["skills", "install", "codex"], {
        cwd: dir,
        write: (line) => output.push(line)
      })
    ).toBe(0);

    output = [];
    expect(
      await runAgentstack(
        ["observe", "timeline", "--env", "development", "--journey", "agent-guidance"],
        {
          cwd: dir,
          write: (line) => output.push(line)
        }
      )
    ).toBe(0);

    expect(output.join("\n")).toContain("agentstack.skills.install.completed");
    expect(output.join("\n")).toContain("status=ok");
  });
```

- [ ] **Step 6: Tighten `agentstack create` lean-surface expectations**

In `packages/agentstack/src/create/generate.test.ts`, extend the negative generated-file assertions:

```ts
      expect(files).not.toEqual(
        expect.arrayContaining([
          "agentstack.config.json",
          "docs/provider-resource-ledger.md",
          "docs/validation-hypothesis.md",
          "scripts/agentstack.mjs",
          "scripts/m1-providers-bootstrap.mjs",
          "skills/agentstack/SKILL.md",
          ".agents/skills/agentstack/SKILL.md",
          ".claude/skills/agentstack/SKILL.md",
          "convex/schema.ts",
          "vercel.json"
        ])
      );
      expect(files.some((file) => file.startsWith(".agents/"))).toBe(false);
      expect(files.some((file) => file.startsWith(".claude/"))).toBe(false);
```

- [ ] **Step 7: Run focused tests and verify they fail**

Run:

```sh
corepack pnpm exec vitest run packages/cli/src/run.test.ts -t "skills"
corepack pnpm exec vitest run packages/agentstack/src/create/generate.test.ts -t "M2 lean"
```

Expected before implementation:

```text
FAIL packages/cli/src/run.test.ts
Expected output to contain "Usage: agentstack skills <command>" or "PASS skills install codex"
```

The generator test may pass if the current create output is already lean. That is acceptable because it is regression coverage for this feature.

## Task 2: Package-Owned Skill Assets And Installer Helper

**Files:**
- Create: `packages/cli/src/skills.ts`
- Create: `packages/cli/skills/codex/agentstack/SKILL.md`
- Create: `packages/cli/skills/codex/agentstack/references/workflows.md`
- Create: `packages/cli/skills/codex/agentstack/references/guardrails.md`
- Create: `packages/cli/skills/codex/agentstack/references/validation.md`

- [ ] **Step 1: Create the installer helper**

Create `packages/cli/src/skills.ts`:

```ts
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const supportedSkillHarnesses = ["codex"] as const;

export type SupportedSkillHarness = (typeof supportedSkillHarnesses)[number];

export type SkillInstallFileResult = {
  path: string;
  status: "created" | "unchanged" | "overwritten";
};

export type SkillInstallConflict = {
  path: string;
};

export type SkillInstallResult =
  | {
      ok: true;
      harness: SupportedSkillHarness;
      destinationRoot: string;
      files: SkillInstallFileResult[];
    }
  | {
      ok: false;
      reason: "unsupported-harness";
      harness: string;
      supported: SupportedSkillHarness[];
    }
  | {
      ok: false;
      reason: "conflict";
      harness: SupportedSkillHarness;
      destinationRoot: string;
      conflicts: SkillInstallConflict[];
    };

const harnessDestinations: Record<SupportedSkillHarness, string> = {
  codex: ".agents/skills"
};

export async function installSkillPack(input: {
  cwd: string;
  harness: string;
  force?: boolean;
}): Promise<SkillInstallResult> {
  if (!isSupportedSkillHarness(input.harness)) {
    return {
      ok: false,
      reason: "unsupported-harness",
      harness: input.harness,
      supported: [...supportedSkillHarnesses]
    };
  }

  const sourceRoot = join(findCliPackageRoot(), "skills", input.harness);
  const destinationRoot = harnessDestinations[input.harness];
  const sourceFiles = await listPackFiles(sourceRoot);
  const conflicts: SkillInstallConflict[] = [];
  const plannedWrites: Array<{ sourcePath: string; destinationPath: string; relativePath: string; content: string }> =
    [];

  for (const sourcePath of sourceFiles) {
    const relativePath = toPortablePath(relative(sourceRoot, sourcePath));
    const destinationPath = join(input.cwd, destinationRoot, relativePath);
    const content = await readFile(sourcePath, "utf8");
    const existing = await readExistingFile(destinationPath);

    if (existing !== undefined && existing !== content && !input.force) {
      conflicts.push({ path: toPortablePath(join(destinationRoot, relativePath)) });
      continue;
    }

    plannedWrites.push({ sourcePath, destinationPath, relativePath, content });
  }

  if (conflicts.length > 0) {
    return {
      ok: false,
      reason: "conflict",
      harness: input.harness,
      destinationRoot,
      conflicts
    };
  }

  const files: SkillInstallFileResult[] = [];
  for (const write of plannedWrites) {
    const existing = await readExistingFile(write.destinationPath);
    const outputPath = toPortablePath(join(destinationRoot, write.relativePath));
    if (existing === write.content) {
      files.push({ path: outputPath, status: "unchanged" });
      continue;
    }

    await mkdir(dirname(write.destinationPath), { recursive: true });
    await writeFile(write.destinationPath, write.content, "utf8");
    files.push({ path: outputPath, status: existing === undefined ? "created" : "overwritten" });
  }

  return {
    ok: true,
    harness: input.harness,
    destinationRoot: toPortablePath(join(destinationRoot, "agentstack")),
    files
  };
}

function isSupportedSkillHarness(value: string): value is SupportedSkillHarness {
  return (supportedSkillHarnesses as readonly string[]).includes(value);
}

function findCliPackageRoot(): string {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  return dirname(sourceDir);
}

async function listPackFiles(root: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (entry.isFile()) {
        files.push(path);
      }
    }
  }

  await visit(root);
  return files.sort();
}

async function readExistingFile(path: string): Promise<string | undefined> {
  try {
    const pathStat = await stat(path);
    if (!pathStat.isFile()) {
      return undefined;
    }
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function toPortablePath(path: string): string {
  return path.replaceAll("\\", "/");
}
```

- [ ] **Step 2: Create the Codex skill entrypoint**

Create `packages/cli/skills/codex/agentstack/SKILL.md`:

```md
---
name: agentstack
description: Use when working in an Agentstack generated app: validate the lean app, run local dev, bootstrap preview providers, smoke auth/data/billing, or inspect package-owned evidence without copying framework internals.
---

# Agentstack App Workflow

This repository is an Agentstack generated app. Keep the app lean and use the installed `agentstack` package for framework workflows.

## First Steps

1. Read `AGENTS.md`.
2. Read `agentstack.config.ts`.
3. Run `corepack pnpm run validate` before changing framework-facing behavior.
4. Use `corepack pnpm run dev:check` for local preflight diagnostics.
5. Use `corepack pnpm run dev` for local web development.

## Package-Owned Commands

Use package scripts that call the installed `agentstack` binary:

- `corepack pnpm run validate`
- `corepack pnpm run dev:check`
- `corepack pnpm run dev`
- `corepack pnpm run preview:sync`
- `corepack pnpm run preview:up -- --confirm-live-mutation`
- `corepack pnpm run preview:smoke`
- `corepack pnpm run evidence:check`
- `corepack pnpm run billing:bootstrap`
- `corepack pnpm run billing:fixture`
- `corepack pnpm run billing:smoke`

## Guardrails

- Do not copy Agentstack framework docs, scripts, runbooks, provider ledgers, or package internals into the generated app.
- Do not use direct imports from framework source packages as the app success path.
- Do not mutate live providers unless the command requires and receives `--confirm-live-mutation`.
- Store mutable runtime state and evidence under `.agentstack/` when package commands create it.
- If this skill is missing in a fresh app, reinstall it with `agentstack skills install codex`.

## References

- `references/workflows.md`
- `references/guardrails.md`
- `references/validation.md`
```

- [ ] **Step 3: Create the workflow reference**

Create `packages/cli/skills/codex/agentstack/references/workflows.md`:

```md
# Agentstack Workflows

## Local App Loop

Use this path after `agentstack create`:

```sh
corepack pnpm install
corepack pnpm run validate
corepack pnpm run dev:check
corepack pnpm run dev
```

`dev:check` is diagnostics-only. `dev` starts the local web surface after preflight.

## Preview Provider Loop

Preview provider work is explicit:

```sh
corepack pnpm run preview:sync
corepack pnpm run preview:up -- --confirm-live-mutation
corepack pnpm run preview:smoke
corepack pnpm run evidence:check
```

`preview:sync` is local rehearsal. `preview:up -- --confirm-live-mutation` is the live preview bootstrap/link/deploy path.

## Billing Loop

Use the package-owned billing commands:

```sh
corepack pnpm run billing:bootstrap
corepack pnpm run billing:fixture -- subscribe --env preview --entitlement feature.auditLog --confirm-live-mutation
corepack pnpm run billing:smoke
```

If a provider CLI prints an auth or browser handoff, follow the exact handoff and then rerun the same package command.
```

- [ ] **Step 4: Create the guardrails reference**

Create `packages/cli/skills/codex/agentstack/references/guardrails.md`:

```md
# Agentstack Guardrails

## Lean Generated App

Generated apps contain app code and typed config. Do not add generated docs, scripts, or framework internals to satisfy an Agentstack workflow.

Expected root surface:

```text
apps/mobile
apps/web
apps/convex
agentstack.config.ts
AGENTS.md
.gitignore
package.json
pnpm-workspace.yaml
```

Optional installed skills from `agentstack skills install codex` live under `.agents/skills/` because Codex discovers repo skills there.

## Product Boundary

The app depends on `agentstack`. Provider glue, validation, diagnostics, smoke checks, evidence generation, and command help are package-owned.

Use generated package scripts or the public `agentstack` binary. Do not use direct imports such as `generateProject`, `runAgentstack`, provider helpers, or telemetry helpers as the consumer success path.

## Live Provider Safety

Preview provider mutation requires explicit confirmation:

```sh
corepack pnpm run preview:up -- --confirm-live-mutation
```

Do not create, link, mutate, or clean real provider resources through manual dashboard work unless an Agentstack package command prints the exact required handoff.
```

- [ ] **Step 5: Create the validation reference**

Create `packages/cli/skills/codex/agentstack/references/validation.md`:

```md
# Agentstack Validation

## Local Validation

Run:

```sh
corepack pnpm run validate
corepack pnpm run dev:check
```

`validate` checks the generated app structure, typed config, source policy, and local contracts. `dev:check` verifies the local web preflight without starting a long-running server.

## Framework Changes

When changing the Agentstack framework repo rather than a generated app, run focused tests for touched files, then:

```sh
corepack pnpm typecheck
corepack pnpm test
git diff --check
```

If templates change, verify the root template mirror and package template mirror:

```sh
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
```

## Evidence

Generated app runtime state and smoke artifacts belong under `.agentstack/`. Framework milestone evidence belongs under `docs/milestones/evidence/<milestone-id>/` in the framework repo and must be redacted.
```

- [ ] **Step 6: Run focused helper-free checks**

Run:

```sh
corepack pnpm exec vitest run packages/cli/src/run.test.ts -t "skills"
```

Expected at this point: tests still fail because `run.ts` does not route `skills install codex` yet.

## Task 3: CLI Routing, Help, And Docs

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`
- Modify: `packages/agentstack/templates/b2b-saas/AGENTS.md`
- Modify: `templates/b2b-saas/AGENTS.md`
- Modify: `README.md`
- Modify: `docs/README.md`

- [ ] **Step 1: Import the installer in `run.ts`**

In `packages/cli/src/run.ts`, add:

```ts
import { installSkillPack, supportedSkillHarnesses } from "./skills.js";
```

- [ ] **Step 2: Route `skills --help` and `skills install`**

In `runAgentstack`, replace the current narrow `skills inspect` routing:

```ts
    if (command === "skills" && subcommand === "inspect") {
      return await skillsInspectCommand(io);
    }
```

with:

```ts
    if (command === "skills" && (isHelpArg(subcommand) || subcommand === undefined)) {
      writeSkillsUsage(io);
      return 0;
    }

    if (command === "skills" && subcommand === "install") {
      return await skillsInstallCommand(rest, io);
    }

    if (command === "skills" && subcommand === "inspect") {
      return await skillsInspectCommand(io);
    }
```

- [ ] **Step 3: Add skills to top-level help**

In `writeTopLevelUsage`, add this command line after `observe` or before `theme`:

```ts
  io.write("  skills        Install or inspect repo-local agent skills");
```

- [ ] **Step 4: Add skills usage and install command**

In `packages/cli/src/run.ts`, place these functions near `skillsInspectCommand`:

```ts
function writeSkillsUsage(io: RunIo): void {
  io.write("Usage: agentstack skills <command> [options]");
  io.write("");
  io.write("Commands:");
  io.write("  install codex   Install Codex repo skills under .agents/skills/agentstack");
  io.write("  inspect         Inspect package-owned Agentstack guidance state");
  io.write("");
  io.write("Options:");
  io.write("  --force         Overwrite existing skill scaffold files when they differ");
}

async function skillsInstallCommand(argv: string[], io: RunIo): Promise<number> {
  const [harness, ...rest] = argv;
  const fix = "Run agentstack skills install codex.";
  if (isHelpArg(harness)) {
    writeSkillsUsage(io);
    return 0;
  }
  if (!harness || harness.startsWith("--")) {
    io.write("FAIL skills.install.harness-missing");
    io.write("A skill harness is required.");
    io.write(`Fix: ${fix}`);
    return 1;
  }

  const options = parseOptions(rest);
  if (options.help === true || options.h === true) {
    writeSkillsUsage(io);
    return 0;
  }

  if (!(await requireAgentstackAppRoot(io))) {
    return 1;
  }

  const result = await installSkillPack({
    cwd: io.cwd,
    harness,
    force: options.force === true
  });

  if (!result.ok && result.reason === "unsupported-harness") {
    io.write("FAIL skills.install.unsupported-harness");
    io.write(`Harness: ${result.harness}`);
    io.write(`Supported harnesses: ${result.supported.join(", ")}`);
    io.write(`Fix: ${fix}`);
    return 1;
  }

  if (!result.ok && result.reason === "conflict") {
    io.write("FAIL skills.install.conflict");
    io.write(`Destination: ${result.destinationRoot}`);
    for (const conflict of result.conflicts) {
      io.write(`- ${conflict.path}`);
    }
    io.write("Fix: Re-run agentstack skills install codex --force after reviewing the local edits.");
    await recordCommandEvent(io, {
      name: "agentstack.skills.install.completed",
      environment: "development",
      journey: "agent-guidance",
      command: ["skills", "install", harness, ...rest].join(" "),
      status: "fail",
      state: {
        harness,
        conflicts: result.conflicts.length
      }
    });
    return 1;
  }

  const created = result.files.filter((file) => file.status === "created").length;
  const unchanged = result.files.filter((file) => file.status === "unchanged").length;
  const overwritten = result.files.filter((file) => file.status === "overwritten").length;

  io.write(`PASS skills install ${result.harness}`);
  io.write(`Destination: ${result.destinationRoot}`);
  io.write(`Created: ${created}`);
  io.write(`Unchanged: ${unchanged}`);
  io.write(`Overwritten: ${overwritten}`);
  io.write("Files:");
  for (const file of result.files) {
    io.write(`- ${file.status} ${file.path}`);
  }
  io.write("Next: Start or restart Codex from this repo if the skill selector does not show agentstack.");

  await recordCommandEvent(io, {
    name: "agentstack.skills.install.completed",
    environment: "development",
    journey: "agent-guidance",
    command: ["skills", "install", result.harness, ...rest].join(" "),
    status: "ok",
    state: {
      harness: result.harness,
      created,
      unchanged,
      overwritten
    }
  });
  return 0;
}

async function requireAgentstackAppRoot(io: RunIo): Promise<boolean> {
  try {
    const configStat = await stat(join(io.cwd, "agentstack.config.ts"));
    if (configStat.isFile()) {
      return true;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  io.write("FAIL skills.install.app-root-missing");
  io.write("agentstack.config.ts is required in the current working directory.");
  io.write("Fix: Run agentstack skills install codex from the generated Agentstack app root.");
  return false;
}
```

- [ ] **Step 5: Update generated app AGENTS guidance**

In both `packages/agentstack/templates/b2b-saas/AGENTS.md` and `templates/b2b-saas/AGENTS.md`, add this under `## Commands`:

```md
- `agentstack skills install codex` (optional Codex repo-skill scaffold)
```

Also add one short paragraph before the command list:

```md
Optional repo-local Codex skills can be installed after creation with
`agentstack skills install codex`. The command writes normal scaffold files
under `.agents/skills/`; decide in your repo whether to track or ignore them.
```

- [ ] **Step 6: Update README docs**

In `README.md`, add a short optional section after the create example:

```md
Optional Codex repo skills can be scaffolded after app creation:

```sh
agentstack skills install codex
```

The command writes `.agents/skills/agentstack/` in the generated app. `agentstack create` remains lean and does not install skills automatically.
```

In `docs/README.md`, add one row under Operational References or Documentation Health Rules:

```md
- Optional Codex repo skills are installed explicitly with `agentstack skills install codex`; they are not emitted by `agentstack create`.
```

- [ ] **Step 7: Run focused tests**

Run:

```sh
corepack pnpm exec vitest run packages/cli/src/run.test.ts -t "skills"
corepack pnpm exec vitest run packages/agentstack/src/create/generate.test.ts -t "M2 lean"
```

Expected:

```text
PASS packages/cli/src/run.test.ts
PASS packages/agentstack/src/create/generate.test.ts
```

- [ ] **Step 8: Run broader verification for touched code**

Run:

```sh
corepack pnpm typecheck
corepack pnpm test
git diff --check
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
```

Expected:

```text
typecheck exits 0
test exits 0
git diff --check exits 0
diff exits 0
```

## Self-Review

Spec coverage:

- `agentstack create` remains lean: Task 1 Step 6.
- `agentstack skills install codex` installs Codex-visible `.agents/skills/agentstack`: Task 1 Step 2 and Task 2 Steps 1-5.
- No `.gitignore` mutation: Task 1 Step 2.
- User decides tracking/ignoring: Task 3 Step 5 and Step 6.
- Refuse divergent overwrites unless `--force`: Task 1 Step 3 and Task 3 Step 4.
- Current app root requirement: the implementation checks for `agentstack.config.ts` without importing it, so the command works immediately after `agentstack create`.
- No M5/public publish/live mutation: Scope section.

Banned-term scan: clean.

Type consistency:

- `supportedSkillHarnesses`, `SupportedSkillHarness`, `installSkillPack`, and `SkillInstallResult` are defined in Task 2 and imported in Task 3 with matching names.
- Command output strings used in tests match the implementation snippets: `PASS skills install codex`, `FAIL skills.install.conflict`, `FAIL skills.install.unsupported-harness`, and `Destination: .agents/skills/agentstack`.
