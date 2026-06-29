# Agentstack Happy Path Command Surface Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the generated Agentstack consumer path use one public `agentstack` entrypoint and a happy-path command flow that gets an agent from a fresh app to useful local and preview capabilities without command-surface guesswork.

**Architecture:** Collapse the public creation surface into the `agentstack` package, make generated package scripts and CLI help derive from the same command contract, and make `pnpm run dev` start the local web surface after preflight. Keep lower-level commands available as repeatable capabilities, but make the first path executable and explicit about local rehearsal versus live provider mutation.

**Tech Stack:** TypeScript, Node ESM, pnpm workspaces, Vitest, generated B2B SaaS template, local `.agentstack/` state, existing Clerk/Convex/Vercel/EAS provider command wrappers.

---

## Scope

This plan remediates command-surface friction before M4. It does not publish packages, validate a clean-machine npm install, or start new M4 packaging work.

The intended consumer path after this plan:

```sh
agentstack create ags01 --package-spec link:<agentstack-repo>/packages/agentstack
cd ags01
corepack pnpm install
corepack pnpm run validate
corepack pnpm run dev
```

For live preview capability, the intended path becomes:

```sh
corepack pnpm run preview:up -- --confirm-live-mutation
```

That command may stop for provider auth or browser handoffs, but it must print the exact next command or exact external action needed.

## File Structure

- Modify `packages/agentstack/src/bin.ts`: own the public `agentstack create` command and unified top-level help.
- Create `packages/agentstack/src/create/generate.ts`: move the generator implementation here.
- Create `packages/agentstack/src/create/generate.test.ts`: move and update generator tests.
- Create `packages/agentstack/templates/b2b-saas/**`: move the package-local template mirror here.
- Delete `packages/create-agent-stack/**`: remove the second public package and `create-agent-stack` bin from the active workspace.
- Modify `packages/agentstack/package.json`: remove the `create-agent-stack` dependency and include generator/template files in the single public package.
- Modify `pnpm-workspace.yaml`: keep only active packages under `packages/*`; after deleting `packages/create-agent-stack`, no special workspace rule is needed.
- Modify `packages/cli/src/run.ts`: expose help for all supported commands, add `preview up`, make `dev` start a local surface, and make diagnostics surface-scoped.
- Modify `packages/cli/src/run.test.ts`: cover unified help, help short-circuiting, dev happy path, executable next commands, local rehearsal wording, and preview-up orchestration.
- Modify `templates/b2b-saas/package.json` and `packages/agentstack/templates/b2b-saas/package.json`: add happy-path scripts and remove stale script references.
- Modify `templates/b2b-saas/AGENTS.md` and `packages/agentstack/templates/b2b-saas/AGENTS.md`: document the happy path without generated runbooks.
- Modify `tests/e2e/prototype.test.ts`: prove the consumer uses `agentstack create`, generated scripts, and no `create-agent-stack` command.
- Modify `README.md`, `docs/README.md`, `docs/references/local-quickstart.md`, `docs/validation-hypothesis.md`, and `docs/milestones/M2-agent-completes-m1.md`: update the single-entrypoint and happy-path contract.

## Task 1: Collapse Creation Into The `agentstack` Package

**Files:**
- Create: `packages/agentstack/src/create/generate.ts`
- Create: `packages/agentstack/src/create/generate.test.ts`
- Create: `packages/agentstack/templates/b2b-saas/**`
- Modify: `packages/agentstack/src/bin.ts`
- Modify: `packages/agentstack/package.json`
- Delete: `packages/create-agent-stack/**`
- Test: `packages/agentstack/src/create/generate.test.ts`
- Test: `tests/e2e/prototype.test.ts`

- [ ] **Step 1: Write the failing single-entrypoint e2e assertion**

In `tests/e2e/prototype.test.ts`, extend the help and creation assertions so the consumer e2e treats `agentstack` as the only public creation command:

```ts
const helpResult = await invokeAgentstackBin(["--help"], tempRoot);
expect(helpResult.exitCode).toBe(0);
expect(helpResult.stdout).toContain("agentstack create <app-name>");
expect(helpResult.stdout).not.toContain("create-agent-stack");
```

Also add this package metadata assertion near the existing generated app checks:

```ts
const generatedPackage = JSON.parse(await readFile(join(appDir, "package.json"), "utf8"));
expect(generatedPackage.dependencies.agentstack).toBe(`link:${agentstackPackageDir}`);
expect(generatedPackage.scripts).not.toHaveProperty("create-agent-stack");
```

- [ ] **Step 2: Run the e2e test to verify it fails before the package move**

Run:

```sh
corepack pnpm exec vitest run tests/e2e/prototype.test.ts
```

Expected: FAIL while `agentstack` still imports `generateProject` from the separate `create-agent-stack` package or while docs/help still expose the old command.

- [ ] **Step 3: Move generator implementation into `packages/agentstack`**

Create `packages/agentstack/src/create/generate.ts` with the current generator behavior and package-local template lookup:

