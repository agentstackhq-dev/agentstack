import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createWideEvent, JsonlTelemetryStore, redactEvent } from "./index.js";

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
        nested: { token: "abc123" }
      }
    });

    expect(redactEvent(event).state).toEqual({
      email: "[redacted]",
      CLERK_SECRET_KEY: "[redacted]",
      nested: { token: "[redacted]" }
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
        state: { plan: "pro" }
      })
    );

    const events = await store.query({ environment: "preview", event: "billing.*" });
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe("billing.subscription.updated");
  });
});
