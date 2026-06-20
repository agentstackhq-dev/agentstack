# Agentstack Typed App Telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give generated apps a typed, framework-native telemetry event registry and an `agentstack add event` workflow so agents can instrument web, mobile, and Convex behavior without inventing event shapes.

**Architecture:** Core owns event-name parsing and generated file planning. The CLI writes deterministic event anchors and registers them as generated anchors. The generated runtime owns lean application-facing telemetry helpers that create wide, redacted, correlation-ready event envelopes without requiring a provider dashboard or hosted control plane.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, generated B2B SaaS template, local JSONL telemetry conventions.

---

## File Map

- Create `packages/core/src/telemetry-events.ts`: parse event names and plan generated app telemetry event files.
- Modify `packages/core/src/index.ts`: export telemetry event planning APIs.
- Create `packages/core/src/telemetry-events.test.ts`: TDD coverage for event parsing, invalid names, state fields, surfaces, and generated content.
- Modify `packages/cli/src/run.ts`: add `agentstack add event <name> --journey <journey> --surfaces web,mobile,convex --state key:type,...`.
- Modify `packages/cli/src/run.test.ts`: prove event generation, overwrite refusal, diagnostics, manifest anchor registration, and command telemetry.
- Modify both generated template mirrors under `templates/b2b-saas` and `packages/create-agent-stack/templates/b2b-saas`: add package metadata for `packages/telemetry`, typed event registry helpers, runtime telemetry helpers, and app usage anchors.
- Modify `packages/create-agent-stack/src/generate.test.ts` and `tests/e2e/prototype.test.ts`: generated project includes telemetry package files and exercises `add event`.
- Modify docs: `README.md`, `docs/spinup-site/telemetry.html`, `docs/spinup-site/generated-app.html`, `docs/spinup-site/workflows.html`, `docs/spinup-site/timeline.html`, generated `docs/agentstack/observability.md`, and generated `AGENTS.md`.

## Task 1: Core Event Planning

**Files:**
- Create: `packages/core/src/telemetry-events.ts`
- Create: `packages/core/src/telemetry-events.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing core tests**

Add tests for:

```ts
const plan = planTelemetryEventFiles("billing.subscription.updated", {
  journey: "billing",
  surfaces: ["web", "convex"],
  state: ["plan:string", "seatCount:number"]
});

expect(plan.name).toMatchObject({
  input: "billing.subscription.updated",
  slug: "billing-subscription-updated",
  camel: "billingSubscriptionUpdated",
  constName: "billingSubscriptionUpdatedEvent"
});
expect(plan.files.map((file) => file.path)).toEqual([
  "packages/telemetry/src/events/billing-subscription-updated.ts",
  "docs/agentstack/events/billing-subscription-updated.md"
]);
expect(plan.files[0]?.content).toContain("billing.subscription.updated");
expect(plan.files[0]?.content).toContain("plan: \"string\"");
```

Also assert invalid event names such as `Billing Updated`, unsupported surfaces, and unsupported state types throw actionable errors.

- [ ] **Step 2: Verify core tests fail**

Run:

```bash
pnpm vitest run packages/core/src/telemetry-events.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement core planner**

Implement:

```ts
export type TelemetryEventSurface = "web" | "mobile" | "convex";
export type TelemetryStateType = "string" | "number" | "boolean" | "json";
export type TelemetryEventPlanOptions = {
  journey: string;
  surfaces: readonly string[];
  state: readonly string[];
};
export function parseTelemetryEventName(input: string): ParsedTelemetryEventName;
export function planTelemetryEventFiles(input: string, options: TelemetryEventPlanOptions): TelemetryEventPlan;
```

Generated event files should export one `as const` definition containing `name`, `journey`, `surfaces`, `schemaVersion: "app.event.v1"`, and a state field map.

- [ ] **Step 4: Verify core tests pass**

Run:

```bash
pnpm vitest run packages/core/src/telemetry-events.test.ts
```

Expected: PASS.

## Task 2: CLI `add event`

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Add failing CLI tests**

Add tests proving:

```ts
const code = await runAgentstack(
  ["add", "event", "billing.subscription.updated", "--journey", "billing", "--surfaces", "web,convex", "--state", "plan:string,seatCount:number"],
  { cwd: dir, write: (line) => output.push(line) }
);

expect(code).toBe(0);
expect(output).toContain("CREATED event billing.subscription.updated");
expect(output).toContain("- packages/telemetry/src/events/billing-subscription-updated.ts");
```

Assert generated anchor registration, overwrite refusal, invalid options, and `agentstack.event.added` telemetry under journey `telemetry-generation`.

- [ ] **Step 2: Verify CLI tests fail**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts
```

Expected: FAIL with `FAIL cli.unknown-command` or missing event planner.

- [ ] **Step 3: Implement CLI command**

Add `if (command === "add" && subcommand === "event")` routing before feature routing. Reuse existing option parsing, file writing, overwrite checks, `registerGeneratedAnchors`, and command telemetry patterns. Diagnostics should use:

```txt
FAIL event.invalid
Fix: Run agentstack add event billing.subscription.updated --journey billing --surfaces web,convex --state plan:string.
```

- [ ] **Step 4: Verify CLI tests pass**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts
```

