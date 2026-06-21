# Observability

- Use `pnpm run observe:timeline` for the smoke journey timeline.
- Inspect generated-event history with `agentstack observe timeline --journey telemetry-generation --env development`.
- Pivot from broad timeline output into focused trace, journey, errors, webhook, component, or compare modes when available.
- Treat `.agentstack/events.jsonl` as redacted local evidence and the source of local inspection.
- Keep inspection under the `agentstack observe` namespace.
- Use `createAppTelemetry(runtime).identify(...)` to attach actor, org, journey, or release context before emitting generated app telemetry.
- Use `event`, `span`, and `journey` for provider-neutral local envelopes, and `redact` to preview the same state redaction used by generated envelopes.
- Add product telemetry in web interaction handlers, mobile screen or action handlers, and Convex queries, mutations, or actions. Follow the workspace-status pattern: typed domain state, generated event definitions, actor/org/journey/trace/release/surface/component context where available, and redacted state snapshots.
- Use `agentstack observe export --env preview --format otlp-json` only to write an `OTLP-shaped JSON` local export artifact from redacted store query output.
- No network export or hosted provider is configured by default.
- Structured inspector output for timeline, journey, errors, and compare modes includes `summary`, ordered `timeline` entries, useful `pivots`, known `risks`, and concrete `nextQueries`. JSON rendering is available only for `agentstack observe journey --format json` and `agentstack observe errors --format json`.

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

Generated app state is redacted before it appears in telemetry envelopes. Secrets, environment values, provider payloads, tokens, credentials, and unsafe user identifiers must be redacted before inspection or export. These primitives do not configure hosted telemetry, network export, provider ingestion, or dashboard links.
