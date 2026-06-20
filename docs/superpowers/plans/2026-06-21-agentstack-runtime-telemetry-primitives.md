# Agentstack Runtime Telemetry Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand generated app telemetry from event-only envelopes into lean, agent-facing runtime primitives for typed events, spans, journeys, identity context, and redaction.

**Architecture:** Generated `@app/telemetry` remains the typed envelope layer. Generated `@app/agentstack-runtime` wraps it with ergonomic `createAppTelemetry(runtime)` methods that agents can use from web, mobile, and Convex product code. The implementation remains local and provider-neutral; it does not add hosted telemetry or network export.

**Tech Stack:** TypeScript, generated B2B SaaS template, Vitest generator tests, existing local observability docs and skills.

---

## File Structure

- Modify `templates/b2b-saas/packages/telemetry/src/index.ts` and the mirrored package template to add redacted event/span/journey envelope helpers.
- Modify `templates/b2b-saas/packages/agentstack-runtime/src/index.ts` and the mirrored package template to expose `event`, `span`, `journey`, `identify`, and `redact`.
- Modify `templates/b2b-saas/apps/web/src/index.ts`, `templates/b2b-saas/apps/mobile/src/index.ts`, and `templates/b2b-saas/convex/agentstack.ts` plus mirrors to use the richer runtime anchors.
- Modify `packages/create-agent-stack/src/generate.test.ts` to assert the generated primitives exist and typecheck in isolation.
- Modify `templates/b2b-saas/docs/agentstack/observability.md`, `templates/b2b-saas/skills/agentstack/references/observability.md`, and mirrors to document the new app-facing primitives.
- Optionally update `README.md` and `docs/spinup-site/telemetry.html` if the public spin-up material needs the new primitive names.

## Task 1: Generated Telemetry Envelope Primitives

**Files:**
- Modify: `templates/b2b-saas/packages/telemetry/src/index.ts`
- Modify: `packages/create-agent-stack/templates/b2b-saas/packages/telemetry/src/index.ts`
- Modify: `packages/create-agent-stack/src/generate.test.ts`

- [x] **Step 1: Write failing generator expectations**

In `packages/create-agent-stack/src/generate.test.ts`, extend the first generation test so the generated telemetry index must contain:

```ts
expect(telemetryIndex).toContain("createAppSpan");
expect(telemetryIndex).toContain("createAppJourney");
expect(telemetryIndex).toContain("redactAppTelemetryState");
expect(telemetryIndex).toContain("AppTelemetrySpanEnvelope");
expect(telemetryIndex).toContain("AppTelemetryJourneyEnvelope");
```

Add a new isolation typecheck test that compiles:

```ts
const files = [
  join(targetDir, "packages/telemetry/src/events.ts"),
  join(targetDir, "packages/telemetry/src/events/index.ts"),
  join(targetDir, "packages/telemetry/src/index.ts"),
  join(targetDir, "packages/agentstack-runtime/src/index.ts"),
  join(targetDir, "apps/web/src/index.ts"),
  join(targetDir, "apps/mobile/src/index.ts"),
  join(targetDir, "convex/agentstack.ts")
];
```

Run:

```bash
pnpm exec vitest run packages/create-agent-stack/src/generate.test.ts
```

Expected: fail because the new telemetry helpers do not exist yet.

- [x] **Step 2: Add telemetry helper types and redaction**

In both telemetry template copies, preserve typed event input validation while making emitted states redacted and JSON-serializable:

```ts
export type AppTelemetryIdentity = {
  actorId?: string;
  orgId?: string;
  journeyId?: string;
  releaseId?: string;
};

export type AppTelemetryStatus = "ok" | "error" | "pending" | "info" | "warn";

export type AppTelemetrySerializableState = Record<string, JsonValue>;

export type AppTelemetryEnvelope<
  TDefinition extends AppTelemetryDefinition = AppTelemetryDefinition
> = AppTelemetryContext & AppTelemetryIdentity & {
  kind: "event";
  name: TDefinition["name"];
  journey: TDefinition["journey"];
  schemaVersion: TDefinition["schemaVersion"];
  state: AppTelemetrySerializableState;
  occurredAt: string;
};
```

Add redaction helpers:

```ts
const sensitiveKeyPattern = /(secret|token|password|email|key|authorization|cookie|session|jwt|phone|ip)/i;
const sensitiveStringPattern = /(^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$)|((sk|pk)_(live|test)_[A-Za-z0-9_-]+)|([A-Za-z0-9_-]*(secret|token|password|jwt|api[_-]?key)[A-Za-z0-9_-]*)/i;

export function redactAppTelemetryValue(key: string, value: JsonValue): JsonValue {
  if (sensitiveKeyPattern.test(key)) return "[redacted]";
  if (typeof value === "string" && sensitiveStringPattern.test(value)) return "[redacted]";
  if (Array.isArray(value)) return value.map((item) => redactAppTelemetryValue(key, item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactAppTelemetryValue(childKey, childValue)
      ])
    ) as JsonValue;
  }
  return value;
}

export function redactAppTelemetryState(state: AppTelemetrySerializableState): AppTelemetrySerializableState {
  return Object.fromEntries(
    Object.entries(state).map(([key, value]) => [key, redactAppTelemetryValue(key, value)])
  );
}
```

