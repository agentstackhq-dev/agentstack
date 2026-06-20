# Agentstack Theme UI Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mechanically validated theme contract and generated unstyled UI primitive foundation so coding agents can style web and mobile through shared tokens without hardcoded one-off UI islands.

**Architecture:** Core owns the token contract and diagnostics. CLI reads `packages/theme/tokens.json`, exposes `agentstack theme validate`, and includes theme diagnostics in the normal local validation gate. Templates generate a theme package, token JSON, typed theme exports, UI primitive metadata, scripts, and docs that tell agents how to stay inside the contract.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, Agentstack CLI/core packages, generated B2B SaaS template.

---

## File Structure

- Create `packages/core/src/theme.ts`: token schema, required token groups, and `validateThemeTokens`.
- Create `packages/core/src/theme.test.ts`: red/green tests for valid tokens, missing tokens, invalid token types, and malformed object shape.
- Modify `packages/core/src/index.ts`: export theme helpers.
- Modify `packages/core/src/validation.ts`: add `packages/theme/package.json` and `packages/theme/tokens.json` as required generated anchors.
- Modify `packages/cli/src/run.ts`: add `agentstack theme validate`, load token JSON, format diagnostics, include theme diagnostics in `validate` and `deploy` gates.
- Modify `packages/cli/src/run.test.ts`: add CLI tests for `theme validate`, missing/invalid token diagnostics, and local validation blocking.
- Create `templates/b2b-saas/packages/theme/package.json`: generated workspace package.
- Create `templates/b2b-saas/packages/theme/tokens.json`: structured token source of truth.
- Modify `templates/b2b-saas/packages/theme/src/index.ts`: typed `themeTokens`, token role paths, and helper for agents.
- Modify `templates/b2b-saas/packages/ui/src/index.ts`: unstyled primitive registry and state helpers using theme token roles rather than literal colors.
- Modify `templates/b2b-saas/packages/ui/package.json`: depend on `@app/theme`.
- Mirror every template change into `packages/create-agent-stack/templates/b2b-saas/...`.
- Modify `templates/b2b-saas/agentstack.config.json` and package-local mirror: add new theme anchors.
- Modify `templates/b2b-saas/package.json` and package-local mirror: add `theme:validate` script.
- Modify `templates/b2b-saas/AGENTS.md` and docs under `docs/agentstack/`: document the workflow.
- Modify `packages/create-agent-stack/src/generate.test.ts`: assert new anchors, scripts, docs, and generated theme/UI content.
- Modify `tests/e2e/prototype.test.ts`: include `theme validate` in the end-to-end workflow.

## Task 1: Core Theme Contract

**Files:**
- Create: `packages/core/src/theme.ts`
- Create: `packages/core/src/theme.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/validation.ts`

- [ ] **Step 1: Write failing core tests**

Add tests that describe the desired contract before implementation:

```ts
import { describe, expect, it } from "vitest";
import { defaultThemeTokens, validateThemeTokens } from "./theme.js";

describe("validateThemeTokens", () => {
  it("accepts the default Agentstack theme token contract", () => {
    expect(validateThemeTokens(defaultThemeTokens)).toEqual([]);
  });

  it("reports missing required token paths with deploy-blocking diagnostics", () => {
    const tokens = structuredClone(defaultThemeTokens) as Record<string, unknown>;
    delete (tokens.colors as Record<string, unknown>).focusRing;

    const diagnostics = validateThemeTokens(tokens);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "fail",
        code: "theme.tokens.missing",
        path: "packages/theme/tokens.json:colors.focusRing",
        blocks: ["validate", "validate --cloud", "deploy"]
      })
    ]);
  });

  it("reports invalid token value types", () => {
    const tokens = structuredClone(defaultThemeTokens) as Record<string, unknown>;
    (tokens.spacing as Record<string, unknown>).md = "16px";

    const diagnostics = validateThemeTokens(tokens);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: "fail",
        code: "theme.tokens.invalid",
        path: "packages/theme/tokens.json:spacing.md"
      })
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
pnpm vitest run packages/core/src/theme.test.ts
```

