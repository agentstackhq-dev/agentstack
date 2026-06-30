# Agentstack Convex API Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generated Agentstack apps should typecheck Convex code cleanly, consume the typed generated Convex API from web, and keep `_generated` API files fresh through package-owned Agentstack commands.

**Architecture:** First land the generated Convex TypeScript baseline (`@types/node`, `apps/convex/tsconfig.json`, and the webhook byte typing fix). Then expose Convex generated API through `@app/convex/api`, remove direct `anyApi` usage from generated web code, add validation/source-policy checks, and wire `agentstack convex codegen` into `validate`, `dev --surface web`, and `preview up` with explicit local/provider mutation output.

**Tech Stack:** TypeScript, pnpm workspaces, Convex CLI `codegen`, Vite, Vitest, Agentstack CLI/core/template packages.

---

## File Map

- Modify `packages/agentstack/templates/b2b-saas/package.json`: add `@types/node` and `convex:codegen`.
- Modify `templates/b2b-saas/package.json`: mirror the generated root package changes.
- Create `packages/agentstack/templates/b2b-saas/apps/convex/tsconfig.json`: Convex TypeScript config.
- Create `templates/b2b-saas/apps/convex/tsconfig.json`: mirror Convex TypeScript config.
- Modify `packages/agentstack/templates/b2b-saas/apps/convex/convex/http.ts`: `decodeSecret` returns `Uint8Array<ArrayBuffer>`.
- Modify `templates/b2b-saas/apps/convex/convex/http.ts`: mirror webhook typing fix.
- Modify `packages/agentstack/templates/b2b-saas/apps/convex/package.json`: export `./api`.
- Modify `templates/b2b-saas/apps/convex/package.json`: mirror Convex package export.
- Modify `packages/agentstack/templates/b2b-saas/apps/web/package.json`: add `@app/convex` workspace dependency.
- Modify `templates/b2b-saas/apps/web/package.json`: mirror web package dependency.
- Modify `packages/agentstack/templates/b2b-saas/apps/web/src/App.tsx`: import `api` from `@app/convex/api`, remove manual query casts.
- Modify `templates/b2b-saas/apps/web/src/App.tsx`: mirror web code.
- Create `packages/agentstack/templates/b2b-saas/apps/convex/convex/_generated/*`: generated Convex API files.
- Create `templates/b2b-saas/apps/convex/convex/_generated/*`: mirror generated Convex API files.
- Modify `packages/agentstack/templates/b2b-saas/AGENTS.md`: mention typed Convex API sync.
- Modify `templates/b2b-saas/AGENTS.md`: mirror generated guidance.
- Modify `packages/agentstack/src/create/generate.test.ts`: template/generator assertions.
- Modify `packages/core/src/validation.ts`: add required generated anchors for Convex tsconfig and `_generated`.
- Modify `packages/core/src/validation.test.ts`: anchor coverage tests.
- Modify `packages/cli/src/run.ts`: add `convex codegen`, source-policy diagnostics, and preflight hooks.
- Modify `packages/cli/src/run.test.ts`: CLI command/preflight/source-policy tests.

## Task 1: Convex TypeScript Quick Pass

**Files:**
- Modify: `packages/agentstack/src/create/generate.test.ts`
- Modify: `packages/agentstack/templates/b2b-saas/package.json`
- Modify: `templates/b2b-saas/package.json`
- Create: `packages/agentstack/templates/b2b-saas/apps/convex/tsconfig.json`
- Create: `templates/b2b-saas/apps/convex/tsconfig.json`
- Modify: `packages/agentstack/templates/b2b-saas/apps/convex/convex/http.ts`
- Modify: `templates/b2b-saas/apps/convex/convex/http.ts`

- [ ] **Step 1: Add failing generator assertions for Convex TypeScript baseline**

In `packages/agentstack/src/create/generate.test.ts`, update the `"generates the M2 lean package-driven app surface"` test after it reads `packageManifest` to assert `@types/node`, and include `apps/convex/tsconfig.json` in the generated file list:

```ts
expect(files).toEqual(
  expect.arrayContaining([
    "AGENTS.md",
    ".gitignore",
    "package.json",
    "pnpm-workspace.yaml",
    "agentstack.config.ts",
    "apps/web/package.json",
    "apps/mobile/package.json",
    "apps/convex/package.json",
    "apps/convex/tsconfig.json",
    "apps/convex/convex/billing.ts",
    "apps/convex/convex/http.ts"
  ])
);

expect(packageManifest.devDependencies).toMatchObject({
  "@types/node": "^26.0.1",
  typescript: "^5.7.3"
});
```

