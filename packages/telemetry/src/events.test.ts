import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  compareEventCountsByEnvironment,
  createWideEvent,
  eventNameMatches,
  groupErrorEvents,
  isErrorEvent,
  JsonlTelemetryStore,
  parseSinceWindow,
  redactEvent
} from "./index.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentstack-telemetry-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("wide telemetry events", () => {
  it("creates correlated wide events", () => {
    const event = createWideEvent("billing.subscription.updated", {
      environment: "preview",
      surface: "convex",
      journey: "billing",
      actorId: "user_123",
      orgId: "org_123",
      correlationId: "corr_123",
      state: { plan: "pro" }
    });

    expect(event.name).toBe("billing.subscription.updated");
    expect(event.traceId).toMatch(/^trace_/);
    expect(event.state).toEqual({ plan: "pro" });
  });

  it("creates timeline-friendly metadata fields when provided", () => {
    const event = createWideEvent("cli.validate.completed", {
      environment: "preview",
      surface: "cli",
      schemaVersion: "wide.v2",
      component: "cli",
      command: "validate --cloud --env preview",
      status: "ok",
      correlationId: "corr_123"
    });

    expect(event).toMatchObject({
      schemaVersion: "wide.v2",
      component: "cli",
      command: "validate --cloud --env preview",
      status: "ok"
    });
  });

  it("redacts secret-like state values", () => {
    const event = createWideEvent("auth.session.created", {
      environment: "production",
      surface: "web",
      journey: "authentication",
      actorId: "user_123",
      correlationId: "corr_123",
      state: {
        email: "person@example.com",
        CLERK_SECRET_KEY: "sk_live_secret",
        nested: { token: "abc123", owner: "owner@example.com", reference: "pk_test_123" }
      }
    });

    expect(redactEvent(event).state).toEqual({
      email: "[redacted]",
      CLERK_SECRET_KEY: "[redacted]",
      nested: { token: "[redacted]", owner: "[redacted]", reference: "[redacted]" }
    });
  });

  it("stores and queries redacted events", async () => {
    const store = new JsonlTelemetryStore(join(dir, "events.jsonl"));
    await store.append(
      createWideEvent("billing.subscription.updated", {
        environment: "preview",
        surface: "convex",
        journey: "billing",
        actorId: "user_123",
        correlationId: "corr_123",
        state: { plan: "pro", token: "secret-token" }
      })
    );

    const events = await store.query({ environment: "preview", event: "billing.*" });
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe("billing.subscription.updated");
    expect(events[0]?.actorId).toBe("[redacted]");
    expect(events[0]?.state).toEqual({ plan: "pro", token: "[redacted]" });
  });

  it("returns a redacted filtered timeline sorted chronologically", async () => {
    const store = new JsonlTelemetryStore(join(dir, "events.jsonl"));
    await store.append({
      ...createWideEvent("cli.validate.completed", {
        environment: "preview",
        surface: "cli",
        journey: "validation",
        actorId: "user_123",
        correlationId: "corr_123",
        state: { apiKey: "sk_live_secret" }
      }),
      timestamp: "2026-06-20T10:00:03.000Z"
    });
    await store.append({
      ...createWideEvent("cli.env.inspect.started", {
        environment: "preview",
        surface: "cli",
        journey: "validation",
        actorId: "user_456",
        correlationId: "corr_456",
        state: { email: "person@example.com" }
      }),
      timestamp: "2026-06-20T10:00:01.000Z"
    });
    await store.append({
      ...createWideEvent("cli.validate.completed", {
        environment: "production",
        surface: "cli",
        journey: "validation",
        correlationId: "corr_789"
      }),
      timestamp: "2026-06-20T10:00:02.000Z"
    });

    const events = await store.timeline({ environment: "preview", journey: "validation" });

    expect(events.map((event) => event.name)).toEqual([
      "cli.env.inspect.started",
      "cli.validate.completed"
    ]);
    expect(events.map((event) => event.actorId)).toEqual(["[redacted]", "[redacted]"]);
    expect(events.map((event) => event.state)).toEqual([
      { email: "[redacted]" },
      { apiKey: "[redacted]" }
    ]);
  });

  it("preserves concurrent appends", async () => {
    const store = new JsonlTelemetryStore(join(dir, "events.jsonl"));
    const eventNames = Array.from(
      { length: 25 },
      (_, index) => `billing.subscription.updated.${index.toString().padStart(2, "0")}`
    );

    await Promise.all(
      eventNames.map((name) =>
        store.append(
          createWideEvent(name, {
            environment: "preview",
            surface: "convex",
            journey: "billing",
            correlationId: `corr_${name}`,
            state: { sequence: name }
          })
        )
      )
    );

    const events = await store.query({ environment: "preview", event: "billing.*" });
    expect(events.map((event) => event.name).sort()).toEqual(eventNames);
  });

  it("reports malformed JSONL with a line number", async () => {
    const path = join(dir, "events.jsonl");
    const validEvent = createWideEvent("billing.subscription.updated", {
      environment: "preview",
      surface: "convex",
      correlationId: "corr_valid"
    });
    await writeFile(path, `${JSON.stringify(validEvent)}\n{not-json}\n`, "utf8");

    const store = new JsonlTelemetryStore(path);
    await expect(store.query({ environment: "preview" })).rejects.toThrow(
      /Invalid telemetry JSONL at line 2:/
    );
  });

  it("matches event names by exact value and wildcard prefix", () => {
    expect(eventNameMatches("billing.subscription.updated", "billing.subscription.updated")).toBe(
      true
    );
    expect(eventNameMatches("billing.subscription.updated", "billing.*")).toBe(true);
    expect(eventNameMatches("auth.session.created", "billing.*")).toBe(false);
  });

  it("filters by component, release, actor, command, error class, and since window", async () => {
    const store = new JsonlTelemetryStore(join(dir, "events.jsonl"));
    await store.append({
      ...createWideEvent("billing.webhook.failed", {
        environment: "production",
        surface: "convex",
        component: "convex:billing.applySubscriptionUpdate",
        command: "observe errors",
        status: "error",
        journey: "billing",
        actorId: "user_123",
        releaseId: "rel_2026_06_20",
        correlationId: "corr_error",
        state: {
          errorClass: "WebhookSignatureError",
          token: "secret-token"
        }
      }),
      timestamp: "2026-06-20T10:00:00.000Z"
    });
    await store.append({
      ...createWideEvent("billing.webhook.failed", {
        environment: "production",
        surface: "convex",
        component: "convex:billing.applySubscriptionUpdate",
        command: "observe errors",
        status: "error",
        journey: "billing",
        actorId: "user_123",
        releaseId: "rel_2026_06_20",
        correlationId: "corr_old",
        state: { errorClass: "WebhookSignatureError" }
      }),
      timestamp: "2026-06-20T09:00:00.000Z"
    });
    await store.append({
      ...createWideEvent("billing.webhook.failed", {
        environment: "production",
        surface: "convex",
        component: "convex:billing.reconcile",
        command: "observe errors",
        status: "error",
        journey: "billing",
        actorId: "user_456",
        releaseId: "rel_2026_06_20",
        correlationId: "corr_other",
        state: { errorClass: "ReconcileError" }
      }),
      timestamp: "2026-06-20T10:05:00.000Z"
    });

    const events = await store.query({
      environment: "production",
      component: "convex:billing.applySubscriptionUpdate",
      releaseId: "rel_2026_06_20",
      actorId: "user_123",
      command: "observe errors",
      since: "2026-06-20T09:30:00.000Z",
      errorClass: "WebhookSignatureError"
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      name: "billing.webhook.failed",
      actorId: "[redacted]",
      component: "convex:billing.applySubscriptionUpdate"
    });
    expect(events[0]?.state).toMatchObject({
      errorClass: "WebhookSignatureError",
      token: "[redacted]"
    });
  });

  it("parses relative since windows and rejects unsupported windows", () => {
    const now = new Date("2026-06-20T12:00:00.000Z");

    expect(parseSinceWindow("15m", now).toISOString()).toBe("2026-06-20T11:45:00.000Z");
    expect(parseSinceWindow("2h", now).toISOString()).toBe("2026-06-20T10:00:00.000Z");
    expect(parseSinceWindow("7d", now).toISOString()).toBe("2026-06-13T12:00:00.000Z");
    expect(parseSinceWindow("2026-06-20T09:30:00.000Z", now).toISOString()).toBe(
      "2026-06-20T09:30:00.000Z"
    );
    expect(() => parseSinceWindow("yesterday", now)).toThrow(/Invalid since window/);
  });

  it("identifies and groups redacted error events", () => {
    const events = [
      createWideEvent("billing.webhook.failed", {
        environment: "production",
        surface: "convex",
        component: "convex:billing.applySubscriptionUpdate",
        status: "error",
        correlationId: "corr_1",
        state: { errorClass: "WebhookSignatureError", secret: "secret-token" }
      }),
      createWideEvent("billing.webhook.failed", {
        environment: "production",
        surface: "convex",
        component: "convex:billing.applySubscriptionUpdate",
        status: "failed",
        correlationId: "corr_2",
        state: { error: { class: "WebhookSignatureError" } }
      }),
      createWideEvent("billing.webhook.completed", {
        environment: "preview",
        surface: "convex",
        component: "convex:billing.applySubscriptionUpdate",
        status: "ok",
        correlationId: "corr_3"
      })
    ];

    expect(events.map(isErrorEvent)).toEqual([true, true, false]);
    expect(groupErrorEvents(events)).toEqual([
      {
        component: "convex:billing.applySubscriptionUpdate",
        event: "billing.webhook.failed",
        surface: "convex",
        environment: "production",
        errorClass: "WebhookSignatureError",
        count: 2
      }
    ]);
  });

  it("compares event counts across environments for a journey and event family", () => {
    const events = [
      createWideEvent("onboarding.started", {
        environment: "preview",
        surface: "web",
        journey: "onboarding",
        correlationId: "corr_1"
      }),
      createWideEvent("onboarding.completed", {
        environment: "preview",
        surface: "web",
        journey: "onboarding",
        correlationId: "corr_2"
      }),
      createWideEvent("onboarding.started", {
        environment: "production",
        surface: "web",
        journey: "onboarding",
        correlationId: "corr_3"
      }),
      createWideEvent("billing.started", {
        environment: "production",
        surface: "web",
        journey: "billing",
        correlationId: "corr_4"
      })
    ];

    expect(
      compareEventCountsByEnvironment(events, {
        environments: ["preview", "production"],
        journey: "onboarding",
        event: "onboarding.*"
      })
    ).toEqual([
      { environment: "preview", count: 2 },
      { environment: "production", count: 1 }
    ]);
  });
});