Expected: fail because `./theme.js` does not exist.

- [ ] **Step 3: Implement theme contract**

Create `packages/core/src/theme.ts` with:

```ts
import type { Diagnostic } from "./diagnostics.js";

export type ThemeTokens = {
  colors: {
    background: string;
    foreground: string;
    surface: string;
    muted: string;
    accent: string;
    danger: string;
    success: string;
    focusRing: string;
  };
  typography: {
    fontFamily: string;
    fontSize: { sm: number; md: number; lg: number };
    lineHeight: { tight: number; normal: number; relaxed: number };
  };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  radius: { sm: number; md: number; lg: number };
  shadow: { sm: string; md: string; lg: string };
  motion: { durationFast: number; durationNormal: number; easingStandard: string };
  density: { controlHeight: number; listItemHeight: number };
};

export const defaultThemeTokens: ThemeTokens = {
  colors: {
    background: "#ffffff",
    foreground: "#111827",
    surface: "#f8fafc",
    muted: "#64748b",
    accent: "#2563eb",
    danger: "#dc2626",
    success: "#16a34a",
    focusRing: "#38bdf8"
  },
  typography: {
    fontFamily: "Inter, system-ui, sans-serif",
    fontSize: { sm: 14, md: 16, lg: 20 },
    lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.7 }
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 4, md: 8, lg: 12 },
  shadow: {
    sm: "0 1px 2px rgb(15 23 42 / 0.08)",
    md: "0 8px 24px rgb(15 23 42 / 0.10)",
    lg: "0 18px 40px rgb(15 23 42 / 0.14)"
  },
  motion: { durationFast: 120, durationNormal: 180, easingStandard: "cubic-bezier(0.2, 0, 0, 1)" },
  density: { controlHeight: 40, listItemHeight: 48 }
};
```

Add required path/type checks through a small recursive validator that returns `theme.tokens.missing` and `theme.tokens.invalid` diagnostics using `packages/theme/tokens.json:<path>`.

- [ ] **Step 4: Export and anchor theme files**

Add to `packages/core/src/index.ts`:

```ts
export * from "./theme.js";
```

Add required anchors in `packages/core/src/validation.ts`:

```ts
"packages/theme/package.json",
"packages/theme/tokens.json",
"packages/theme/src/index.ts"
```

- [ ] **Step 5: Run core tests to verify GREEN**

Run:

```bash
pnpm vitest run packages/core/src/theme.test.ts packages/core/src/validation.test.ts
```

Expected: all selected tests pass.

## Task 2: CLI Theme Validation Gate

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Add tests for the user-facing command and local gate:

```ts
it("validates the generated theme token contract", async () => {
  const code = await runAgentstack(["theme", "validate"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(0);
  expect(output).toContain("PASS theme validate");
});

it("fails theme validation when a required token is missing", async () => {
  const tokens = JSON.parse(await readFile(join(dir, "packages/theme/tokens.json"), "utf8"));
  delete tokens.colors.focusRing;
  await writeFile(join(dir, "packages/theme/tokens.json"), `${JSON.stringify(tokens, null, 2)}\n`);

  const code = await runAgentstack(["theme", "validate"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(1);
  expect(output.join("\n")).toContain("FAIL theme.tokens.missing");
  expect(output.join("\n")).toContain("Path: packages/theme/tokens.json:colors.focusRing");
});

it("includes theme diagnostics in local validation", async () => {
  const tokens = JSON.parse(await readFile(join(dir, "packages/theme/tokens.json"), "utf8"));
  tokens.spacing.md = "16px";
  await writeFile(join(dir, "packages/theme/tokens.json"), `${JSON.stringify(tokens, null, 2)}\n`);

  const code = await runAgentstack(["validate"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(1);
  expect(output.join("\n")).toContain("FAIL theme.tokens.invalid");
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "theme"
```

