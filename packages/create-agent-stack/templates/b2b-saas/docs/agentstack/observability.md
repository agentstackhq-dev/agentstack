# Observability

Use wide, typed, redacted telemetry events for product and operational behavior. Keep payloads structured and avoid raw secrets, tokens, credentials, or unbounded user input.

Use framework observability commands with filters for environment, surface, event name, journey, trace, and correlation context when investigating behavior.

The local generated prototype records framework command events in `.agentstack/events.jsonl`. Local JSONL remains the source for local inspection: it does not configure network export, ship spans to a hosted provider, or create provider dashboard links. Use `pnpm run observe:timeline` to inspect a redacted preview timeline.

Use `node scripts/agentstack.mjs observe export --env preview --format otlp-json` when an agent needs a portable file for handoff. The command writes an `OTLP-shaped JSON` local export artifact from the same redacted store query output used by inspection commands. `pnpm run telemetry:export:preview` and `pnpm run telemetry:export:production` are convenience scripts for preview and production local export artifacts; no network export or hosted provider is configured by default.

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

This slice creates provider-neutral envelopes only. It can write an `OTLP-shaped JSON` local export artifact from redacted local query output, but it does not configure network export or send data to a hosted telemetry provider.

## Inspection Workflow

Start every incident with the narrowest question you can answer from the local event stream. The richer inspection modes all read the same redacted `.agentstack/events.jsonl` source and keep output suitable for agent handoff.

| Question | Command | Use when |
| --- | --- | --- |
| What happened for one request? | `agentstack observe trace --id trace_123 --env production` | A request, command, or provider callback has a trace id and you need the cross-surface sequence. |
| Where did this user or workflow stall? | `agentstack observe journey --id journey_123 --include-state` | Onboarding, billing, validation, preview deploy, or mobile build events need stateful reconstruction. |
| What is failing most often? | `agentstack observe errors --env production --since 2h --group-by component` | You need grouped error classes without reading the full stream. |
| Did a provider callback arrive and normalize? | `agentstack observe webhook clerk --env production --since 24h` | Clerk, billing, or future provider webhook intake is suspected. |
| What did this component do recently? | `agentstack observe component convex:billing.applySubscriptionUpdate --env production` | A Convex function, CLI command, or generated runtime component is the likely boundary. |
| What changed between environments? | `agentstack observe compare --env preview,production --journey onboarding` | Preview and production disagree and you need event-count or journey differences first. |

Keep `query` and `timeline` for broad discovery:

```bash
agentstack observe query --env production --surface convex --event billing.*
agentstack observe timeline --journey billing --env preview
```

Then pivot to a focused mode:

```bash
agentstack observe errors --env production --since 2h --group-by component
agentstack observe component convex:billing.applySubscriptionUpdate --env production
agentstack observe compare --env preview,production --journey onboarding
```

## Reading Output

- Treat trace and journey output as chronological evidence, not a provider span tree.
- Prefer `--since` on error, webhook, and component queries so agents do not reason from stale local history.
- Use `--include-state` only when the redacted state fields help explain the behavior.
- If an event should exist but does not, inspect the emitting surface and generated typed event definition before changing business logic.
- Do not paste raw provider payloads into events. Add typed state fields and let redaction handle sensitive keys.

## Current Limits

- Storage is `.agentstack/events.jsonl` in the generated project, and local JSONL remains the source of local inspection.
- Inspection output and `OTLP-shaped JSON` local export artifact output are local, redacted, and provider-neutral.
- The export artifact is redacted because it is built from redacted store query output.
- Network export, hosted telemetry indexing, provider dashboards, retention policies, and production permission enforcement are future adapter work.
- The command shape is intentionally compatible with future hosted or OTLP-backed adapters, but this prototype does not claim those adapters exist.
