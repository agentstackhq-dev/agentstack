# Agentstack OTLP Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local OTLP JSON export rehearsal so agents can convert redacted wide events into a provider-neutral OpenTelemetry-shaped artifact without sending data to a hosted telemetry provider.

**Architecture:** The telemetry package owns pure wide-event to OTLP JSON conversion. The CLI owns querying redacted local JSONL events, writing `.agentstack/exports/telemetry-<env>-otlp.json`, and recording command telemetry. Generated apps expose package scripts and docs that explain the export is local-only and provider-neutral.

**Tech Stack:** TypeScript, Vitest, existing JSONL telemetry store, existing Agentstack CLI, deterministic B2B SaaS templates, static spin-up HTML.

---

## File Structure

- Create `packages/telemetry/src/otlp.ts` for OTLP JSON request types and conversion helpers.
- Add/modify telemetry tests in `packages/telemetry/src/events.test.ts` or `packages/telemetry/src/otlp.test.ts`.
- Modify `packages/telemetry/src/index.ts` to export OTLP helpers.
- Modify `packages/cli/src/run.ts` and `packages/cli/src/run.test.ts` for `agentstack observe export --env <env> --format otlp-json`.
- Modify `tests/e2e/prototype.test.ts` to export preview or production telemetry after journeys exist.
- Modify generated template package scripts and observability docs in both template roots.
- Modify `packages/create-agent-stack/src/generate.test.ts`, `README.md`, and `docs/spinup-site/`.

## Task 1: Telemetry OTLP Conversion

**Files:**
- Create: `packages/telemetry/src/otlp.ts`
- Create: `packages/telemetry/src/otlp.test.ts`
- Modify: `packages/telemetry/src/index.ts`

- [x] **Step 1: Write failing OTLP conversion tests**

```ts
import { describe, expect, it } from "vitest";
import { createWideEvent, redactEvent } from "./events.js";
import { wideEventsToOtlpLogsRequest } from "./otlp.js";

describe("OTLP log export", () => {
  it("converts redacted wide events into an OTLP logs request", () => {
    const event = redactEvent(
      createWideEvent("billing.subscription.updated", {
        environment: "production",
        surface: "convex",
        component: "convex:billing",
        status: "ok",
        journey: "billing",
        traceId: "trace_billing_123",
        correlationId: "corr_billing_123",
        state: {
          plan: "pro",
          email: "buyer@example.com"
        }
      })
    );

    const request = wideEventsToOtlpLogsRequest([event], {
      serviceName: "agentstack-app",
      serviceVersion: "0.0.0"
    });

    expect(request.resourceLogs[0]?.resource.attributes).toEqual(
      expect.arrayContaining([
        { key: "service.name", value: { stringValue: "agentstack-app" } },
        { key: "service.version", value: { stringValue: "0.0.0" } }
      ])
    );
    expect(request.resourceLogs[0]?.scopeLogs[0]?.logRecords[0]).toMatchObject({
      body: { stringValue: "billing.subscription.updated" },
      severityText: "INFO"
    });
    expect(request.resourceLogs[0]?.scopeLogs[0]?.logRecords[0]?.attributes).toEqual(
      expect.arrayContaining([
        { key: "agentstack.environment", value: { stringValue: "production" } },
        { key: "agentstack.surface", value: { stringValue: "convex" } },
        { key: "agentstack.state.email", value: { stringValue: "[redacted]" } }
      ])
    );
  });
});
```

- [x] **Step 2: Verify red**

Run: `pnpm exec vitest run packages/telemetry/src/otlp.test.ts`

Expected: fail because `otlp.ts` does not exist.

- [x] **Step 3: Implement pure conversion helpers**

Implement `wideEventsToOtlpLogsRequest(events, options)` with a minimal OTLP JSON shape:

- `resourceLogs[0].resource.attributes` includes `service.name`, optional `service.version`, and `telemetry.sdk.name = agentstack`.
- `scopeLogs[0].scope.name = agentstack.telemetry`.
- Each `WideEvent` becomes a log record with `timeUnixNano`, `observedTimeUnixNano`, `severityText`, `body.stringValue = event.name`, and flattened attributes for event metadata and state.
- Do not send network requests.

