import { describe, expect, it } from "vitest";
import {
  buildTelemetryCompareInspection,
  buildTelemetryErrorInspection,
  buildTelemetryJourneyInspection,
  buildTelemetryTimelineInspection,
  type WideEvent
} from "./index.js";

function event(overrides: Partial<WideEvent>): WideEvent {
  return {
    id: overrides.id ?? `evt_${overrides.name ?? "event"}`,
    name: overrides.name ?? "app.event",
    timestamp: overrides.timestamp ?? "2026-06-20T10:00:00.000Z",
    environment: overrides.environment ?? "preview",
    surface: overrides.surface ?? "web",
    component: overrides.component,
    command: overrides.command,
    status: overrides.status,
    journey: overrides.journey,
    traceId: overrides.traceId ?? "trace_1",
    correlationId: overrides.correlationId ?? "corr_1",
    journeyId: overrides.journeyId,
    actorId: overrides.actorId,
    orgId: overrides.orgId,
    releaseId: overrides.releaseId,
    state: overrides.state ?? {}
  };
}

describe("telemetry inspection", () => {
  it("summarizes counts, pivots, time range, and timeline metadata", () => {
    const inspection = buildTelemetryTimelineInspection([
      event({
        name: "billing.started",
        timestamp: "2026-06-20T10:00:02.000Z",
        environment: "production",
        surface: "convex",
        component: "billing",
        journeyId: "journey_billing",
        releaseId: "rel_1",
        traceId: "trace_b",
        correlationId: "corr_b"
      }),
      event({
        name: "auth.failed",
        timestamp: "2026-06-20T10:00:01.000Z",
        environment: "preview",
        surface: "web",
        component: "auth",
        status: "error",
        journeyId: "journey_auth",
        traceId: "trace_a",
        correlationId: "corr_a"
      })
    ]);

    expect(inspection.summary).toEqual({
      eventCount: 2,
      errorCount: 1,
      firstTimestamp: "2026-06-20T10:00:01.000Z",
      lastTimestamp: "2026-06-20T10:00:02.000Z",
      environments: ["preview", "production"],
      surfaces: ["convex", "web"],
      journeys: ["journey_auth", "journey_billing"],
      components: ["auth", "billing"],
      releases: ["rel_1"]
    });
    expect(inspection.timeline.map((entry) => entry.name)).toEqual(["auth.failed", "billing.started"]);
    expect(inspection.timeline[0]).toMatchObject({ isError: true, status: "error" });
    expect(inspection.pivots).toEqual({
      traceIds: ["trace_a", "trace_b"],
      correlationIds: ["corr_a", "corr_b"],
      journeyIds: ["journey_auth", "journey_billing"],
      components: ["auth", "billing"],
      releases: ["rel_1"]
    });
  });

  it("filters journey inspection by journeyId, redacts state, and flags missing context", () => {
    const source = [
      event({
        name: "checkout.started",
        journeyId: "journey_checkout",
        traceId: "",
        correlationId: "",
        state: {
          step: "payment",
          email: "buyer@example.com",
          nested: { token: "secret-token", keep: "value" }
        }
      }),
      event({ name: "other.event", journeyId: "journey_other" })
    ];

    const inspection = buildTelemetryJourneyInspection(source, "journey_checkout");

    expect(inspection.summary.eventCount).toBe(1);
    expect(inspection.timeline).toHaveLength(1);
    expect(inspection.timeline[0]?.state).toEqual({
      step: "payment",
      email: "[redacted]",
      nested: { token: "[redacted]", keep: "value" }
    });
    expect(inspection.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_trace_context", severity: "warning" }),
        expect.objectContaining({ code: "missing_correlation_context", severity: "warning" })
      ])
    );
    expect(source[0]?.state).toMatchObject({ email: "buyer@example.com" });
  });

  it("groups error clusters and emits concrete next query suggestions", () => {
    const inspection = buildTelemetryErrorInspection([
      event({
        name: "billing.webhook.failed",
        timestamp: "2026-06-20T10:00:00.000Z",
        environment: "production",
        surface: "convex",
        component: "billing",
        status: "error",
        journeyId: "journey_billing",
        traceId: "trace_cluster",
        correlationId: "corr_cluster",
        state: { errorClass: "WebhookSignatureError" }
      }),
      event({
        name: "billing.webhook.failed",
        timestamp: "2026-06-20T10:01:00.000Z",
        environment: "production",
        surface: "convex",
        component: "billing",
        status: "failed",
        journeyId: "journey_billing",
        traceId: "trace_cluster",
        correlationId: "corr_cluster",
        state: { errorClass: "WebhookSignatureError" }
      }),
      event({ name: "billing.recovered", status: "ok" })
    ]);

    expect(inspection.summary).toMatchObject({ eventCount: 2, errorCount: 2 });
    expect(inspection.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "error_cluster",
          severity: "error",
          eventName: "billing.webhook.failed"
        })
      ])
    );
    expect(inspection.nextQueries).toEqual(
      expect.arrayContaining([
        "agentstack observe timeline --trace trace_cluster",
        "agentstack observe timeline --correlation corr_cluster",
        "agentstack observe journey --id journey_billing",
        "agentstack observe errors --env production --component billing"
      ])
    );
  });

  it("compares environments with event and error deltas for a journey", () => {
    const inspection = buildTelemetryCompareInspection(
      [
        event({ environment: "preview", journeyId: "journey_checkout", name: "checkout.started" }),
        event({
          environment: "preview",
          journeyId: "journey_checkout",
          name: "checkout.failed",
          status: "error"
        }),
        event({ environment: "production", journeyId: "journey_checkout", name: "checkout.started" }),
        event({ environment: "production", journeyId: "journey_other", name: "other.failed", status: "error" })
      ],
      ["preview", "production"],
      { journeyId: "journey_checkout" }
    );

    expect(inspection.compare).toEqual([
      { environment: "preview", eventCount: 2, errorCount: 1, eventDelta: 0, errorDelta: 0 },
      { environment: "production", eventCount: 1, errorCount: 0, eventDelta: -1, errorDelta: -1 }
    ]);
    expect(inspection.summary.eventCount).toBe(3);
  });

  it("does not expose secrets in returned JSON", () => {
    const inspection = buildTelemetryTimelineInspection([
      event({
        name: "auth.session.created",
        actorId: "user_123",
        orgId: "org_123",
        state: {
          email: "person@example.com",
          authorization: "Bearer abc",
          profile: { apiKey: "sk_live_secret", label: "visible" }
        }
      })
    ]);

    const json = JSON.stringify(inspection);
    expect(json).not.toContain("person@example.com");
    expect(json).not.toContain("Bearer abc");
    expect(json).not.toContain("sk_live_secret");
    expect(json).not.toContain("user_123");
    expect(json).toContain("[redacted]");
    expect(json).toContain("visible");
  });
});