Expected: PASS.

## Task 3: Generated Runtime And Template Anchors

**Files:**
- Create: `templates/b2b-saas/packages/telemetry/package.json`
- Modify: `templates/b2b-saas/packages/telemetry/src/events.ts`
- Create: `templates/b2b-saas/packages/telemetry/src/index.ts`
- Modify: `templates/b2b-saas/packages/agentstack-runtime/src/index.ts`
- Modify: `templates/b2b-saas/apps/web/src/index.ts`
- Modify: `templates/b2b-saas/apps/mobile/src/index.ts`
- Modify: `templates/b2b-saas/convex/agentstack.ts`
- Apply identical changes under `packages/create-agent-stack/templates/b2b-saas`.
- Modify: `packages/create-agent-stack/src/generate.test.ts`

- [ ] **Step 1: Add failing generator expectations**

Assert generated package files include:

```ts
await expect(readFile(join(targetDir, "packages/telemetry/package.json"), "utf8")).resolves.toContain("@app/telemetry");
await expect(readFile(join(targetDir, "packages/telemetry/src/index.ts"), "utf8")).resolves.toContain("createAppEvent");
await expect(readFile(join(targetDir, "apps/web/src/index.ts"), "utf8")).resolves.toContain("createAppTelemetry");
```

- [ ] **Step 2: Verify generator tests fail**

Run:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
```

Expected: FAIL because the generated telemetry package/runtime helpers are missing.

- [ ] **Step 3: Implement generated runtime helpers**

Template runtime should expose:

```ts
export type RuntimeSurface = "web" | "mobile" | "convex";
export function createAppTelemetry(context: RuntimeContext) {
  return {
    event(definition, state, overrides = {}) {
      return createAppEvent(definition, { ...context, state, ...overrides });
    }
  };
}
```

Generated telemetry package should expose `appTelemetryEvents`, `AppTelemetryEvent`, `AppTelemetryDefinition`, `createAppEvent`, and default definitions for authentication, onboarding, and billing. Keep it provider-neutral and secret-free.

- [ ] **Step 4: Verify template tests pass and mirrors match**

Run:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

Expected: PASS and no diff output.

## Task 4: E2E Workflow And Docs

**Files:**
- Modify: `tests/e2e/prototype.test.ts`
- Modify: `README.md`
- Modify: `docs/spinup-site/telemetry.html`
- Modify: `docs/spinup-site/generated-app.html`
- Modify: `docs/spinup-site/workflows.html`
- Modify: `docs/spinup-site/timeline.html`
- Modify: generated `AGENTS.md`
- Modify: generated `docs/agentstack/observability.md`

- [ ] **Step 1: Extend e2e test**

After `add feature`, call:

```ts
await runAgentstack(
  ["add", "event", "billing.subscription.updated", "--journey", "billing", "--surfaces", "web,convex", "--state", "plan:string,seatCount:number"],
  { cwd: appDir, write }
);
```

Assert generated event file exists, validate passes after anchor registration, and `observe timeline --journey telemetry-generation --env development` includes `agentstack.event.added`.

- [ ] **Step 2: Verify e2e fails before implementation is complete**

Run:

```bash
pnpm vitest run tests/e2e/prototype.test.ts
```

Expected: FAIL until Tasks 1-3 land.

- [ ] **Step 3: Update docs after behavior is green**

Document:

- `agentstack add event ...`;
- typed generated event definitions;
- `createAppTelemetry(...).event(...)`;
- generated event docs under `docs/agentstack/events/`;
- local observe command for telemetry-generation.

Avoid claiming real OTLP provider export in this slice.

- [ ] **Step 4: Verify docs and e2e**

Run:

```bash
pnpm vitest run tests/e2e/prototype.test.ts
python3 - <<'PY'
from html.parser import HTMLParser
from pathlib import Path
root = Path('docs/spinup-site')
class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]
    def handle_starttag(self, tag, attrs):
        if tag in {'a','link','script'}:
            d=dict(attrs); v=d.get('href') or d.get('src')
            if v: self.links.append(v)
errors=[]
for path in sorted(root.glob('*.html')):
    p=P(); p.feed(path.read_text())
    for href in p.links:
        if href.startswith(('http://','https://','#','mailto:')): continue
        target=(path.parent / href.split('#')[0]).resolve()
        if href.split('#')[0] and not target.exists(): errors.append(f'{path}: missing {href}')
if errors:
    print('\n'.join(errors)); raise SystemExit(1)
print('spinup links ok')
PY
```

Expected: e2e passes and `spinup links ok`.

## Final Verification

Run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
git diff --check
```

Expected:
- install exits 0 with lockfile unchanged;
- typecheck exits 0;
- tests exit 0;
- template mirror diff has no output;
- diff check has no output.

## Self-Review

- Spec coverage: advances typed, versioned, redacted application telemetry primitives and agent-facing event generation.
- Placeholder scan: no implementation step delegates vague work without concrete expected behavior.
- Type consistency: `TelemetryEventSurface`, `TelemetryStateType`, generated event definitions, and runtime helper names are consistent across tasks.