Expected: fail because command routing and token files are not implemented yet.

- [ ] **Step 3: Implement CLI command and gate**

In `runAgentstack`, route:

```ts
if (command === "theme" && subcommand === "validate") {
  return await themeValidateCommand(io);
}
```

Add helper functions:

```ts
async function themeValidateCommand(io: RunIo): Promise<number> {
  const diagnostics = await findThemeDiagnostics(io.cwd);
  diagnostics.forEach((diagnostic) => io.write(formatDiagnostic(diagnostic)));
  if (diagnostics.some((diagnostic) => diagnostic.severity === "fail")) {
    return 1;
  }
  io.write("PASS theme validate");
  await recordCommandEvent(io, {
    name: "agentstack.theme.validate.completed",
    environment: "development",
    journey: "theming",
    command: "theme validate",
    status: "ok",
    state: { diagnostics: diagnostics.length }
  });
  return 0;
}
```

`findThemeDiagnostics(cwd)` must read `packages/theme/tokens.json`, parse JSON, map invalid JSON to `theme.tokens.invalid-json`, and call `validateThemeTokens`.

Update `runLocalValidationGate` to include `themeDiagnostics` in `diagnostics` and fail when theme diagnostics contain a fail.

- [ ] **Step 4: Run CLI tests to verify GREEN**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts -t "theme|validates a local project|blocks deploy"
```

Expected: selected tests pass.

## Task 3: Generated Theme and UI Template

**Files:**
- Create: `templates/b2b-saas/packages/theme/package.json`
- Create: `templates/b2b-saas/packages/theme/tokens.json`
- Modify: `templates/b2b-saas/packages/theme/src/index.ts`
- Modify: `templates/b2b-saas/packages/ui/package.json`
- Modify: `templates/b2b-saas/packages/ui/src/index.ts`
- Mirror: same paths under `packages/create-agent-stack/templates/b2b-saas/`
- Modify: both `agentstack.config.json` files
- Modify: both root `package.json` files

- [ ] **Step 1: Write failing generation assertions**

Update `packages/create-agent-stack/src/generate.test.ts` to expect:

```ts
expect(packageManifest.scripts).toMatchObject({
  "theme:validate": "node scripts/agentstack.mjs theme validate"
});
await expect(readFile(join(targetDir, "packages/theme/tokens.json"), "utf8")).resolves.toContain(
  '"focusRing"'
);
await expect(readFile(join(targetDir, "packages/theme/package.json"), "utf8")).resolves.toContain(
  "@app/theme"
);
await expect(readFile(join(targetDir, "packages/ui/src/index.ts"), "utf8")).resolves.toContain(
  "uiPrimitives"
);
```

Add `packages/theme/package.json` and `packages/theme/tokens.json` to the generated anchor file list.

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generates a B2B SaaS project"
```

Expected: fail because generated theme package/token files and script are absent.

- [ ] **Step 3: Add generated theme package and tokens**

Create `packages/theme/package.json` in both template roots:

```json
{
  "name": "@app/theme",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

Create `packages/theme/tokens.json` in both template roots using the same token structure as `defaultThemeTokens`.

Update `packages/theme/src/index.ts` to export the token object, role paths, and helper types:

```ts
export type TokenRole =
  | "colors.background"
  | "colors.foreground"
  | "colors.surface"
  | "colors.muted"
  | "colors.accent"
  | "colors.danger"
  | "colors.success"
  | "colors.focusRing";

export const themeTokens = { ... } as const;
export type ThemeTokens = typeof themeTokens;
export const tokenRoles = { ... } as const;
```

- [ ] **Step 4: Add generated UI primitive registry**

Update both `packages/ui/src/index.ts` files:

```ts
import type { TokenRole } from "@app/theme";

export type UiPrimitiveName =
  | "authGate"
  | "orgSwitcher"
  | "userMenu"
  | "planGate"
  | "settingsSection"
  | "dataTable"
  | "form"
  | "modal"
  | "emptyState"
  | "loadingState"
  | "errorState"
  | "commandSearch"
  | "mobileList"
  | "navigationShell";

