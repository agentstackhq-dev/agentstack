# Agentstack Provider Env Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local-cloud sync and cloud validation reason about provider-targeted custom environment bindings, not only linked services, while keeping all state local and redacted.

**Architecture:** Core derives provider env resources from manifest custom env bindings plus local env values. The local-cloud adapter stores redacted/hash-only provider env resource state in `.agentstack/local-cloud.json` and validates missing, stale, and drifted env resources. CLI commands pass local env values into sync/validate/inspect flows and surface provider env resource changes without printing raw values.

**Tech Stack:** TypeScript, Vitest, existing Agentstack manifest/env graph, local-cloud adapter, generated B2B SaaS templates, static spin-up HTML.

---

## File Structure

- Modify `packages/core/src/env-graph.ts` to add provider env resource derivation and deterministic value hashes.
- Modify `packages/core/src/env-graph.test.ts` for provider env resource mapping, inactive scopes, and secret-safe metadata.
- Modify `packages/adapters/src/types.ts` to add provider env resource/report/change types and env-aware adapter options.
- Modify `packages/adapters/src/local-cloud.ts` to inspect, plan, apply, validate, and sync provider env resources.
- Modify `packages/adapters/src/local-cloud.test.ts` for missing/stale/drifted env resources and secret-safe local-cloud state.
- Modify `packages/core/src/lifecycle.ts` and `packages/cli/src/run.ts` so lifecycle summaries, `sync`, `validate --cloud`, `doctor`, `dev`, deploy, prod provision, mobile build, and `env inspect` use env-aware adapter checks.
- Modify `packages/cli/src/run.test.ts` and `tests/e2e/prototype.test.ts` for CLI/e2e contract coverage.
- Modify generated docs in both template roots, `README.md`, and `docs/spinup-site/` to explain provider env sync as a local rehearsal.

## Task 1: Core Provider Env Resource Derivation

**Files:**
- Modify: `packages/core/src/env-graph.ts`
- Modify: `packages/core/src/env-graph.test.ts`

- [x] **Step 1: Write failing provider resource tests**

Add tests for a manifest with:

```ts
manifest.env.custom.STRIPE_MODE = {
  surfaces: ["web", "convex"],
  environments: ["preview", "production"],
  required: true,
  secret: false,
  validate: "enum:sandbox,live"
};
manifest.env.custom.OPENAI_API_KEY = {
  surfaces: ["convex"],
  environments: ["preview"],
  required: true,
  secret: true
};
```

Assert `buildProviderEnvResources(manifest, values)` returns:

- `preview.vercel.STRIPE_MODE` for `web`;
- `preview.convex.STRIPE_MODE` for `convex`;
- `preview.convex.OPENAI_API_KEY` for `convex`;
- `production.vercel.STRIPE_MODE` and `production.convex.STRIPE_MODE`;
- no resource for disabled services, inactive environments, or inactive surfaces;
- `valueHash` is present when a local value exists;
- raw values are never present on resources.

Also assert secret resources preserve `secret: true`.

- [x] **Step 2: Verify red**

Run:

```bash
pnpm exec vitest run packages/core/src/env-graph.test.ts
```

Expected: fail because `buildProviderEnvResources` does not exist.

- [x] **Step 3: Implement provider env resource derivation**

Add:

```ts
export type ProviderEnvResource = {
  environment: EnvironmentName;
  surface: SurfaceName;
  service: ServiceName;
  kind: "envVar";
  name: string;
  required: boolean;
  secret: boolean;
  valueHash?: string;
};
```

Implement:

```ts
export function buildProviderEnvResources(
  manifest: AgentstackManifest,
  values: EnvValueState = {}
): ProviderEnvResource[]
```

Surface-to-provider mapping:

- `web` -> `vercel`
- `mobile` -> `eas`
- `convex` -> `convex`

Only emit a resource if:

- the binding environment and surface are active in the manifest;
- the mapped provider service is enabled;
- the mapped provider service includes the binding environment in `requiredEnvironments`.

Use a deterministic hash for present values:

```ts
sha256(`${environment}:${surface}:${name}:${value}`)
```

Use only `valueHash`, never raw `value`.

- [x] **Step 4: Verify core tests**

Run:

```bash
pnpm exec vitest run packages/core/src/env-graph.test.ts
```

Expected: env graph tests pass.

## Task 2: Local-Cloud Env Resource State