In the `"replaces app tokens in config and self-contained app code"` test, add:

```ts
const convexTsconfig = JSON.parse(await readFile(join(targetDir, "apps/convex/tsconfig.json"), "utf8"));
expect(convexTsconfig.compilerOptions.types).toEqual(["node"]);
expect(convexTsconfig.include).toEqual(["convex/**/*.ts"]);

const convexHttp = await readFile(join(targetDir, "apps/convex/convex/http.ts"), "utf8");
expect(convexHttp).toContain("function decodeSecret(secret: string): Uint8Array<ArrayBuffer>");
expect(convexHttp).toContain("return new Uint8Array(Array.from(atob(encoded), (char) => char.charCodeAt(0)));");
```

- [ ] **Step 2: Run the focused generator test and verify it fails**

Run:

```sh
corepack pnpm vitest run packages/agentstack/src/create/generate.test.ts
```

Expected: FAIL because `@types/node` and `apps/convex/tsconfig.json` are not in the template yet, and `decodeSecret` still returns plain `Uint8Array`.

- [ ] **Step 3: Update generated root package templates**

In both `packages/agentstack/templates/b2b-saas/package.json` and `templates/b2b-saas/package.json`, add `@types/node` to `devDependencies`:

```json
"devDependencies": {
  "@types/node": "^26.0.1",
  "clerk": "^1.5.0",
  "convex": "^1.41.0",
  "eas-cli": "^20.3.0",
  "typescript": "^5.7.3",
  "vercel": "^54.14.5"
}
```

Do not add framework internals or copied scripts.

- [ ] **Step 4: Add Convex tsconfig to both template mirrors**

Create `packages/agentstack/templates/b2b-saas/apps/convex/tsconfig.json` and `templates/b2b-saas/apps/convex/tsconfig.json` with exactly:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["convex/**/*.ts"]
}
```

- [ ] **Step 5: Fix webhook Web Crypto byte typing in both template mirrors**

In both template copies of `apps/convex/convex/http.ts`, replace `decodeSecret` with:

```ts
function decodeSecret(secret: string): Uint8Array<ArrayBuffer> {
  const prefixed = `${"whsec"}_`;
  const encoded = secret.startsWith(prefixed) ? secret.slice(prefixed.length) : secret;
  return new Uint8Array(Array.from(atob(encoded), (char) => char.charCodeAt(0)));
}
```

- [ ] **Step 6: Run focused tests and mirror check**

Run:

```sh
corepack pnpm vitest run packages/agentstack/src/create/generate.test.ts
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
```

Expected: PASS for the generator test and no output from `diff -rq`.

- [ ] **Step 7: Commit the quick pass**

Run:

```sh
git add packages/agentstack/src/create/generate.test.ts \
  packages/agentstack/templates/b2b-saas/package.json \
  templates/b2b-saas/package.json \
  packages/agentstack/templates/b2b-saas/apps/convex/tsconfig.json \
  templates/b2b-saas/apps/convex/tsconfig.json \
  packages/agentstack/templates/b2b-saas/apps/convex/convex/http.ts \
  templates/b2b-saas/apps/convex/convex/http.ts
git commit -m "fix: type generated convex surface"
```

## Task 2: Typed Generated API Template Boundary

**Files:**
- Modify: `packages/agentstack/src/create/generate.test.ts`
- Modify: `packages/agentstack/templates/b2b-saas/apps/convex/package.json`
- Modify: `templates/b2b-saas/apps/convex/package.json`
- Modify: `packages/agentstack/templates/b2b-saas/apps/web/package.json`
- Modify: `templates/b2b-saas/apps/web/package.json`
- Modify: `packages/agentstack/templates/b2b-saas/apps/web/src/App.tsx`
- Modify: `templates/b2b-saas/apps/web/src/App.tsx`
- Create: `packages/agentstack/templates/b2b-saas/apps/convex/convex/_generated/api.d.ts`
- Create: `packages/agentstack/templates/b2b-saas/apps/convex/convex/_generated/api.js`
- Create: `packages/agentstack/templates/b2b-saas/apps/convex/convex/_generated/dataModel.d.ts`
- Create: `packages/agentstack/templates/b2b-saas/apps/convex/convex/_generated/server.d.ts`
- Create: `packages/agentstack/templates/b2b-saas/apps/convex/convex/_generated/server.js`
- Create: matching files under `templates/b2b-saas/apps/convex/convex/_generated/`

- [ ] **Step 1: Replace old `anyApi` generator assertions with typed API assertions**

In `packages/agentstack/src/create/generate.test.ts`, replace:

```ts
expect(webApp).toContain("anyApi.workspaceStatus.protectedStatus");
expect(webApp).toContain("anyApi.billing.protectedEntitlementGate");
```

with:

```ts
expect(webApp).toContain('import { api } from "@app/convex/api";');
expect(webApp).toContain("api.workspaceStatus.protectedStatus");
expect(webApp).toContain("api.billing.protectedEntitlementGate");
expect(webApp).not.toContain("anyApi");
expect(webApp).not.toContain("convex/server");
expect(webApp).not.toContain("makeFunctionReference");
expect(webApp).not.toContain(" as ProtectedWorkspaceStatus");
expect(webApp).not.toContain(" as EntitlementGate");
```

Add package assertions in the first generator test after `webPackageManifest` is read:

```ts
const convexPackageManifest = JSON.parse(await readFile(join(targetDir, "apps/convex/package.json"), "utf8"));

