# Agentstack Convex API Types Design

Status: approved design, not yet implemented
Date: 2026-06-30

## Target

This design improves the Convex generated API type workflow in lean Agentstack apps. It is a post-M4 design artifact,
not an M5 public publishing, hosted control-plane, production-gate, or live-provider mutation milestone.

The current template uses `anyApi` in `apps/web/src/App.tsx`, which lets web code call Convex functions without the
generated Convex API type contract. Agents can also edit Convex functions while only running web or Agentstack
preflight commands, leaving `_generated/api` stale if `convex dev` is not running.

The target is:

- generated Convex code typechecks cleanly in IDEs and with `tsc -p apps/convex/tsconfig.json`
- new apps start with Convex generated API files present
- web and future mobile code import the typed generated API instead of `anyApi`
- package-owned Agentstack commands regenerate Convex API types before relying on them
- commands clearly disclose local file mutation, provider mutation, reason, command, and next step

## User Decisions

- Agentstack commands may auto-mutate local generated files.
- Auto-mutation must be explicit in command output so the running agent understands what happened.
- The correct primitive is Convex's existing `convex codegen` command.
- The preferred approach is Agentstack-owned automatic codegen in the normal validation and dev path, with an explicit
  repair command available.
- The Convex TypeScript and Node type fixes should land first as a quick pass, before the generated API sync work.

## Generated App Feedback Incorporated

A generated app at `<generated-app-root>` proved the local fixes in commit
`5dba9b1 Use generated Convex API and type Convex surface`. The upstream implementation should move the useful
template fixes into Agentstack instead of treating `ags01` as a one-off patch.

The `ags01` commit used a direct relative import:

```ts
import { api } from "../../convex/convex/_generated/api";
```

That proves typed generated API consumption works. The upstream template should still prefer the package export
described below:

```ts
import { api } from "@app/convex/api";
```

The package export is the durable cross-surface boundary for web and mobile. The direct relative import should not be
used as the final upstream API shape.

## Product Boundary

This change preserves the lean generated app contract. The generated app remains an app that depends on `agentstack`
and owns product source under:

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

Convex `_generated` files are generated application artifacts, not copied framework internals. They are allowed under
`apps/convex/convex/_generated/` and should be present in a freshly generated template because frontend code will
typecheck against them.

The generated app still must not include copied framework docs, copied scripts, generated provider ledgers, root
`convex/`, root `vercel.json`, or package internals.

## Architecture

The Convex app package becomes the owner of the app-facing Convex API export.

`apps/convex/package.json` should expose the generated API through package exports:

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
  }
}
```

`apps/web/package.json` should depend on `@app/convex` through the workspace:

```json
{
  "dependencies": {
    "@app/convex": "workspace:*"
  }
}
```

Web code imports the generated API:

```ts
import { api } from "@app/convex/api";