export type UiPrimitiveState = "idle" | "loading" | "empty" | "error" | "disabled" | "selected";

export type UiPrimitiveDefinition = {
  name: UiPrimitiveName;
  requiredStates: UiPrimitiveState[];
  surfaceRoles: {
    background: TokenRole;
    foreground: TokenRole;
    focusRing: TokenRole;
  };
};

export const uiPrimitives = { ... } satisfies Record<UiPrimitiveName, UiPrimitiveDefinition>;
```

The generated file must not contain raw hex colors. Token roles carry styling intent.

- [ ] **Step 5: Update generated scripts and anchors**

Add script to both template root `package.json` files:

```json
"theme:validate": "node scripts/agentstack.mjs theme validate"
```

Add `packages/theme/package.json` and `packages/theme/tokens.json` to both `agentstack.config.json` generated anchor arrays.

- [ ] **Step 6: Run generation tests to verify GREEN**

Run:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
```

Expected: all generation tests pass and template mirror remains identical.

## Task 4: Docs and E2E Workflow

**Files:**
- Modify: `templates/b2b-saas/AGENTS.md`
- Modify: `templates/b2b-saas/docs/agentstack/theming.md`
- Modify: `templates/b2b-saas/docs/agentstack/validation.md`
- Modify: `templates/b2b-saas/docs/agentstack/generated-boundaries.md`
- Mirror: same docs under `packages/create-agent-stack/templates/b2b-saas/`
- Modify: `tests/e2e/prototype.test.ts`

- [ ] **Step 1: Write failing E2E expectation**

Add to `tests/e2e/prototype.test.ts` after project generation:

```ts
expect(await runAgentstack(["theme", "validate"], { cwd: appDir, write })).toBe(0);
```

Add output assertion:

```ts
expect(renderedOutput).toContain("PASS theme validate");
```

- [ ] **Step 2: Run E2E test to verify RED or integration failure**

Run:

```bash
pnpm vitest run tests/e2e/prototype.test.ts
```

Expected before implementation: fail if the CLI command/template files are absent. If previous tasks are already integrated, this may pass and should be treated as the integration GREEN check.

- [ ] **Step 3: Update docs**

Update generated `AGENTS.md` to include:

```md
- Validate theme changes with `pnpm run theme:validate`; normal `pnpm run validate` also checks token shape.
- Style UI through `@app/theme` token roles and `@app/ui` primitives before adding surface-specific components.
```

Update `docs/agentstack/theming.md` to describe:

```md
# Theming

`packages/theme/tokens.json` is the structured source of truth for generated token validation.
`packages/theme/src/index.ts` is the typed app-facing mirror agents import from code.
Run `pnpm run theme:validate` after changing tokens.

UI should start from `@app/ui` primitive definitions. These primitives are unstyled: they encode required states, accessibility expectations, and token roles, while web and mobile choose platform-native rendering.
```

Update validation/generated-boundaries docs to mention theme diagnostics and anchor protection.

- [ ] **Step 4: Run E2E and template mirror verification**

Run:

```bash
pnpm vitest run tests/e2e/prototype.test.ts
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

Expected: E2E passes and diff exits clean.

## Final Verification

- [ ] Run `pnpm install --frozen-lockfile`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas`.
- [ ] Run the spin-up link checker if spin-up pages changed.
- [ ] Run `git diff --check`.
- [ ] Commit with message `feat: add theme validation and ui foundations`.

## Self-Review

- Spec coverage: this plan covers the theme contract, generated unstyled UI primitive foundation, agent command validation, normal validation integration, docs, and e2e workflow. It does not implement full React/React Native components, visual contrast auditing, or `agentstack theme init`; those remain later slices.
- Placeholder scan: no `TBD`, `TODO`, or deferred implementation placeholders are used.
- Type consistency: command names, diagnostic codes, token paths, and package paths match across tasks.