expect(webPackageManifest.dependencies["@app/convex"]).toBe("workspace:*");
expect(convexPackageManifest.exports).toEqual({
  "./api": {
    types: "./convex/_generated/api.d.ts",
    default: "./convex/_generated/api.js"
  }
});
expect(files).toEqual(
  expect.arrayContaining([
    "apps/convex/convex/_generated/api.d.ts",
    "apps/convex/convex/_generated/api.js",
    "apps/convex/convex/_generated/dataModel.d.ts",
    "apps/convex/convex/_generated/server.d.ts",
    "apps/convex/convex/_generated/server.js"
  ])
);
```

- [ ] **Step 2: Run the focused generator test and verify it fails**

Run:

```sh
corepack pnpm vitest run packages/agentstack/src/create/generate.test.ts
```

Expected: FAIL because the template still imports `anyApi`, lacks `@app/convex`, lacks package exports, and lacks `_generated` files.

- [ ] **Step 3: Update Convex package exports in both template mirrors**

In both template copies of `apps/convex/package.json`, use:

```json
{
  "name": "@app/convex",
  "private": true,
  "type": "module",
  "exports": {
    "./api": {
      "types": "./convex/_generated/api.d.ts",
      "default": "./convex/_generated/api.js"
    }
  },
  "dependencies": {
    "convex": "^1.41.0"
  },
  "scripts": {
    "dev": "convex dev",
    "deploy": "convex deploy"
  }
}
```

- [ ] **Step 4: Add `@app/convex` dependency to web package templates**

In both template copies of `apps/web/package.json`, add:

```json
"@app/convex": "workspace:*"
```

The dependencies block should include:

```json
"dependencies": {
  "@app/convex": "workspace:*",
  "@clerk/react": "^6.10.4",
  "@vitejs/plugin-react": "^4.3.4",
  "convex": "^1.41.0",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "vite": "^6.0.7"
}
```

- [ ] **Step 5: Update generated web App in both template mirrors**

In both template copies of `apps/web/src/App.tsx`:

Replace:

```ts
import { anyApi } from "convex/server";
```

with:

```ts
import { api } from "@app/convex/api";
```

Delete the local `ProtectedWorkspaceStatus` and `EntitlementGate` type aliases.

Replace:

```ts
const protectedWorkspaceStatusQuery = anyApi.workspaceStatus.protectedStatus;
const protectedEntitlementGateQuery = anyApi.billing.protectedEntitlementGate;
```

with:

```ts
const protectedWorkspaceStatusQuery = api.workspaceStatus.protectedStatus;
const protectedEntitlementGateQuery = api.billing.protectedEntitlementGate;
```

Replace:

```ts
const protectedStatus = useQuery(protectedWorkspaceStatusQuery, {}) as ProtectedWorkspaceStatus | undefined;
const entitlementGate = useQuery(protectedEntitlementGateQuery, {}) as EntitlementGate | undefined;
```

with:

```ts
const protectedStatus = useQuery(protectedWorkspaceStatusQuery, {});
const entitlementGate = useQuery(protectedEntitlementGateQuery, {});
```

- [ ] **Step 6: Generate Convex `_generated` files from a fresh generated app**

Run from the framework repo:

```sh
tmpdir="$(mktemp -d)"
node_modules/.bin/tsx packages/agentstack/src/bin.ts create typed-api-smoke --package-spec link:<agentstack-repo>/packages/agentstack "$tmpdir/typed-api-smoke"
cd "$tmpdir/typed-api-smoke"
corepack pnpm install
corepack pnpm --filter @app/convex exec convex codegen --typecheck try
```

If the generator command shape rejects the target path argument, use the supported current local command from `README.md`:

```sh
tmpdir="$(mktemp -d)"
cd "$tmpdir"
<agentstack-repo>/node_modules/.bin/tsx \
  <agentstack-repo>/packages/agentstack/src/bin.ts \
  create typed-api-smoke \
  --package-spec link:<agentstack-repo>/packages/agentstack