```ts
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const fsExtra = require("fs-extra") as {
  copy(source: string, destination: string): Promise<void>;
};

export type GenerateProjectInput = {
  name: string;
  targetDir: string;
  packageSpec?: string;
};

export async function generateProject(input: GenerateProjectInput): Promise<void> {
  const appSlug = slugify(input.name);
  if (!appSlug) {
    throw new Error("Project name must contain at least one letter or number.");
  }

  const appName = titleCaseSlug(appSlug);
  const templateDir = findTemplateDir();

  await fsExtra.copy(templateDir, input.targetDir);
  await replaceTokens(input.targetDir, {
    __APP_SLUG__: appSlug,
    __APP_NAME__: appName,
    __AGENTSTACK_PACKAGE_SPEC__: input.packageSpec ?? "0.0.0"
  });
}

function findTemplateDir(): string {
  return join(findPackageRoot(), "templates", "b2b-saas");
}

function findPackageRoot(): string {
  const sourceDir = dirname(fileURLToPath(import.meta.url));
  return dirname(dirname(sourceDir));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function replaceTokens(directory: string, replacements: Record<string, string>): Promise<void> {
  const entries = await readdir(directory);

  await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry);
      const entryStat = await stat(path);

      if (entryStat.isDirectory()) {
        await replaceTokens(path, replacements);
        return;
      }

      if (!entryStat.isFile()) {
        return;
      }

      const content = await readFile(path, "utf8");
      const replaced = Object.entries(replacements).reduce(
        (current, [token, value]) => current.replaceAll(token, value),
        content
      );

      if (replaced !== content) {
        await writeFile(path, replaced);
      }
    })
  );
}
```

- [ ] **Step 4: Move generator tests**

Move `packages/create-agent-stack/src/generate.test.ts` to `packages/agentstack/src/create/generate.test.ts` and update the path constants:

```ts
const sourceDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(sourceDir, "../..");
const repoRoot = resolve(packageRoot, "../..");
const rootTemplateDir = join(repoRoot, "templates/b2b-saas");
const packageTemplateDir = join(packageRoot, "templates/b2b-saas");
```

Remove the direct `create-agent-stack` bin test and replace it with a public `agentstack create` test in `tests/e2e/prototype.test.ts`.

- [ ] **Step 5: Move template mirror**

Create `packages/agentstack/templates/b2b-saas/**` by moving the current package-local template files from `packages/create-agent-stack/templates/b2b-saas/**`.

The mirror check changes from:

