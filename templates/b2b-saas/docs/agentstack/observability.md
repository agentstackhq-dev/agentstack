# Observability

Use wide, typed, redacted telemetry events for product and operational behavior. Keep payloads structured and avoid raw secrets, tokens, credentials, or unbounded user input.

Use framework observability commands with filters for environment, surface, event name, journey, trace, and correlation context when investigating behavior.

The local generated prototype records framework command events in `.agentstack/events.jsonl`. Use `pnpm run observe:timeline` to inspect a redacted preview timeline.

## Typed App Events

Generated apps include `@app/telemetry` with typed event definitions in `packages/telemetry/src/events.ts` and runtime helpers in `packages/telemetry/src/index.ts`.

Add a new event through the framework command instead of inventing one-off shapes:

```bash
node scripts/agentstack.mjs add event billing.subscription.updated --journey billing --surfaces web,convex --state plan:string,seatCount:number
```

The command writes a typed event file under `packages/telemetry/src/events/` and a matching note under `docs/agentstack/events/`. It also records command telemetry under the `telemetry-generation` journey:

```bash
node scripts/agentstack.mjs observe timeline --journey telemetry-generation --env development
```

Use event definitions through the runtime helper:

```ts
const telemetry = createAppTelemetry(runtime);
const event = telemetry.event(billingSubscriptionUpdatedEvent, {
  plan: "team",
  seatCount: 5
});
```

This slice creates provider-neutral envelopes only. It does not configure OTLP export or send data to a hosted telemetry provider.