cd typed-api-smoke
corepack pnpm install
corepack pnpm --filter @app/convex exec convex codegen --typecheck try
```

Expected: Convex writes `apps/convex/convex/_generated/*` and reports no deployment mutation.

- [ ] **Step 7: Copy generated Convex files into both template mirrors**

From the generated app root used in Step 6:

```sh
cp -R apps/convex/convex/_generated <agentstack-repo>/packages/agentstack/templates/b2b-saas/apps/convex/convex/
cp -R apps/convex/convex/_generated <agentstack-repo>/templates/b2b-saas/apps/convex/convex/
```

Check that generated files contain no app slug tokens:

```sh
rg "__APP_|typed-api-smoke|acme-crm" <agentstack-repo>/packages/agentstack/templates/b2b-saas/apps/convex/convex/_generated <agentstack-repo>/templates/b2b-saas/apps/convex/convex/_generated
```

Expected: no matches.

- [ ] **Step 8: Run focused generator test and mirror check**

Run:

```sh
cd <agentstack-repo>
corepack pnpm vitest run packages/agentstack/src/create/generate.test.ts
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
```

Expected: PASS and no mirror diff.

- [ ] **Step 9: Commit typed API template boundary**

Run:

```sh
git add packages/agentstack/src/create/generate.test.ts \
  packages/agentstack/templates/b2b-saas/apps/convex/package.json \
  templates/b2b-saas/apps/convex/package.json \
  packages/agentstack/templates/b2b-saas/apps/web/package.json \
  templates/b2b-saas/apps/web/package.json \
  packages/agentstack/templates/b2b-saas/apps/web/src/App.tsx \
  templates/b2b-saas/apps/web/src/App.tsx \
  packages/agentstack/templates/b2b-saas/apps/convex/convex/_generated \
  templates/b2b-saas/apps/convex/convex/_generated
git commit -m "fix: use generated convex api in template"
```

## Task 3: Generated Boundary And Source Policy Validation

**Files:**
- Modify: `packages/core/src/validation.ts`
- Modify: `packages/core/src/validation.test.ts`
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Add failing core anchor tests**

In `packages/core/src/validation.test.ts`, update the Convex anchor expectations to include:

```ts
expect(getRequiredGeneratedAnchors(manifest)).toEqual(
  expect.arrayContaining([
    "apps/convex/package.json",
    "apps/convex/tsconfig.json",
    "apps/convex/convex/schema.ts",
    "apps/convex/convex/auth.config.ts",
    "apps/convex/convex/workspaceStatus.ts",
    "apps/convex/convex/_generated/api.d.ts",
    "apps/convex/convex/_generated/api.js",
    "apps/convex/convex/_generated/dataModel.d.ts",
    "apps/convex/convex/_generated/server.d.ts",
    "apps/convex/convex/_generated/server.js"
  ])
);
```

Run:

```sh
corepack pnpm vitest run packages/core/src/validation.test.ts
```

Expected: FAIL until anchors are added.

- [ ] **Step 2: Add Convex generated anchors**

In `packages/core/src/validation.ts`, extend the Convex branch of `getRequiredGeneratedAnchors`:

```ts
if (manifest.surfaces.includes("convex")) {
  anchors.push("apps/convex/package.json");
  anchors.push("apps/convex/tsconfig.json");
  anchors.push("apps/convex/convex/schema.ts");
  anchors.push("apps/convex/convex/auth.config.ts");
  anchors.push("apps/convex/convex/workspaceStatus.ts");
  anchors.push("apps/convex/convex/_generated/api.d.ts");
  anchors.push("apps/convex/convex/_generated/api.js");
  anchors.push("apps/convex/convex/_generated/dataModel.d.ts");
  anchors.push("apps/convex/convex/_generated/server.d.ts");
  anchors.push("apps/convex/convex/_generated/server.js");
}
```

- [ ] **Step 3: Add failing CLI source-policy tests**

In `packages/cli/src/run.test.ts`, add tests near the existing local validation/source checks:

```ts
it("fails validate when generated app web source imports untyped Convex server APIs", async () => {
  await writeFile(
    join(dir, "apps/web/src/App.tsx"),
    'import { anyApi } from "convex/server";\nconst q = anyApi.workspaceStatus.protectedStatus;\n',
    "utf8"
  );

  const code = await runAgentstack(["validate"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(1);
  expect(output.join("\n")).toContain("FAIL convex.typed-api.any-api");
  expect(output.join("\n")).toContain("Path: apps/web/src/App.tsx");
  expect(output.join("\n")).toContain("Fix: Import api from @app/convex/api.");
});

it("allows Convex generated api.js to contain anyApi", async () => {
  await writeFile(
    join(dir, "apps/convex/convex/_generated/api.js"),
    'import { anyApi } from "convex/server";\nexport const api = anyApi;\n',
    "utf8"
  );

  const code = await runAgentstack(["validate"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(output.join("\n")).not.toContain("convex.typed-api.any-api");
  expect(code).toBe(0);
});

it("fails validate when web source uses manual Convex query casts", async () => {
  await writeFile(
    join(dir, "apps/web/src/App.tsx"),
    'const result = useQuery(api.workspaceStatus.protectedStatus, {}) as ProtectedWorkspaceStatus | undefined;\n',
    "utf8"
  );

  const code = await runAgentstack(["validate"], {
    cwd: dir,
    write: (line) => output.push(line)
  });

  expect(code).toBe(1);
  expect(output.join("\n")).toContain("FAIL convex.typed-api.manual-query-cast");
});
```

- [ ] **Step 4: Implement typed Convex source policy diagnostics**

In `packages/cli/src/run.ts`, add helpers near `findSourcePolicyDiagnostics`:

```ts
function isConvexGeneratedFile(file: string): boolean {
  return file.startsWith("apps/convex/convex/_generated/");
}

function isWebOrMobileSourceFile(file: string): boolean {
  return (
    (file.startsWith("apps/web/src/") || file.startsWith("apps/mobile/")) &&
    (file.endsWith(".ts") || file.endsWith(".tsx"))
  );
}

function findConvexTypedApiDiagnostics(file: string, content: string): Diagnostic[] {
  if (!isWebOrMobileSourceFile(file) || isConvexGeneratedFile(file)) {
    return [];
  }

  const diagnostics: Diagnostic[] = [];
  if (content.includes("anyApi")) {
    diagnostics.push({
      severity: "fail",
      code: "convex.typed-api.any-api",
      path: file,
      message: "Generated app source imports or uses anyApi directly instead of the typed Convex API.",
      fix: "Import api from @app/convex/api.",
      blocks: ["validate", "validate --cloud", "deploy"]
    });
  }
  if (content.includes('"convex/server"') || content.includes("'convex/server'")) {
    diagnostics.push({
      severity: "fail",
      code: "convex.typed-api.server-import",
      path: file,
      message: "Web/mobile source must not import server-only Convex APIs.",
      fix: "Import api from @app/convex/api and client hooks from convex/react.",
      blocks: ["validate", "validate --cloud", "deploy"]
    });
  }
  if (content.includes("makeFunctionReference")) {
    diagnostics.push({
      severity: "fail",
      code: "convex.typed-api.make-function-reference",
      path: file,
      message: "Generated app source must use generated Convex API references instead of makeFunctionReference.",
      fix: "Import api from @app/convex/api.",
      blocks: ["validate", "validate --cloud", "deploy"]
    });
  }
  if (content.match(/useQuery\([^;\n]+ as [A-Z][A-Za-z0-9_]+ \| undefined/)) {
    diagnostics.push({
      severity: "fail",
      code: "convex.typed-api.manual-query-cast",
      path: file,
      message: "Template Convex queries should infer response types from @app/convex/api instead of manual casts.",
      fix: "Remove the manual response alias and cast from the useQuery call.",
      blocks: ["validate", "validate --cloud", "deploy"]
    });
  }
  return diagnostics;
}
```

Then update `findSourcePolicyDiagnostics` to push these diagnostics for each file:

```ts
diagnostics.push(...findConvexTypedApiDiagnostics(file, content));
```

- [ ] **Step 5: Run focused validation tests**

Run:

```sh
corepack pnpm vitest run packages/core/src/validation.test.ts packages/cli/src/run.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit validation boundary**

Run:

```sh
git add packages/core/src/validation.ts packages/core/src/validation.test.ts packages/cli/src/run.ts packages/cli/src/run.test.ts
git commit -m "fix: validate typed convex api boundary"
```

## Task 4: Agentstack-Owned Convex Codegen Command And Preflight Hooks

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`
- Modify: `packages/agentstack/templates/b2b-saas/package.json`
- Modify: `templates/b2b-saas/package.json`
- Modify: `packages/agentstack/templates/b2b-saas/AGENTS.md`
- Modify: `templates/b2b-saas/AGENTS.md`
- Modify: `packages/agentstack/src/create/generate.test.ts`

- [ ] **Step 1: Add failing tests for `agentstack convex codegen`**

In `packages/cli/src/run.test.ts`, add:

```ts
it("runs convex codegen with explicit local/provider mutation output", async () => {
  const commands: LocalCommandSpec[] = [];

  const code = await runAgentstack(["convex", "codegen"], {
    cwd: dir,
    write: (line) => output.push(line),
    commandRunner: async (command) => {
      commands.push(command);
      await writeFile(join(dir, "apps/convex/convex/_generated/api.d.ts"), "export declare const api: {};\n", "utf8");
      await writeFile(join(dir, "apps/convex/convex/_generated/api.js"), "export const api = {};\n", "utf8");
      await writeFile(join(dir, "apps/convex/convex/_generated/dataModel.d.ts"), "export type DataModel = {};\n", "utf8");
      await writeFile(join(dir, "apps/convex/convex/_generated/server.d.ts"), "export {};\n", "utf8");
      await writeFile(join(dir, "apps/convex/convex/_generated/server.js"), "export {};\n", "utf8");
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  });

  expect(code).toBe(0);
  expect(commands).toEqual([
    {
      id: "convex:codegen",
      command: "corepack",
      args: ["pnpm", "--filter", "@app/convex", "exec", "convex", "codegen", "--typecheck", "try"]
    }
  ]);
  expect(output.join("\n")).toContain("Convex API types: sync started");
  expect(output.join("\n")).toContain("Provider mutation: none");
  expect(output.join("\n")).toContain("Local mutation: apps/convex/convex/_generated/api.d.ts");
  expect(output.join("\n")).toContain("Result: generated");
});

it("fails convex codegen when generated files are still missing", async () => {
  const code = await runAgentstack(["convex", "codegen"], {
    cwd: dir,
    write: (line) => output.push(line),
    commandRunner: async () => ({ exitCode: 0, stdout: "", stderr: "" })
  });

  expect(code).toBe(1);
  expect(output.join("\n")).toContain("FAIL convex.codegen.generated-files-missing");
});
```

Add a preflight test:

```ts
it("runs convex codegen before dev check for web", async () => {
  await runAgentstack(["sync", "--env", "development", "--apply"], { cwd: dir, write: () => undefined });
  const commands: LocalCommandSpec[] = [];

  const code = await runAgentstack(["dev", "--surface", "web", "--check"], {
    cwd: dir,
    write: (line) => output.push(line),
    commandRunner: async (command) => {
      commands.push(command);
      await writeConvexGeneratedFiles();
      return { exitCode: 0, stdout: "", stderr: "" };
    }
  });

  expect(code).toBe(0);
  expect(commands[0]).toMatchObject({ id: "convex:codegen" });
  expect(output.join("\n")).toContain("Convex API types: sync started");
  expect(output.join("\n")).toContain("PASS dev preflight development web");
});
```

Add helper in `run.test.ts`:

```ts
async function writeConvexGeneratedFiles(): Promise<void> {
  await mkdir(join(dir, "apps/convex/convex/_generated"), { recursive: true });
  await writeFile(join(dir, "apps/convex/convex/_generated/api.d.ts"), "export declare const api: {};\n", "utf8");
  await writeFile(join(dir, "apps/convex/convex/_generated/api.js"), "export const api = {};\n", "utf8");
  await writeFile(join(dir, "apps/convex/convex/_generated/dataModel.d.ts"), "export type DataModel = {};\n", "utf8");
  await writeFile(join(dir, "apps/convex/convex/_generated/server.d.ts"), "export {};\n", "utf8");
  await writeFile(join(dir, "apps/convex/convex/_generated/server.js"), "export {};\n", "utf8");
}
```

- [ ] **Step 2: Run CLI tests and verify they fail**

Run:

```sh
corepack pnpm vitest run packages/cli/src/run.test.ts
```

Expected: FAIL because the `convex` command and preflight hooks do not exist.

- [ ] **Step 3: Add `convex` command dispatch and usage**

In `packages/cli/src/run.ts`, add dispatch before unknown command:

```ts
if (command === "convex" && (isHelpArg(subcommand) || subcommand === undefined)) {
  writeConvexUsage(io);
  return 0;
}

if (command === "convex" && subcommand === "codegen") {
  return await convexCodegenCommand(rest, io);
}
```

Add usage:

```ts
function writeConvexUsage(io: RunIo): void {
  io.write("Usage: agentstack convex codegen");
  io.write("");
  io.write("Commands:");
  io.write("  codegen      Regenerate generated Convex API types for app surfaces");
}
```

Add `convex` to `writeTopLevelUsage`.

- [ ] **Step 4: Implement Convex API sync helper**

In `packages/cli/src/run.ts`, add near local command helpers:

```ts
const convexGeneratedApiFiles = [
  "apps/convex/convex/_generated/api.d.ts",
  "apps/convex/convex/_generated/api.js",
  "apps/convex/convex/_generated/dataModel.d.ts",
  "apps/convex/convex/_generated/server.d.ts",
  "apps/convex/convex/_generated/server.js"
] as const;

async function convexCodegenCommand(_argv: string[], io: RunIo): Promise<number> {
  return await syncConvexApiTypes(io);
}

async function syncConvexApiTypes(io: RunIo): Promise<number> {
  const context = await loadProjectContext(io.cwd);
  if (!context.manifest.surfaces.includes("convex") || !context.manifest.services.convex.enabled) {
    io.write("Convex API types: skipped");
    io.write("Reason: convex surface is not enabled");
    io.write("Provider mutation: none");
    io.write("Local mutation: none");
    return 0;
  }

  const packagePath = join(io.cwd, "apps/convex/package.json");
  try {
    await stat(packagePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      io.write("FAIL convex.codegen.package-missing");
      io.write("Path: apps/convex/package.json");
      io.write("Reason: Convex surface is enabled but @app/convex is missing.");
      io.write("Fix: Restore the generated Convex app package or regenerate the app.");
      io.write("Provider mutation: none");
      io.write("Local mutation: none");
      return 1;
    }
    throw error;
  }

  const before = await snapshotConvexGeneratedFiles(io.cwd);
  const spec: LocalCommandSpec = {
    id: "convex:codegen",
    command: "corepack",
    args: ["pnpm", "--filter", "@app/convex", "exec", "convex", "codegen", "--typecheck", "try"]
  };
  io.write("Convex API types: sync started");
  io.write(`Command: ${formatCommandSpec(spec)}`);
  io.write("Reason: typed Convex API required by @app/web and future cross-surface consumers");
  io.write("Provider mutation: none");
  const runner = io.commandRunner ?? createChildProcessCommandRunner(io.cwd);
  const result = await runner(spec);
  if (result.exitCode !== 0) {
    io.write("FAIL convex.codegen.failed");
  io.write(`Reason: Convex codegen exited with status ${result.exitCode}.`);
    io.write("Provider mutation: none");
    io.write("Local mutation: none or partial generated-file mutation");
    io.write("Fix: Fix the first Convex TypeScript or schema error above, then rerun agentstack convex codegen.");
    return 1;
  }

  const after = await snapshotConvexGeneratedFiles(io.cwd);
  const missing = convexGeneratedApiFiles.filter((file) => after[file] === undefined);
  if (missing.length > 0) {
    io.write("FAIL convex.codegen.generated-files-missing");
    missing.forEach((file) => io.write(`Path: ${file}`));
    io.write("Provider mutation: none");
    io.write("Fix: Rerun agentstack convex codegen after checking the Convex CLI output.");
    return 1;
  }

  const changed = convexGeneratedApiFiles.filter((file) => before[file] !== after[file]);
  if (changed.length === 0) {
    io.write("Local mutation: none");
    io.write("Result: already current");
    return 0;
  }
  changed.forEach((file) => io.write(`Local mutation: ${file}`));
  io.write("Result: generated");
  return 0;
}

async function snapshotConvexGeneratedFiles(cwd: string): Promise<Record<string, string | undefined>> {
  const snapshot: Record<string, string | undefined> = {};
  for (const file of convexGeneratedApiFiles) {
    try {
      snapshot[file] = await readFile(join(cwd, file), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      snapshot[file] = undefined;
    }
  }
  return snapshot;
}
```

- [ ] **Step 5: Hook sync before validate/dev/preview up**

In `validateCommand`, before `runLocalValidationGate(io.cwd)`, add:

```ts
const convexSyncCode = await syncConvexApiTypes(io);
if (convexSyncCode !== 0) {
  return convexSyncCode;
}
```

Do not run this inside `validate --release production` until the release path has explicit acceptance coverage; keep this first implementation scoped to normal local validation.

In `devCommand`, before `loadLifecycleSummary(...)`, add:

```ts
if (surface === "web") {
  const convexSyncCode = await syncConvexApiTypes(io);
  if (convexSyncCode !== 0) {
    return convexSyncCode;
  }
}
```

In `previewUpCommand`, after confirmation checks and before `steps`, add:

```ts
const convexSyncCode = await syncConvexApiTypes(io);
if (convexSyncCode !== 0) {
  return convexSyncCode;
}
```

- [ ] **Step 6: Update generated package script and guidance in both template mirrors**

In both root template `package.json` files, add:

```json
"convex:codegen": "agentstack convex codegen"
```

In both generated `AGENTS.md` files, add this under working contract or commands:

```md
- Convex API types are generated app artifacts under `apps/convex/convex/_generated/`.
  Run `corepack pnpm run convex:codegen` after Convex function changes if you need an explicit repair; `validate`,
  `dev`, and `preview:up` also run package-owned sync before relying on those types.
```

Add `corepack pnpm run convex:codegen` to the commands list.

- [ ] **Step 7: Add generator assertions for script and guidance**

In `packages/agentstack/src/create/generate.test.ts`, assert:

```ts
expect(packageManifest.scripts).toMatchObject({
  "convex:codegen": "agentstack convex codegen"
});
expect(agents).toContain("corepack pnpm run convex:codegen");
expect(agents).toContain("apps/convex/convex/_generated");
```

- [ ] **Step 8: Run focused tests and mirror check**

Run:

```sh
corepack pnpm vitest run packages/cli/src/run.test.ts packages/agentstack/src/create/generate.test.ts
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
```

Expected: PASS and no mirror diff.

- [ ] **Step 9: Commit package-owned Convex codegen**

Run:

```sh
git add packages/cli/src/run.ts packages/cli/src/run.test.ts \
  packages/agentstack/templates/b2b-saas/package.json templates/b2b-saas/package.json \
  packages/agentstack/templates/b2b-saas/AGENTS.md templates/b2b-saas/AGENTS.md \
  packages/agentstack/src/create/generate.test.ts
git commit -m "feat: sync generated convex api types"
```

## Task 5: Fresh-App Acceptance And M4 Regression

**Files:**
- No source edits expected unless acceptance fails.

- [ ] **Step 1: Generate and install a fresh app from the upstream template**

Run:

```sh
tmpdir="$(mktemp -d)"
cd "$tmpdir"
<agentstack-repo>/node_modules/.bin/tsx \
  <agentstack-repo>/packages/agentstack/src/bin.ts \
  create convex-types-smoke \
  --package-spec link:<agentstack-repo>/packages/agentstack
cd convex-types-smoke
corepack pnpm install
```

Expected: install succeeds with `@types/node`, `@app/convex`, and generated `_generated` files present.

- [ ] **Step 2: Verify Convex and web type/build acceptance**

Run from the fresh app root:

```sh
corepack pnpm exec tsc -p apps/convex/tsconfig.json
corepack pnpm --filter @app/web build
corepack pnpm run validate
```

Expected:

```text
tsc exits 0
@app/web build exits 0
validate prints Convex API type sync output, then PASS validate
```

- [ ] **Step 3: Verify generated app source policy with grep**

Run from the fresh app root:

```sh
rg "convex/server|anyApi|makeFunctionReference| as ProtectedWorkspaceStatus| as EntitlementGate" apps/web apps/mobile
```

Expected: no matches.

Run:

```sh
rg "anyApi" apps/convex/convex/_generated/api.js
```

Expected: matches are allowed because Convex generated `api.js` owns that implementation detail.

- [ ] **Step 4: Run framework verification**

Run from `<agentstack-repo>`:

```sh
corepack pnpm typecheck
corepack pnpm test
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
corepack pnpm run m4:pack:smoke
git diff --check
```

Expected: all pass. `m4:pack:smoke` should show generated app `validate` and `dev:check` running through the package-owned Convex API sync without monorepo source `link:` dependencies.

- [ ] **Step 5: Record acceptance result**

Run:

```sh
git status --short
```

Expected: no uncommitted source changes from the acceptance commands. If the status is dirty, return to the task that
introduced the failing file, fix it there, rerun Task 5 from Step 1, and commit through that task's commit step. Do not
create an empty acceptance commit.