**Files:**
- Modify: `packages/adapters/src/types.ts`
- Modify: `packages/adapters/src/local-cloud.ts`
- Modify: `packages/adapters/src/local-cloud.test.ts`

- [x] **Step 1: Write failing adapter tests**

Add tests that:

1. Seed a manifest with preview `STRIPE_MODE` on `web,convex` and local env values:

```ts
{
  preview: {
    web: { STRIPE_MODE: "sandbox" },
    convex: { STRIPE_MODE: "sandbox" }
  }
}
```

2. Call `adapter.validate(manifest, "preview", { envValues })` before sync and assert diagnostics include:

```ts
expect.objectContaining({
  severity: "fail",
  code: "cloud.env.missing",
  path: "preview.vercel.env.STRIPE_MODE"
})
```

and `preview.convex.env.STRIPE_MODE`.

3. Call `adapter.sync(manifest, "preview", { apply: true, envValues })`, read `.agentstack/local-cloud.json`, and assert:

- `envResources` exists;
- it includes `preview/vercel/STRIPE_MODE`;
- it includes `valueHash`;
- it does not include `"sandbox"` or any raw secret string.

4. Assert validation passes after sync.

5. Seed stale state with an env resource not expected by the manifest and assert `cloud.env.stale` and a remove plan.

6. Change a local env value after sync and assert `cloud.env.drift` until sync apply updates the stored hash.

- [x] **Step 2: Verify red**

Run:

```bash
pnpm exec vitest run packages/adapters/src/local-cloud.test.ts
```

Expected: fail because adapter types/state do not support env resources.

- [x] **Step 3: Add env-aware adapter types**

In `packages/adapters/src/types.ts`, add:

```ts
export type InspectEnvResource = ProviderEnvResource & {
  synced: boolean;
};

export type EnvResourceChange = {
  action: "set-env" | "remove-env";
  environment: EnvironmentName;
  service: ServiceName | string;
  name: string;
  secret: boolean;
};
```

Extend reports/plans with:

- `expectedEnv: InspectEnvResource[]`
- `syncedEnv: InspectEnvResource[]`
- `missingEnv: InspectEnvResource[]`
- `staleEnv: InspectEnvResource[]`
- `driftedEnv: InspectEnvResource[]`
- `SyncChange.action` includes `"set-env" | "remove-env"`
- `SyncOptions` and validation options accept `envValues?: EnvValueState`

- [x] **Step 4: Implement local-cloud env resource sync**

Update local state shape to:

```ts
type LocalCloudState = {
  services: LocalCloudServiceState[];
  envResources?: Array<{
    environment: EnvironmentName;
    service: ServiceName | string;
    surface: SurfaceName;
    kind: "envVar";
    name: string;
    required: boolean;
    secret: boolean;
    valueHash?: string;
  }>;
};
```

Implement expected/synced/missing/stale/drifted resource detection using `buildProviderEnvResources(manifest, options.envValues ?? {})`.

Plan changes:

- missing or drifted expected env resource -> `set-env <env>.<service>.<name>`
- stale env resource -> `remove-env <env>.<service>.<name>`

Apply changes:

- `set-env`: upsert expected env resource metadata/hash;
- `remove-env`: remove stale env resource for that environment/service/name;
- never write raw values.

Validate diagnostics:

- `cloud.env.missing`
- `cloud.env.drift`
- `cloud.env.stale`

Fix text should point to:

```text
Run agentstack sync --env <environment> --apply.
```

- [x] **Step 5: Verify adapter tests**

Run:

```bash
pnpm exec vitest run packages/adapters/src/local-cloud.test.ts
```

Expected: adapter tests pass.

