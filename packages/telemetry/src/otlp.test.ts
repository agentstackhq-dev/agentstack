import { describe, expect, it } from "vitest";
import { createWideEvent, redactEvent, wideEventsToOtlpLogsRequest } from "./index.js";

describe("OTLP logs conversion", () => {
  it("converts redacted wide events into an OTLP-shaped logs request", () => {
    const event = redactEvent(
      createWideEvent("billing.subscription.updated", {
        environment: "production",
        surface: "convex",
        component: "convex:billing",
        status: "ok",
        journey: "billing",
        traceId: "trace_billing_123",
        correlationId: "corr_billing_123",
        state: { plan: "pro", email: "buyer@example.com" }
      })
    );

    const request = wideEventsToOtlpLogsRequest([event], {
      serviceName: "agentstack-app",
      serviceVersion: "0.0.0"
    });

    const resourceAttributes = request.resourceLogs[0]?.resource.attributes;
    expect(resourceAttributes).toEqual(
      expect.arrayContaining([
        { key: "service.name", value: { stringValue: "agentstack-app" } },
        { key: "service.version", value: { stringValue: "0.0.0" } },
        { key: "telemetry.sdk.name", value: { stringValue: "agentstack" } }
      ])
    );

    const scopeLog = request.resourceLogs[0]?.scopeLogs[0];
    expect(scopeLog?.scope.name).toBe("agentstack.telemetry");

    const logRecord = scopeLog?.logRecords[0];
    expect(logRecord?.body).toEqual({ stringValue: event.name });
    expect(logRecord?.severityText).toBe("INFO");
    expect(logRecord?.attributes).toEqual(
      expect.arrayContaining([
        { key: "agentstack.environment", value: { stringValue: "production" } },
        { key: "agentstack.surface", value: { stringValue: "convex" } },
        { key: "agentstack.state.email", value: { stringValue: "[redacted]" } }
      ])
    );
  });

  it("reports invalid event timestamps with context", () => {
    const event = {
      ...createWideEvent("billing.subscription.updated", {
        environment: "production",
        surface: "convex",
        state: {}
      }),
      timestamp: "not-a-timestamp"
    };

    expect(() =>
      wideEventsToOtlpLogsRequest([event], {
        serviceName: "agentstack-app"
      })
    ).toThrow("Invalid telemetry timestamp for billing.subscription.updated: not-a-timestamp");
  });
});
