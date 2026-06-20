# Observability

- Use `pnpm run observe:timeline` for the smoke journey timeline.
- Inspect generated-event history with `agentstack observe timeline --journey telemetry-generation --env development`.
- Pivot from broad timeline output into focused trace, journey, errors, webhook, component, or compare modes when available.
- Treat `.agentstack/events.jsonl` as redacted local evidence and the source of local inspection.
- Use `createAppTelemetry(runtime).identify(...)` to attach actor, org, journey, or release context before emitting generated app telemetry.
- Use `event`, `span`, and `journey` for provider-neutral local envelopes, and `redact` to preview the same state redaction used by generated envelopes.
- Use `agentstack observe export --env preview --format otlp-json` only to write an `OTLP-shaped JSON` local export artifact from redacted store query output.
- No network export or hosted provider is configured by default.

```ts
const telemetry = createAppTelemetry(runtime).identify({
  actorId: "user_123",
  orgId: "org_123",
  journeyId: "journey_billing_123"
});

telemetry.event(billingSubscriptionUpdatedEvent, { plan: "team", seatCount: 5 });
telemetry.span("convex.billing.applySubscriptionUpdate", { plan: "team" });
telemetry.journey("billing", "subscription-updated", { plan: "team" });
telemetry.redact({ email: "person@example.com", plan: "team" });
```

Generated app state is redacted before it appears in telemetry envelopes. These primitives do not configure hosted telemetry, network export, provider ingestion, or dashboard links.
