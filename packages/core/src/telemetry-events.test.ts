import { describe, expect, it } from "vitest";
import { parseTelemetryEventName, planTelemetryEventFiles } from "./telemetry-events.js";

describe("telemetry event planning", () => {
  it("plans deterministic event and docs files for a typed telemetry event", () => {
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
    expect(plan.journey).toBe("billing");
    expect(plan.surfaces).toEqual(["web", "convex"]);
    expect(plan.state).toEqual([
      { key: "plan", type: "string" },
      { key: "seatCount", type: "number" }
    ]);
    expect(plan.files.map((file) => file.path)).toEqual([
      "packages/telemetry/src/events/billing-subscription-updated.ts",
      "docs/agentstack/events/billing-subscription-updated.md"
    ]);
    expect(plan.files[0]?.content).toContain(
      'import type { AppTelemetryDefinition } from "../events.js";'
    );
    expect(plan.files[0]?.content).toContain("billing.subscription.updated");
    expect(plan.files[0]?.content).toContain('plan: "string"');
    expect(plan.files[0]?.content).toContain('schemaVersion: "app.event.v1"');
    expect(plan.files[0]?.content).toContain("satisfies AppTelemetryDefinition");
    expect(plan.files[1]?.content).toContain("# billing.subscription.updated");
  });

  it("parses lowercase dot-separated event names", () => {
    expect(parseTelemetryEventName("billing.subscription.updated")).toEqual({
      input: "billing.subscription.updated",
      slug: "billing-subscription-updated",
      camel: "billingSubscriptionUpdated",
      constName: "billingSubscriptionUpdatedEvent"
    });
  });

  it("rejects invalid event names with actionable errors", () => {
    expect(() => parseTelemetryEventName("Billing Updated")).toThrow(
      /lowercase dot-separated identifiers/
    );
  });

  it("rejects unsupported surfaces", () => {
    expect(() =>
      planTelemetryEventFiles("billing.subscription.updated", {
        journey: "billing",
        surfaces: ["web", "desktop"],
        state: ["plan:string"]
      })
    ).toThrow(/Unsupported telemetry event surface "desktop"/);
  });

  it("rejects unsupported state types", () => {
    expect(() =>
      planTelemetryEventFiles("billing.subscription.updated", {
        journey: "billing",
        surfaces: ["web"],
        state: ["plan:currency"]
      })
    ).toThrow(/Unsupported telemetry state type "currency"/);
  });
});