- [x] **Step 3: Add event, span, and journey factories**

Update `createAppEvent` to include `kind: "event"` and `AppTelemetryIdentity`, and redact the emitted state:

```ts
export function createAppEvent<TDefinition extends AppTelemetryDefinition>(
  definition: TDefinition,
  input: AppTelemetryContext & AppTelemetryIdentity & {
    state: AppTelemetryState<TDefinition>;
    occurredAt?: string;
  }
): AppTelemetryEnvelope<TDefinition> {
  return {
    appSlug: input.appSlug,
    environment: input.environment,
    surface: input.surface,
    correlationId: input.correlationId,
    traceId: input.traceId,
    actorId: input.actorId,
    orgId: input.orgId,
    journeyId: input.journeyId,
    releaseId: input.releaseId,
    kind: "event",
    name: definition.name,
    journey: definition.journey,
    schemaVersion: definition.schemaVersion,
    state: redactAppTelemetryState(input.state),
    occurredAt: input.occurredAt ?? new Date().toISOString()
  };
}
```

Add:

```ts
export type AppTelemetrySpanEnvelope = AppTelemetryContext & AppTelemetryIdentity & {
  kind: "span";
  name: string;
  spanId: string;
  parentSpanId?: string;
  status: AppTelemetryStatus;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  state: AppTelemetrySerializableState;
};

export type AppTelemetryJourneyEnvelope = AppTelemetryContext & AppTelemetryIdentity & {
  kind: "journey";
  journey: string;
  phase: string;
  status: AppTelemetryStatus;
  occurredAt: string;
  state: AppTelemetrySerializableState;
};

export function createAppSpan(
  name: string,
  input: AppTelemetryContext & AppTelemetryIdentity & {
    state?: AppTelemetrySerializableState;
    spanId?: string;
    parentSpanId?: string;
    status?: AppTelemetryStatus;
    startedAt?: string;
    endedAt?: string;
    durationMs?: number;
  }
): AppTelemetrySpanEnvelope { ... }

export function createAppJourney(
  journey: string,
  phase: string,
  input: AppTelemetryContext & AppTelemetryIdentity & {
    state?: AppTelemetrySerializableState;
    status?: AppTelemetryStatus;
    occurredAt?: string;
  }
): AppTelemetryJourneyEnvelope { ... }
```

Use simple deterministic defaults that do not require Node-only APIs:

```ts
const createTelemetryId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
```

- [x] **Step 4: Verify generator tests still fail only on runtime wrappers**

Run:

```bash
pnpm exec vitest run packages/create-agent-stack/src/generate.test.ts
```

Expected: telemetry helper string expectations pass, but runtime wrapper expectations from Task 2 are still absent if Task 2 has not run.

## Task 2: Runtime Wrapper And Surface Anchors

**Files:**
- Modify: `templates/b2b-saas/packages/agentstack-runtime/src/index.ts`
- Modify: `packages/create-agent-stack/templates/b2b-saas/packages/agentstack-runtime/src/index.ts`
- Modify: `templates/b2b-saas/apps/web/src/index.ts`
- Modify: `templates/b2b-saas/apps/mobile/src/index.ts`
- Modify: `templates/b2b-saas/convex/agentstack.ts`
- Modify mirrored web/mobile/Convex files
- Modify: `packages/create-agent-stack/src/generate.test.ts`

- [x] **Step 1: Write failing runtime expectations**

Extend generator tests so generated runtime and surface anchors must contain:

```ts
expect(runtimeIndex).toContain("identify(identity");
expect(runtimeIndex).toContain("span(name");
expect(runtimeIndex).toContain("journey(journey");
expect(runtimeIndex).toContain("redact(state");
expect(webIndex).toContain("webOnboardingSpanAnchor");
expect(webIndex).toContain("webOnboardingJourneyAnchor");
expect(mobileIndex).toContain("mobileAuthenticationSpanAnchor");
expect(convexIndex).toContain("convexBillingJourneyAnchor");
```

Run:

```bash
pnpm exec vitest run packages/create-agent-stack/src/generate.test.ts
```

Expected: fail because runtime wrappers and anchors do not exist.

- [x] **Step 2: Implement runtime wrapper methods**

In both runtime template copies, import the new helpers:

```ts
import {
  createAppEvent,
  createAppJourney,
  createAppSpan,
  redactAppTelemetryState,
  type AppTelemetryDefinition,
  type AppTelemetryIdentity,
  type AppTelemetrySerializableState,
  type AppTelemetryState,
  type AppTelemetryStatus
} from "../../telemetry/src/index.js";
```