## Task 3: CLI And Lifecycle Integration

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`
- Modify: `packages/core/src/lifecycle.ts`

- [x] **Step 1: Write failing CLI/lifecycle tests**

Add tests that:

1. A required custom env value exists locally, `validate --cloud --env preview` fails before sync with `FAIL cloud.env.missing`.
2. `sync --env preview --apply` prints `set-env preview.convex.OPENAI_API_KEY` or `set-env preview.vercel.STRIPE_MODE`, does not print the raw value, and writes no raw value to `.agentstack/local-cloud.json`.
3. `validate --cloud --env preview` passes after sync.
4. `env inspect --env preview` prints provider env sync state such as:

```text
- provider-env convex.OPENAI_API_KEY synced=no secret=yes
```

or `synced=yes` after sync.
5. `doctor --env preview` includes env resource diagnostics and next `agentstack sync --env preview --apply` repair command.
6. Release validation fails on missing production provider env resources after local values exist but before production provision.

- [x] **Step 2: Verify red**

Run:

```bash
pnpm exec vitest run packages/cli/src/run.test.ts
```

Expected: fail because CLI adapter calls do not pass env values and lifecycle summaries do not expose env resource state.

- [x] **Step 3: Wire env values through CLI**

Update:

- `runLocalValidationGate` returns `envValues`.
- `validate --cloud` calls `adapter.validate(context.manifest, environment, { envValues })`.
- `sync` calls `adapter.sync(context.manifest, environment, { apply, envValues })`.
- `prod provision`, `init cloud`, deploy, release validation, mobile build, lifecycle summary, doctor, and dev call env-aware adapter methods.
- `env inspect` uses adapter inspect with env values and prints provider env resources separately from local binding presence.

Update lifecycle cloud summary to include counts/lists for env resources:

```ts
expectedEnv: string[];
syncedEnv: string[];
missingEnv: string[];
staleEnv: string[];
driftedEnv: string[];
```

Include missing/stale/drifted env resources in `recommendLifecycleCommands` so doctor/dev propose `agentstack sync --env <env> --apply`.

- [x] **Step 4: Verify CLI tests**

Run:

```bash
pnpm exec vitest run packages/cli/src/run.test.ts
```

Expected: CLI tests pass.

## Task 4: Generated Docs, E2E, Spin-Up, And Commit

**Files:**
- Modify: `templates/b2b-saas/docs/agentstack/environments.md`
- Modify: mirrored generated environments docs
- Modify: `templates/b2b-saas/docs/agentstack/validation.md`
- Modify: mirrored validation docs
- Modify: `templates/b2b-saas/docs/agentstack/workflows.md`
- Modify: mirrored workflow docs if needed
- Modify: `tests/e2e/prototype.test.ts`
- Modify: `README.md`
- Modify: `docs/spinup-site/generated-app.html`, `docs/spinup-site/timeline.html`, `docs/spinup-site/assets/site.js`

- [x] **Step 1: Update e2e expectations**

Extend the existing e2e custom `STRIPE_MODE` flow:

- `validate --cloud --env preview` fails before sync with service/env diagnostics;
- `sync --env preview --apply` includes `set-env preview.convex.STRIPE_MODE`;
- `.agentstack/local-cloud.json` contains `valueHash` and not the raw value;
- `validate --cloud --env preview` passes after sync;
- production release validation requires production provider env resources after `prod provision --apply`.

- [x] **Step 2: Update docs**

Generated docs should explain:

- `agentstack env set` writes local validation state only.
- `agentstack sync --env <env> --apply` reconciles provider env resources into local-cloud state.
- Local-cloud state stores redacted/hash-only metadata, never raw env values.
- `validate --cloud` checks linked services plus provider env resource presence/drift.
- Real Convex, Vercel, EAS, and Clerk adapters will implement this same resource contract later.

- [x] **Step 3: Verify full gate**

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

- [x] **Step 4: Review and commit**

Run spec/code review using subagents, fix all Critical/Important findings, rerun the full gate, then commit:

```bash
git status --short
git add README.md docs packages templates tests
git commit -m "feat: sync provider env resources locally"
git status --short
```

Expected: commit succeeds and worktree is clean.

## Completion Evidence

Implementation used subagent workers for core derivation, adapter state, CLI/lifecycle wiring, docs/e2e updates, CLI sync guard hardening, and adapter invariant hardening. Spec review returned `SPEC_APPROVED`; final code-quality review returned `FINAL_QUALITY_APPROVED`.

Final verification run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
git diff --check
node --check docs/spinup-site/assets/site.js
curl -fsS http://127.0.0.1:8765/index.html >/tmp/agentstack-site-index.html
```

Results:

- Frozen install passed with lockfile up to date.
- TypeScript passed with `tsc -p tsconfig.base.json --noEmit`.
- Vitest passed: 18 files, 230 tests.
- Template mirror diff passed with no output.
- Git diff whitespace check passed.
- Spin-up site JavaScript parsed successfully.
- LAN-served spin-up site index responded successfully.