```sh
diff -rq templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

to:

```sh
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
```

- [ ] **Step 6: Update `packages/agentstack/src/bin.ts` to import the local generator**

Replace:

```ts
import { generateProject } from "create-agent-stack";
```

with:

```ts
import { generateProject } from "./create/generate.js";
```

- [ ] **Step 7: Update `packages/agentstack/package.json`**

Remove the `create-agent-stack` dependency and add `fs-extra`:

```json
"dependencies": {
  "@agentstack/cli": "workspace:*",
  "@agentstack/core": "workspace:*",
  "fs-extra": "^11.2.0",
  "tsx": "^4.19.2"
}
```

Keep the only bin:

```json
"bin": {
  "agentstack": "src/bin.js"
}
```

- [ ] **Step 8: Delete the public `create-agent-stack` package**

Delete:

```text
packages/create-agent-stack/package.json
packages/create-agent-stack/src/bin.js
packages/create-agent-stack/src/bin.ts
packages/create-agent-stack/src/generate.ts
packages/create-agent-stack/src/generate.test.ts
packages/create-agent-stack/src/index.ts
packages/create-agent-stack/templates/b2b-saas/**
```

- [ ] **Step 9: Run focused verification**

Run:

```sh
corepack pnpm exec vitest run packages/agentstack/src/create/generate.test.ts tests/e2e/prototype.test.ts
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
corepack pnpm typecheck
```

Expected: all commands exit 0.

- [ ] **Step 10: Commit**

```sh
git add packages/agentstack packages/create-agent-stack tests/e2e/prototype.test.ts pnpm-lock.yaml README.md docs
git commit -m "refactor: make agentstack the only create entrypoint"
```

## Task 2: Unify CLI Help And Help Short-Circuiting

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/agentstack/src/bin.ts`
- Test: `packages/cli/src/run.test.ts`
- Test: `tests/e2e/prototype.test.ts`

- [ ] **Step 1: Write failing CLI help tests**

In `packages/cli/src/run.test.ts`, add:

```ts
it("lists every supported public command in top-level help", async () => {
  const code = await runAgentstack(["--help"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output.join("\n")).toContain("sync");
  expect(output.join("\n")).toContain("env");
  expect(output.join("\n")).toContain("auth");
  expect(output.join("\n")).toContain("smoke");
  expect(output.join("\n")).toContain("evidence");
});

it("prints sync help without requiring --env", async () => {
  const code = await runAgentstack(["sync", "--help"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output.join("\n")).toContain("Usage: agentstack sync --env <environment> [--apply]");
  expect(output.join("\n")).toContain("Local rehearsal only");
});

it("prints env help without requiring a subcommand", async () => {
  const code = await runAgentstack(["env", "--help"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output.join("\n")).toContain("Usage: agentstack env <command> [options]");
  expect(output.join("\n")).toContain("inspect");
  expect(output.join("\n")).toContain("set");
});
```

- [ ] **Step 2: Run the help tests to verify they fail**

Run:

```sh
corepack pnpm exec vitest run packages/cli/src/run.test.ts -t "help|sync help|env help"
```

Expected: FAIL because `sync --help` currently validates `--env` before printing help and the facade help omits supported commands.

- [ ] **Step 3: Add help utility functions inside `packages/cli/src/run.ts`**

Add:

```ts
function isHelpArg(value: string | undefined): boolean {
  return value === "--help" || value === "-h" || value === "help";
}

function writeSyncUsage(io: RunIo): void {
  io.write("Usage: agentstack sync --env <environment> [--apply]");
  io.write("");
  io.write("Local rehearsal only. This updates ignored .agentstack state and does not mutate live providers.");
  io.write("");
  io.write("Examples:");
  io.write("  agentstack sync --env preview");
  io.write("  agentstack sync --env preview --apply");
}

function writeEnvUsage(io: RunIo): void {
  io.write("Usage: agentstack env <command> [options]");
  io.write("");
  io.write("Commands:");
  io.write("  inspect      Inspect declared local and provider env binding state");
  io.write("  set          Store a local validation env value under .agentstack/");
}
```

- [ ] **Step 4: Short-circuit help before option validation**

At the start of `syncCommand`:

```ts
if (argv.some(isHelpArg)) {
  writeSyncUsage(io);
  return 0;
}
```

In the `runAgentstack` dispatcher before `env inspect` and `env set`:

```ts
if (command === "env" && (isHelpArg(subcommand) || subcommand === undefined)) {
  writeEnvUsage(io);
  return 0;
}
```

- [ ] **Step 5: Align facade help with CLI help**

Update `packages/agentstack/src/bin.ts` top-level usage to include every public command:

```ts
"  create       Create a lean Agentstack app",
"  validate     Validate project structure and release readiness",
"  dev          Start a local app surface after preflight",
"  doctor       Diagnose readiness without starting servers",
"  sync         Rehearse local provider state under .agentstack/",
"  env          Inspect or set local validation env values",
"  deploy       Plan or apply deploy actions",
"  provider     Bootstrap, link, inspect, adopt, or ledger provider resources",
"  auth         Manage package-owned auth fixtures",
"  billing      Bootstrap and verify Clerk Billing entitlement fixtures",
"  smoke        Validate preview auth/data smoke evidence",
"  evidence     Check package-owned validation evidence",
"  observe      Inspect telemetry and journey evidence",
"  theme        Validate generated theme tokens"
```

- [ ] **Step 6: Run focused verification**

Run:

```sh
corepack pnpm exec vitest run packages/cli/src/run.test.ts -t "help|sync help|env help"
corepack pnpm exec vitest run tests/e2e/prototype.test.ts
```

Expected: all tests exit 0.

- [ ] **Step 7: Commit**

```sh
git add packages/cli/src/run.ts packages/cli/src/run.test.ts packages/agentstack/src/bin.ts tests/e2e/prototype.test.ts
git commit -m "fix: unify agentstack command help"
```

## Task 3: Make Generated Scripts Match Emitted Next Commands

**Files:**
- Modify: `templates/b2b-saas/package.json`
- Modify: `packages/agentstack/templates/b2b-saas/package.json`
- Modify: `packages/agentstack/src/create/generate.test.ts`
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Write a failing generated script contract test**

In `packages/agentstack/src/create/generate.test.ts`, update the root script assertion to require:

```ts
expect(packageManifest.scripts).toMatchObject({
  validate: "agentstack validate",
  dev: "agentstack dev --surface web",
  "dev:check": "agentstack dev --surface web --check",
  doctor: "agentstack doctor --env preview",
  "env:inspect": "agentstack env inspect --env preview",
  "preview:sync": "agentstack sync --env preview --apply",
  "preview:up": "agentstack preview up --env preview",
  "provider:bootstrap": "agentstack provider bootstrap",
  "provider:link": "agentstack provider link",
  "auth:user": "agentstack auth user",
  "billing:bootstrap": "agentstack billing bootstrap",
  "billing:fixture": "agentstack billing fixture",
  "billing:smoke": "agentstack billing smoke",
  "preview:deploy": "agentstack deploy --env preview",
  "preview:smoke": "agentstack smoke --env preview",
  "evidence:check": "agentstack evidence check"
});
```

Also assert stale scripts are absent:

```ts
expect(packageManifest.scripts).not.toHaveProperty("preview:apply");
expect(Object.values(packageManifest.scripts).join("\n")).not.toContain("scripts/");
```

- [ ] **Step 2: Write a failing next-command parity test**

In `packages/cli/src/run.test.ts`, add:

```ts
it("dev next commands only reference generated scripts that exist", async () => {
  await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });

  const code = await runAgentstack(["dev", "--env", "preview", "--surface", "web", "--check"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output.join("\n")).toContain("pnpm run env:inspect");
  expect(output.join("\n")).toContain("pnpm run preview:sync");
  expect(output.join("\n")).not.toContain("pnpm run preview:apply");
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run:

```sh
corepack pnpm exec vitest run packages/agentstack/src/create/generate.test.ts packages/cli/src/run.test.ts -t "scripts|next commands"
```

Expected: FAIL because the template lacks `env:inspect`, `preview:sync`, `preview:up`, and `dev:check`, while `writeDevNextCommands` still emits `preview:apply`.

- [ ] **Step 4: Update generated package scripts in both template mirrors**

In both template package files, set:

```json
"scripts": {
  "validate": "agentstack validate",
  "dev": "agentstack dev --surface web",
  "dev:check": "agentstack dev --surface web --check",
  "doctor": "agentstack doctor --env preview",
  "env:inspect": "agentstack env inspect --env preview",
  "preview:sync": "agentstack sync --env preview --apply",
  "preview:up": "agentstack preview up --env preview",
  "provider:bootstrap": "agentstack provider bootstrap",
  "provider:link": "agentstack provider link",
  "auth:user": "agentstack auth user",
  "billing:bootstrap": "agentstack billing bootstrap",
  "billing:fixture": "agentstack billing fixture",
  "billing:smoke": "agentstack billing smoke",
  "preview:deploy": "agentstack deploy --env preview",
  "preview:smoke": "agentstack smoke --env preview",
  "evidence:check": "agentstack evidence check"
}
```

- [ ] **Step 5: Update `writeDevNextCommands`**

Replace the preview sync command with:

```ts
const syncCommand =
  environment === "preview"
    ? "pnpm run preview:sync"
    : `agentstack sync --env ${environment} --apply`;
```

Keep `pnpm run env:inspect` only because the generated template now defines it.

- [ ] **Step 6: Run focused verification**

Run:

```sh
corepack pnpm exec vitest run packages/agentstack/src/create/generate.test.ts packages/cli/src/run.test.ts -t "scripts|next commands"
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```sh
git add templates/b2b-saas/package.json packages/agentstack/templates/b2b-saas/package.json packages/agentstack/src/create/generate.test.ts packages/cli/src/run.ts packages/cli/src/run.test.ts
git commit -m "fix: align generated scripts with next commands"
```

## Task 4: Make `pnpm run dev` Start The Web Surface

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`
- Modify: `templates/b2b-saas/AGENTS.md`
- Modify: `packages/agentstack/templates/b2b-saas/AGENTS.md`
- Test: `tests/e2e/prototype.test.ts`

- [ ] **Step 1: Write failing dev happy-path tests**

In `packages/cli/src/run.test.ts`, add:

```ts
it("starts the web dev surface after passing preflight", async () => {
  await runAgentstack(["sync", "--env", "development", "--apply"], { cwd: dir, write: () => undefined });
  const commands: LocalCommandSpec[] = [];

  const code = await runAgentstack(["dev", "--surface", "web"], {
    cwd: dir,
    write: (line) => output.push(line),
    commandRunner: async (command) => {
      commands.push(command);
      return { exitCode: 0, stdout: "VITE ready", stderr: "" };
    }
  });

  expect(code).toBe(0);
  expect(output).toContain("PASS dev preflight development web");
  expect(commands).toEqual([
    { id: "dev:web", command: "pnpm", args: ["--filter", "@app/web", "dev"] }
  ]);
});

it("keeps dev check as diagnostics-only", async () => {
  await runAgentstack(["sync", "--env", "development", "--apply"], { cwd: dir, write: () => undefined });
  const commands: LocalCommandSpec[] = [];

  const code = await runAgentstack(["dev", "--surface", "web", "--check"], {
    cwd: dir,
    write: (line) => output.push(line),
    commandRunner: async (command) => {
      commands.push(command);
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  });

  expect(code).toBe(0);
  expect(output).toContain("PASS dev preflight development web");
  expect(output.join("\n")).toContain("pnpm run dev");
  expect(commands).toEqual([]);
});
```

- [ ] **Step 2: Run the dev tests to verify they fail**

Run:

```sh
corepack pnpm exec vitest run packages/cli/src/run.test.ts -t "web dev surface|dev check"
```

Expected: FAIL because `agentstack dev` currently prints commands and does not execute the web dev command.

- [ ] **Step 3: Add dev option parsing**

Inside `devCommand`, read `--surface`, `--env`, and `--check`:

```ts
const options = parseOptions(argv);
const environment = readDevEnvironmentOption(options.env);
const surface = readSurfaceOption(options.surface, {
  flag: "surface",
  fix: "Run agentstack dev --surface web."
});
const checkOnly = Boolean(options.check);
```

Add `readSurfaceOption` if it does not already exist:

```ts
function readSurfaceOption(value: string | boolean | undefined, input: { flag: string; fix: string }): SurfaceName {
  if (value === undefined) {
    return "web";
  }
  if (typeof value !== "string" || !surfaceValues.includes(value as SurfaceName)) {
    throw new Error(
      formatDiagnostic({
        severity: "fail",
        code: "cli.option.invalid",
        path: input.flag,
        message: `Invalid --${input.flag} value: ${String(value)}.`,
        fix: input.fix,
        blocks: ["command"]
      })
    );
  }
  return value as SurfaceName;
}
```

- [ ] **Step 4: Add a dev command runner**

Add:

```ts
function devCommandForSurface(surface: SurfaceName): LocalCommandSpec {
  if (surface === "web") {
    return { id: "dev:web", command: "pnpm", args: ["--filter", "@app/web", "dev"] };
  }
  if (surface === "mobile") {
    return { id: "dev:mobile", command: "pnpm", args: ["--filter", "@app/mobile", "dev"] };
  }
  return { id: "dev:convex", command: "pnpm", args: ["--filter", "@app/convex", "dev"] };
}
```

Use the existing `io.commandRunner` when present. For the real CLI path, use a child-process runner that inherits stdio:

```ts
async function runInteractiveCommand(io: RunIo, spec: LocalCommandSpec): Promise<number> {
  if (io.commandRunner) {
    const result = await io.commandRunner(spec);
    if (result.stdout) {
      io.write(result.stdout.trimEnd());
    }
    if (result.stderr) {
      io.write(result.stderr.trimEnd());
    }
    return result.exitCode;
  }

  return await new Promise((resolvePromise) => {
    const child = spawn(spec.command, spec.args, {
      cwd: io.cwd,
      stdio: "inherit",
      shell: false,
      env: process.env
    });
    child.on("error", (error) => {
      io.write(error.message);
      resolvePromise(1);
    });
    child.on("close", (exitCode) => resolvePromise(exitCode ?? 1));
  });
}
```

- [ ] **Step 5: Update `devCommand` behavior**

When local diagnostics fail, keep returning 1. When `--check` is present, print next commands and return 0. Otherwise execute the selected surface command:

```ts
if (!checkOnly) {
  io.write(`Starting ${surface} dev server: ${formatCommandSpec(devCommandForSurface(surface))}`);
  const exitCode = await runInteractiveCommand(io, devCommandForSurface(surface));
  return exitCode;
}
```

Add:

```ts
function formatCommandSpec(spec: LocalCommandSpec): string {
  return [spec.command, ...spec.args].join(" ");
}
```

- [ ] **Step 6: Keep provider cloud issues non-blocking for local web dev**

For default `development` web dev, do not print preview provider cloud failures. For explicit `--env preview --check`, print preview cloud diagnostics but keep them scoped to the selected surface.

Add a helper:

```ts
function filterCloudDiagnosticsForSurface(diagnostics: Diagnostic[], surface: SurfaceName): Diagnostic[] {
  if (surface === "web") {
    return diagnostics.filter((diagnostic) => !diagnostic.path.includes(".eas"));
  }
  if (surface === "mobile") {
    return diagnostics.filter((diagnostic) => !diagnostic.path.includes(".vercel"));
  }
  return diagnostics;
}
```

Use this helper before printing cloud diagnostics from `devCommand`.

- [ ] **Step 7: Update generated AGENTS guidance**

In both generated `AGENTS.md` mirrors, add:

```md
## Happy Path

- `pnpm run validate`
- `pnpm run dev`
- `pnpm run preview:up -- --confirm-live-mutation`

`pnpm run dev:check` is diagnostics-only. `pnpm run dev` starts the local web surface.
```

- [ ] **Step 8: Run focused verification**

Run:

```sh
corepack pnpm exec vitest run packages/cli/src/run.test.ts -t "web dev surface|dev check|dev preflight"
corepack pnpm exec vitest run tests/e2e/prototype.test.ts
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit**

```sh
git add packages/cli/src/run.ts packages/cli/src/run.test.ts templates/b2b-saas/AGENTS.md packages/agentstack/templates/b2b-saas/AGENTS.md tests/e2e/prototype.test.ts
git commit -m "feat: make agentstack dev start the web surface"
```

## Task 5: Make Local Rehearsal Versus Live Mutation Explicit

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`
- Modify: `templates/b2b-saas/AGENTS.md`
- Modify: `packages/agentstack/templates/b2b-saas/AGENTS.md`
- Modify: `docs/references/local-quickstart.md`

- [ ] **Step 1: Write failing rehearsal wording tests**

In `packages/cli/src/run.test.ts`, update the existing sync test or add:

```ts
it("labels sync as local rehearsal state", async () => {
  const code = await runAgentstack(["sync", "--env", "preview", "--apply"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output).toContain("APPLIED local rehearsal preview");
  expect(output).toContain("Scope: ignored .agentstack state only; no live provider mutation");
});
```

- [ ] **Step 2: Run the rehearsal test to verify it fails**

Run:

```sh
corepack pnpm exec vitest run packages/cli/src/run.test.ts -t "local rehearsal"
```

Expected: FAIL because sync currently prints `APPLIED preview` without a clear local-only scope line.

- [ ] **Step 3: Update sync output**

In `syncCommand`, replace:

```ts
io.write(`${plan.applied ? "APPLIED" : "PLAN"} ${plan.environment}`);
io.write("Evidence: local-rehearsal");
```

with:

```ts
io.write(`${plan.applied ? "APPLIED" : "PLAN"} local rehearsal ${plan.environment}`);
io.write("Scope: ignored .agentstack state only; no live provider mutation");
io.write("Evidence: local-rehearsal");
```

- [ ] **Step 4: Update generated guidance**

In both generated `AGENTS.md` mirrors, add:

```md
`pnpm run preview:sync` updates local rehearsal state only. Use `pnpm run preview:up -- --confirm-live-mutation` for the live preview provider path.
```

- [ ] **Step 5: Update local quickstart**

In `docs/references/local-quickstart.md`, add a short section:

```md
## Local Rehearsal Versus Live Preview

`pnpm run preview:sync` only updates ignored `.agentstack/` rehearsal state. It is useful for local diagnostics, but it does not create or mutate Clerk, Convex, Vercel, or EAS resources.

Use `pnpm run preview:up -- --confirm-live-mutation` when the goal is the live provider-backed preview path.
```

- [ ] **Step 6: Run focused verification**

Run:

```sh
corepack pnpm exec vitest run packages/cli/src/run.test.ts -t "local rehearsal|sync"
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit**

```sh
git add packages/cli/src/run.ts packages/cli/src/run.test.ts templates/b2b-saas/AGENTS.md packages/agentstack/templates/b2b-saas/AGENTS.md docs/references/local-quickstart.md
git commit -m "fix: label local provider rehearsal clearly"
```

## Task 6: Add `agentstack preview up` As The Live Preview Happy Path

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`
- Modify: `templates/b2b-saas/package.json`
- Modify: `packages/agentstack/templates/b2b-saas/package.json`
- Modify: `tests/e2e/prototype.test.ts`

- [ ] **Step 1: Write failing preview-up help test**

In `packages/cli/src/run.test.ts`, add:

```ts
it("prints preview up help", async () => {
  const code = await runAgentstack(["preview", "up", "--help"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output.join("\n")).toContain("Usage: agentstack preview up --env preview [--confirm-live-mutation]");
  expect(output.join("\n")).toContain("Runs provider bootstrap, provider link, auth fixture, and preview deploy");
});
```

- [ ] **Step 2: Write failing preview-up confirmation test**

In `packages/cli/src/run.test.ts`, add:

```ts
it("requires explicit live mutation confirmation for preview up", async () => {
  const code = await runAgentstack(["preview", "up", "--env", "preview"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(1);
  expect(output.join("\n")).toContain("FAIL preview.up.confirmation-required");
  expect(output.join("\n")).toContain("Fix: Run agentstack preview up --env preview --confirm-live-mutation.");
});
```

- [ ] **Step 3: Write failing preview-up orchestration test**

Add a test that injects a provider executor and verifies ordered command sections. Use the existing fake provider patterns from M2 tests in `packages/cli/src/run.test.ts`.

The expected output order:

```text
STEP preview.up provider bootstrap
PASS provider bootstrap preview
STEP preview.up provider link
PASS provider link preview
STEP preview.up auth user
PASS auth user preview
STEP preview.up deploy
PASS deploy preview
Next commands:
- pnpm run preview:smoke
- pnpm run evidence:check
```

- [ ] **Step 4: Run preview-up tests to verify they fail**

Run:

```sh
corepack pnpm exec vitest run packages/cli/src/run.test.ts -t "preview up"
```

Expected: FAIL because `preview up` does not exist.

- [ ] **Step 5: Add dispatcher and usage**

In `runAgentstack`, add before deploy:

```ts
if (command === "preview" && subcommand === "up") {
  return await previewUpCommand(rest, io);
}

if (command === "preview" && (isHelpArg(subcommand) || subcommand === undefined)) {
  writePreviewUsage(io);
  return 0;
}
```

Add:

```ts
function writePreviewUsage(io: RunIo): void {
  io.write("Usage: agentstack preview <command> [options]");
  io.write("");
  io.write("Commands:");
  io.write("  up      Run the live preview happy path");
}

function writePreviewUpUsage(io: RunIo): void {
  io.write("Usage: agentstack preview up --env preview [--confirm-live-mutation]");
  io.write("");
  io.write("Runs provider bootstrap, provider link, auth fixture, and preview deploy.");
}
```

- [ ] **Step 6: Implement confirmation gate**

Add:

```ts
async function previewUpCommand(argv: string[], io: RunIo): Promise<number> {
  if (argv.some(isHelpArg)) {
    writePreviewUpUsage(io);
    return 0;
  }

  const options = parseOptions(argv);
  const environment = readEnvironmentOption(options.env, {
    flag: "env",
    fix: "Run agentstack preview up --env preview --confirm-live-mutation."
  });

  if (environment !== "preview") {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "preview.up.environment.unsupported",
        path: environment,
        message: "Preview up only supports the preview environment.",
        fix: "Run agentstack preview up --env preview --confirm-live-mutation.",
        blocks: ["preview.up"]
      })
    );
    return 1;
  }

  if (!options["confirm-live-mutation"]) {
    io.write(
      formatDiagnostic({
        severity: "fail",
        code: "preview.up.confirmation-required",
        path: "preview",
        message: "Preview up mutates live Clerk, Convex, and Vercel resources.",
        fix: "Run agentstack preview up --env preview --confirm-live-mutation.",
        blocks: ["preview.up"]
      })
    );
    return 1;
  }

  return await runPreviewUpSteps(io);
}
```

- [ ] **Step 7: Implement ordered orchestration**

Add:

```ts
async function runPreviewUpSteps(io: RunIo): Promise<number> {
  const steps: Array<{ label: string; run: () => Promise<number> }> = [
    {
      label: "provider bootstrap",
      run: () => m2ProviderBootstrapCommand(["--env", "preview", "--confirm-live-mutation"], io)
    },
    {
      label: "provider link",
      run: async () => (await m2ProviderLinkCommand(["--env", "preview"], io)) ?? providerLinkCommand(["--env", "preview"], io)
    },
    {
      label: "auth user",
      run: () => m2AuthUserCommand(["ensure", "--env", "preview", "--confirm-live-mutation"], io)
    },
    {
      label: "deploy",
      run: () => m2DeployPreviewLiveCommand(["--env", "preview", "--confirm-live-mutation"], io)
    }
  ];

  for (const step of steps) {
    io.write(`STEP preview.up ${step.label}`);
    const code = await step.run();
    if (code !== 0) {
      io.write(`FAIL preview.up ${step.label}`);
      return code;
    }
  }

  writeNextCommands(io, ["pnpm run preview:smoke", "pnpm run evidence:check"]);
  return 0;
}
```

If an existing M2 command expects slightly different argv, adjust only the wrapper arguments and keep this order.

- [ ] **Step 8: Update generated script**

Both template package files should already include:

```json
"preview:up": "agentstack preview up --env preview"
```

Keep confirmation outside the script so humans and agents must pass:

```sh
pnpm run preview:up -- --confirm-live-mutation
```

- [ ] **Step 9: Run focused verification**

Run:

```sh
corepack pnpm exec vitest run packages/cli/src/run.test.ts -t "preview up|M2 provider bootstrap|M2 smoke|M2 evidence"
corepack pnpm exec vitest run tests/e2e/prototype.test.ts
```

Expected: all commands exit 0.

- [ ] **Step 10: Commit**

```sh
git add packages/cli/src/run.ts packages/cli/src/run.test.ts templates/b2b-saas/package.json packages/agentstack/templates/b2b-saas/package.json tests/e2e/prototype.test.ts
git commit -m "feat: add preview happy path command"
```

## Task 7: Update Docs And Remove Split-Entrypoint Guidance

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/references/local-quickstart.md`
- Modify: `docs/validation-hypothesis.md`
- Modify: `docs/milestones/M2-agent-completes-m1.md`
- Modify: `AGENTS.md`
- Modify: `docs/spinup-site/**` only if those static docs are still treated as current.

- [ ] **Step 1: Replace direct `create-agent-stack` local quickstart guidance**

In `docs/references/local-quickstart.md`, the primary check should be:

```sh
which agentstack
realpath "$(which agentstack)"
agentstack --help
```

Expected:

```text
<node-bin>/agentstack
<agentstack-repo>/packages/agentstack/src/bin.js
```

Remove instructions that call `create-agent-stack`.

- [ ] **Step 2: Update README package map**

Change the package map from:

```text
packages/create-agent-stack  Lean app generator and B2B SaaS template
```

to:

```text
packages/agentstack       Public package, CLI entrypoint, typed config export, and app generator
packages/cli              Package-owned command implementation
```

- [ ] **Step 3: Update validation hypothesis**

Add this explicit product contract:

```md
The public command surface is `agentstack`. App creation is `agentstack create`; `create-agent-stack` is not a supported consumer entrypoint.
```

- [ ] **Step 4: Update generated-app docs references**

Replace old template mirror checks:

```sh
diff -rq templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

with:

```sh
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
```

- [ ] **Step 5: Run markdown link and text checks**

Run:

```sh
rg -n "create-agent-stack|packages/create-agent-stack" README.md AGENTS.md docs packages tests
```

Expected: matches remain only in historical evidence or archived superpowers plans. Current docs, active milestone cards, package metadata, generated templates, and tests must not instruct users to run `create-agent-stack`.

Run:

```sh
node --input-type=module <<'NODE'
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.md'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const failures = [];
const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(linkPattern)) {
    let target = match[1].trim();
    if (!target || target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:') || target.startsWith('#')) continue;
    target = target.replace(/^<|>$/g, '').split('#')[0];
    if (!target) continue;
    const path = resolve(dirname(file), target);
    if (!existsSync(path)) failures.push(`${file}: missing link ${match[1]}`);
  }
}
if (failures.length) {
  console.log(failures.join('\n'));
  process.exit(1);
}
console.log(`checked ${files.length} markdown files`);
NODE
```

Expected: link checker exits 0.

- [ ] **Step 6: Commit**

```sh
git add README.md AGENTS.md docs
git commit -m "docs: document single agentstack happy path"
```

## Task 8: End-To-End Scratch Validation

**Files:**
- Test only; no source files should change.

- [ ] **Step 1: Remove any stale local `create-agent-stack` symlink**

Run:

```sh
if command -v create-agent-stack >/dev/null 2>&1; then
  rm "$(command -v create-agent-stack)"
  hash -r
fi
```

Expected: `create-agent-stack` is no longer a PATH-visible command from this local checkout.

- [ ] **Step 2: Verify the local binary points at the single package**

Run:

```sh
which agentstack
realpath "$(which agentstack)"
agentstack --help
```

Expected:

```text
<node-bin>/agentstack
<agentstack-repo>/packages/agentstack/src/bin.js
```

`agentstack --help` must show `create`, `dev`, `preview`, `sync`, `env`, `provider`, `auth`, `billing`, `smoke`, and `evidence`.

- [ ] **Step 3: Generate a fresh local consumer app**

Run:

```sh
rm -rf /tmp/agentstack-happy-path-smoke
mkdir -p /tmp/agentstack-happy-path-smoke
cd /tmp/agentstack-happy-path-smoke
agentstack create qs-happy --package-spec link:<agentstack-repo>/packages/agentstack
cd qs-happy
```

Expected:

```text
Created qs-happy
```

- [ ] **Step 4: Install and validate**

Run:

```sh
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm install
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm run validate
```

Expected:

```text
Scope: all 4 workspace projects
PASS validate
```

There must be no unsupported-workspaces warning.

- [ ] **Step 5: Verify diagnostics-only dev check**

Run:

```sh
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm run dev:check
```

Expected:

```text
PASS dev preflight development web
Next commands:
- pnpm run validate
- pnpm run dev
```

The output must not suggest missing `preview:apply`, missing `env:inspect`, or EAS as a blocker for local web dev.

- [ ] **Step 6: Verify `pnpm run dev` starts Vite**

Run in the background and stop it after it has had time to print Vite readiness:

```sh
rm -f /tmp/agentstack-happy-path-dev.log
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm run dev > /tmp/agentstack-happy-path-dev.log 2>&1 &
dev_pid=$!
sleep 8
kill "$dev_pid"
wait "$dev_pid" || true
cat /tmp/agentstack-happy-path-dev.log
```

Expected: the dev log includes Vite readiness:

```text
VITE
Local:
```

- [ ] **Step 7: Verify live preview confirmation gate**

Run:

```sh
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack pnpm run preview:up
```

Expected:

```text
FAIL preview.up.confirmation-required
Fix: Run agentstack preview up --env preview --confirm-live-mutation.
```

- [ ] **Step 8: Run framework verification**

From `<agentstack-repo>`, run:

```sh
corepack pnpm format:check
corepack pnpm typecheck
corepack pnpm test
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 9: Final commit**

If any small verification-only docs or tests changed after prior commits:

```sh
git status --short
git add <changed-files>
git commit -m "test: verify agentstack happy path"
```

If no files changed, do not create an empty commit.

## Acceptance Criteria

- `agentstack` is the only supported public consumer CLI entrypoint.
- No current README, active docs, generated template guidance, or e2e test instructs consumers to run `create-agent-stack`.
- A generated app has a `pnpm run dev` command that starts the local web app.
- A generated app has `pnpm run dev:check` for diagnostics-only preflight.
- `agentstack --help` and command-specific help list the commands diagnostics recommend.
- `agentstack sync --help` and `agentstack env --help` return exit 0 without requiring unrelated options.
- Every `pnpm run ...` command emitted in `Next commands:` exists in the generated root `package.json`.
- Local rehearsal output says it is `.agentstack` local state only and not live provider mutation.
- `pnpm run preview:up -- --confirm-live-mutation` is the live preview happy path wrapper.
- Provider auth/browser handoffs remain allowed, but the command must print the exact action and exact resume command.
- Full verification passes: focused tests, `pnpm typecheck`, `pnpm test`, template mirror diff, generated scratch install, generated scratch validate, and generated scratch dev startup.

## Self-Review Notes

- The plan covers all five findings: stale next commands, dev semantics, split help, rehearsal/live ambiguity, and surface-scoped diagnostics.
- The plan also covers the new user requirement: remove `create-agent-stack` as a supported public entrypoint.
- M4 packaging remains out of scope. The local `--package-spec link:/...` path remains the scratch validation mechanism.
- Billing remains a repeatable capability through existing `billing:*` scripts. A separate `billing:up` happy path can be considered after this remediation lands and the preview happy path is stable.