Extend `RuntimeContext`:

```ts
export type RuntimeContext = {
  appSlug: string;
  environment: "development" | "preview" | "production";
  surface: RuntimeSurface;
  correlationId?: string;
  traceId?: string;
} & AppTelemetryIdentity;
```

Expose these methods from `createAppTelemetry(context)`:

```ts
identify(identity: AppTelemetryIdentity) {
  return createAppTelemetry({ ...context, ...identity });
},
event(definition, state, overrides = {}) { ... },
span(name, state = {}, overrides = {}) { ... },
journey(journey, phase, state = {}, overrides = {}) { ... },
redact(state) {
  return redactAppTelemetryState(state);
}
```

The `event`, `span`, and `journey` methods must pass context identity and override identity into the telemetry factories. Override fields should win over context fields.

- [x] **Step 3: Update generated surface anchors**

Update web, mobile, and Convex anchors to demonstrate the richer primitives without adding real provider behavior:

```ts
export const webTelemetryForDemoActor = webTelemetry.identify({
  actorId: "demo-user",
  orgId: "demo-org",
  journeyId: "journey_onboarding_demo"
});

export const webOnboardingSpanAnchor = webTelemetryForDemoActor.span("web.onboarding.render", {
  screen: "onboarding"
});

export const webOnboardingJourneyAnchor = webTelemetryForDemoActor.journey(
  "onboarding",
  "workspace-created",
  { workspaceId: "demo-workspace", email: "founder@example.com" }
);
```

Use equivalent anchors for mobile authentication and Convex billing. Include at least one sensitive field in an anchor state so generated code proves redaction behavior is available.

- [x] **Step 4: Verify generated telemetry typecheck**

Run:

```bash
pnpm exec vitest run packages/create-agent-stack/src/generate.test.ts
```

Expected: generator tests pass, including the new generated telemetry/runtime typecheck.

## Task 3: Docs, Skills, E2E, And Commit Gate

**Files:**
- Modify: `templates/b2b-saas/docs/agentstack/observability.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/observability.md`
- Modify: `templates/b2b-saas/skills/agentstack/references/observability.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/skills/agentstack/references/observability.md`
- Modify: `README.md`
- Modify: `docs/spinup-site/telemetry.html`
- Modify: `tests/e2e/prototype.test.ts` if the smoke should assert the generated primitive names

- [x] **Step 1: Update docs and skill references**

Document the app-facing runtime primitives:

```ts
const telemetry = createAppTelemetry(runtime).identify({
  actorId: "user_123",
  orgId: "org_123",
  journeyId: "journey_onboarding_123"
});

telemetry.event(billingSubscriptionUpdatedEvent, { plan: "team", seatCount: 5 });
telemetry.span("convex.billing.applySubscriptionUpdate", { plan: "team" });
telemetry.journey("billing", "subscription-updated", { plan: "team" });
telemetry.redact({ email: "person@example.com" });
```

State clearly:

- primitives create provider-neutral local envelopes;
- state is redacted before it appears in generated telemetry envelopes;
- this does not configure network export or hosted provider ingestion;
- CLI inspection still reads `.agentstack/events.jsonl` in this prototype.

- [x] **Step 2: Update smoke expectations if needed**

If the e2e smoke currently reads generated web/mobile/Convex telemetry anchors, add assertions for:

```ts
expect(webIndex).toContain("webOnboardingSpanAnchor");
expect(webIndex).toContain("webOnboardingJourneyAnchor");
expect(convexAgentstack).toContain("convexBillingJourneyAnchor");
```

Run:

```bash
pnpm exec vitest run tests/e2e/prototype.test.ts
```

Expected: e2e passes.

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

Run final subagent quality review, fix all blocking findings, rerun the relevant gate, then commit:

```bash
git status --short
git add README.md docs packages templates tests
git commit -m "feat: add runtime telemetry primitives"
git status --short
```

Expected: commit succeeds and worktree is clean.

## Completion Evidence

Implementation used separate subagent workers for generated telemetry/runtime code and docs/skill/spin-up updates. Final code-quality review returned `FINAL_QUALITY_APPROVED`.

Focused verification run:

```bash
pnpm exec vitest run packages/create-agent-stack/src/generate.test.ts tests/e2e/prototype.test.ts
pnpm typecheck
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
git diff --check
```

Focused results:

- Generator and e2e tests passed: 2 files, 11 tests.
- TypeScript passed with `tsc -p tsconfig.base.json --noEmit`.
- Template mirror diff passed with no output.
- Git diff whitespace check passed.

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

- Frozen install passed with lockfile up to date.
- TypeScript passed with `tsc -p tsconfig.base.json --noEmit`.
- Vitest passed: 18 files, 231 tests.
- Template mirror diff passed with no output.
- Git diff whitespace check passed.
- Spin-up site JavaScript parsed successfully.
- LAN-served spin-up site index responded successfully.