const protectedWorkspaceStatusQuery = api.workspaceStatus.protectedStatus;
const protectedEntitlementGateQuery = api.billing.protectedEntitlementGate;
```

Generated app code must not import `anyApi` directly. Convex's generated `api.js` may still use `anyApi` internally;
the public application contract is the generated `api.d.ts` type surface.

## Convex TypeScript Baseline

Before adding automatic codegen, the template should gain the Convex TypeScript baseline proven in the generated app
patch.

Root generated `package.json` should include Node types:

```json
{
  "devDependencies": {
    "@types/node": "^26.0.1"
  }
}
```

`apps/convex/tsconfig.json` should exist:

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

This fixes IDE and CLI type complaints for Convex files that use Node globals such as `process.env`, including
`apps/convex/convex/auth.config.ts` and `apps/convex/convex/http.ts`.

The Clerk webhook secret decoder should return `Uint8Array<ArrayBuffer>` so `crypto.subtle.importKey` receives a
compatible `BufferSource`:

```ts
function decodeSecret(secret: string): Uint8Array<ArrayBuffer> {
  const prefixed = `${"whsec"}_`;
  const encoded = secret.startsWith(prefixed) ? secret.slice(prefixed.length) : secret;
  return new Uint8Array(Array.from(atob(encoded), (char) => char.charCodeAt(0)));
}
```

## Convex API Sync Command

Agentstack should add an explicit package-owned command:

```sh
agentstack convex codegen
```

Generated apps may also expose it as a package script:

```json
{
  "scripts": {
    "convex:codegen": "agentstack convex codegen"
  }
}
```

The command runs from the app root and delegates to the generated Convex package:

```sh
corepack pnpm --filter @app/convex exec convex codegen --typecheck try
```

The command should:

- run only when Convex is enabled and the `convex` surface exists
- run in the generated app root, not the Agentstack framework repo
- hash or stat expected generated files before and after codegen
- report whether files were created, changed, already current, or missing
- fail if `convex codegen` exits non-zero
- fail if codegen exits zero but expected generated files are still absent
- never mutate providers or deployments

Expected generated files:

```text
apps/convex/convex/_generated/api.d.ts
apps/convex/convex/_generated/api.js
apps/convex/convex/_generated/dataModel.d.ts
apps/convex/convex/_generated/server.d.ts
apps/convex/convex/_generated/server.js
```

## Automatic Preflight Integration

Agentstack should run Convex API sync before commands that depend on app structure or typed Convex references:

- `agentstack validate`
- `agentstack dev --surface web`
- `agentstack dev --surface web --check`
- `agentstack preview up`
- future `agentstack add feature ... --backend convex`

The sync should happen before the web dev server starts. If sync fails, the Agentstack command fails before launching
Vite or continuing toward preview deploy.

`agentstack validate` and `agentstack dev --surface web --check` are allowed to mutate `_generated` files. Their output
must clearly label this as local generated-file mutation with no provider mutation.

Example output when files changed:

```text
Convex API types: sync started
Command: corepack pnpm --filter @app/convex exec convex codegen --typecheck try
Reason: typed Convex API required by @app/web and future cross-surface consumers
Provider mutation: none
Local mutation: apps/convex/convex/_generated/api.d.ts
Local mutation: apps/convex/convex/_generated/api.js
Local mutation: apps/convex/convex/_generated/dataModel.d.ts
Local mutation: apps/convex/convex/_generated/server.d.ts
Local mutation: apps/convex/convex/_generated/server.js
Result: generated
```

Example output when current:

```text
Convex API types: already current
Command: corepack pnpm --filter @app/convex exec convex codegen --typecheck try
Provider mutation: none
Local mutation: none
```

Example output when skipped:

```text
Convex API types: skipped
Reason: convex surface is not enabled
Provider mutation: none
Local mutation: none
```

## Validation Rules

`agentstack validate` should enforce the typed generated API boundary after sync:

- `apps/convex/package.json` exists when Convex is enabled
- `apps/convex/tsconfig.json` exists when Convex is enabled
- root generated `package.json` includes `@types/node` when Convex is enabled
- `@app/convex` exposes `./api`
- `apps/web/package.json` depends on `@app/convex` when web and Convex are enabled
- required `_generated` API files exist after sync
- generated app source does not import `anyApi` outside `apps/convex/convex/_generated/*`
- web/mobile source does not import `convex/server`
- web/mobile source does not call `makeFunctionReference`
- generated web `useQuery` calls for template Convex functions do not use manual response casts

The `anyApi` scan should cover generated application source and avoid false positives in historical docs, package
manager files, and Convex generated output.

## Failure Modes

Missing Convex package:

```text
FAIL convex.codegen.package-missing
Path: apps/convex/package.json
Reason: Convex surface is enabled but @app/convex is missing.
Fix: Restore the generated Convex app package or regenerate the app.
Provider mutation: none
Local mutation: none
```

Missing Convex CLI dependency:

```text
FAIL convex.codegen.cli-missing
Reason: convex CLI is not installed for @app/convex.
Fix: Run corepack pnpm install from the app root, then rerun agentstack validate.
Provider mutation: none
Local mutation: none
```

Convex codegen type or syntax failure:

```text
FAIL convex.codegen.failed
Command: corepack pnpm --filter @app/convex exec convex codegen --typecheck try
Reason: Convex codegen exited with a non-zero status.
Provider mutation: none
Local mutation: none or partial generated-file mutation
Fix: Fix the first Convex TypeScript or schema error above, then rerun agentstack convex codegen.
```

Direct app `anyApi` usage:

```text
FAIL convex.typed-api.any-api
Path: apps/web/src/App.tsx
Reason: Generated app code imports anyApi directly instead of the typed Convex API.
Fix: Import api from @app/convex/api.
Provider mutation: none
```

## Template Changes

The template mirrors must stay aligned:

```text
templates/b2b-saas
packages/agentstack/templates/b2b-saas
```

Template updates:

- add generated root `@types/node` dev dependency
- add `apps/convex/tsconfig.json`
- update `apps/convex/convex/http.ts` so `decodeSecret` returns `Uint8Array<ArrayBuffer>`
- add `apps/convex/convex/_generated/*`
- add `@app/convex` package exports for `./api`
- add `@app/convex` workspace dependency to `@app/web`
- replace `anyApi` imports in web with `api` from `@app/convex/api`
- remove manual response aliases/casts for the template `useQuery` calls
- add `convex:codegen` script to the generated root package
- update generated `AGENTS.md` command guidance to mention typed Convex API sync

## Testing

Focused tests should prove:

- `corepack pnpm exec tsc -p apps/convex/tsconfig.json` passes in a freshly generated app
- `corepack pnpm --filter @app/web build` passes in a freshly generated app
- generated app templates do not contain direct `anyApi` imports outside `_generated`
- generated app web/mobile source does not contain `convex/server`, `makeFunctionReference`, or manual template query
  response casts
- generated web code imports `api` from `@app/convex/api`
- `@app/web` depends on `@app/convex` through `workspace:*`
- `@app/convex` exports `./api` to the generated API files
- `agentstack validate` invokes Convex codegen when Convex is enabled
- `agentstack dev --surface web --check` invokes Convex codegen and prints provider/local mutation labels
- codegen failures fail before web dev starts
- missing generated API files after codegen fail validation
- template mirrors remain byte-for-byte aligned
- M4 local-pack smoke still passes, including generated app `validate` and `dev:check`

Implementation should be ordered in two passes:

1. Convex TypeScript quick pass: `@types/node`, `apps/convex/tsconfig.json`, webhook `Uint8Array<ArrayBuffer>`, focused
   fresh-app typecheck/build.
2. Typed generated API/codegen pass: `@app/convex/api`, generated `_generated` files, `agentstack convex codegen`,
   automatic preflight integration, no-`anyApi` validation, M4 smoke.

Framework verification after implementation:

```sh
corepack pnpm typecheck
corepack pnpm test
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
corepack pnpm run m4:pack:smoke
git diff --check
```

## Non-Goals

- Do not start M5 public npm publishing.
- Do not add a hosted control plane.
- Do not add live provider mutation to type generation.
- Do not copy framework scripts or docs into generated apps.
- Do not preserve a compatibility path where generated app source keeps using `anyApi`.
- Do not require `convex dev` to be running for type freshness.