- [x] **Step 4: Export and verify**

Add `export * from "./otlp.js";` to `packages/telemetry/src/index.ts`.

Run: `pnpm exec vitest run packages/telemetry/src/otlp.test.ts`

Expected: OTLP conversion tests pass.

## Task 2: CLI Observe Export Command

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [x] **Step 1: Write failing CLI tests**

Add a test that appends a local event, then runs:

```ts
const code = await runAgentstack(["observe", "export", "--env", "preview", "--format", "otlp-json"], {
  cwd: dir,
  write: (line) => output.push(line)
});

expect(code).toBe(0);
expect(output).toContain("EXPORTED observe otlp-json preview 1");
expect(output.join("\n")).toContain(".agentstack/exports/telemetry-preview-otlp.json");
await expect(readFile(join(dir, ".agentstack", "exports", "telemetry-preview-otlp.json"), "utf8")).resolves.toContain(
  '"resourceLogs"'
);
```

Also test unsupported format returns `FAIL observe.export.format.unsupported`.

- [x] **Step 2: Verify red**

Run: `pnpm exec vitest run packages/cli/src/run.test.ts`

Expected: fail because `observe export` is not implemented.

- [x] **Step 3: Implement CLI export**

In `observeCommand`, add an `export` mode:

- requires `--env`;
- defaults `--format` to `otlp-json`;
- supports only `otlp-json`;
- queries redacted timeline from `.agentstack/events.jsonl`;
- writes `.agentstack/exports/telemetry-<env>-otlp.json`;
- prints `EXPORTED observe otlp-json <env> <count>` and the artifact path;
- records `agentstack.observe.export.completed` telemetry after writing the artifact.

- [x] **Step 4: Verify CLI tests**

Run: `pnpm exec vitest run packages/cli/src/run.test.ts`

Expected: CLI tests pass.

## Task 3: Templates, Docs, E2E, And Spin-Up

**Files:**
- Modify: `templates/b2b-saas/package.json`
- Modify: `packages/create-agent-stack/templates/b2b-saas/package.json`
- Modify: `templates/b2b-saas/docs/agentstack/observability.md`
- Modify: mirrored observability docs
- Modify: `templates/b2b-saas/skills/agentstack/references/observability.md`
- Modify: mirrored skill reference
- Modify: `packages/create-agent-stack/src/generate.test.ts`
- Modify: `tests/e2e/prototype.test.ts`
- Modify: `README.md`
- Modify: `docs/spinup-site/telemetry.html`, `generated-app.html`, `timeline.html`, `assets/site.js`

- [x] **Step 1: Write failing generator/e2e expectations**

Add package script expectations:

```ts
"telemetry:export:preview": "node scripts/agentstack.mjs observe export --env preview --format otlp-json",
"telemetry:export:production": "node scripts/agentstack.mjs observe export --env production --format otlp-json"
```

Extend e2e after telemetry events exist:

```ts
expect(await runAgentstack(["observe", "export", "--env", "preview", "--format", "otlp-json"], { cwd: appDir, write })).toBe(0);
await expect(readFile(join(appDir, ".agentstack/exports/telemetry-preview-otlp.json"), "utf8")).resolves.toContain(
  '"resourceLogs"'
);
```

- [x] **Step 2: Update docs and scripts**

Generated observability docs should say:

- local JSONL remains the source of local inspection;
- `observe export --env preview --format otlp-json` writes a local OTLP-shaped JSON artifact;
- no network export or hosted provider is configured by default;
- artifacts are redacted because they are built from redacted store query output.

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

Actual:

- `pnpm install --frozen-lockfile` exited 0.
- `pnpm typecheck && pnpm test && diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas && git diff --check && node --check docs/spinup-site/assets/site.js && curl -fsS http://127.0.0.1:8765/index.html >/tmp/agentstack-site-index.html` exited 0.
- Full test suite passed with 18 test files and 208 tests.
- Spec re-review reported compliant.
- Code-quality re-review reported ready to merge with no remaining issues.

- [x] **Step 4: Commit**

Run:

```bash
git status --short
git add README.md docs packages templates tests
git commit -m "feat: add local otlp telemetry export"
git status --short
```

Expected: commit succeeds and worktree is clean.
