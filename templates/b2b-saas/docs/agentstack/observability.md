# Observability

Use wide, typed, redacted telemetry events for product and operational behavior. Keep payloads structured and avoid raw secrets, tokens, credentials, provider payloads, environment values, or unbounded user input.

Use `agentstack observe` commands with filters for environment, surface, event name, journey, trace, and correlation context when investigating behavior. `agentstack observe` is the agent-facing inspection namespace.

The local generated prototype records framework command events in `.agentstack/events.jsonl`. Local JSONL remains the source for local inspection: it does not configure network export, provider ingestion, or provider dashboard links. Use `pnpm run observe:timeline` to inspect a redacted preview timeline.

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

These app-facing primitives create provider-neutral local envelopes only:

- `identify` returns a telemetry helper with actor, org, journey, or release context attached.
- `event` creates a typed event envelope from a generated event definition.
- `span` creates a local span envelope for a runtime boundary.
- `journey` creates a local workflow phase envelope.
- `redact` previews the same state redaction used by generated envelopes.

State is redacted before it appears in generated telemetry envelopes. This slice can write an `OTLP-shaped JSON` local export artifact from redacted local query output, but it does not configure hosted telemetry, network export, provider ingestion, or dashboard links.

Add product telemetry where behavior crosses a product boundary:

- Web interaction handlers in `apps/web`.
- Mobile screen or action handlers in `apps/mobile`.
- Convex queries, mutations, or actions in `convex`.
- Shared event definitions in `packages/telemetry/src/events/`.

Follow the workspace-status pattern: keep domain state typed, emit from the surface that observes the behavior, attach actor, org, journey, trace, release, surface, and component context when available, and inspect the result through `agentstack observe`.

## Inspection Workflow

Start every incident with the narrowest question you can answer from the local event stream. The richer inspection modes all read the same redacted `.agentstack/events.jsonl` source and keep output suitable for agent handoff.

| Question | Command | Use when |
| --- | --- | --- |
| What happened for one request? | `agentstack observe trace --id trace_123 --env production` | A request, command, or provider callback has a trace id and you need the cross-surface sequence. |
| Where did this user or workflow stall? | `agentstack observe journey --id journey_123 --include-state` | Onboarding, billing, validation, preview deploy, or mobile build events need stateful reconstruction. |
| What is failing most often? | `agentstack observe errors --env production --since 2h --group-by component` | You need grouped error classes without reading the full stream. |
| Did a provider callback arrive and normalize? | `agentstack observe webhook clerk --env production --since 24h` | Clerk or billing callback intake is suspected. |
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

## Structured Inspection Objects

The inspector returns structured objects for timeline, journey, errors, and compare modes. Human output summarizes those objects, and journey or errors inspections can render JSON for automation.

Each structured inspection object should include:

- `summary`: structured count, window, and pivot fields that describe the inspected event set.
- `timeline`: ordered entries with timestamp, event name, surface, component, journey, trace, correlation fields, and redacted state snapshots.
- `pivots`: trace IDs, journey IDs, components, environments, event families, or time windows that are useful follow-up paths.
- `risks`: missing data, stale local history, suspected redaction gaps, or uncertainty that should shape the next step.
- `nextQueries`: concrete `agentstack observe ...` commands an agent can run next.

Secrets, environment values, raw provider payloads, tokens, credentials, and user identifiers that are not already safe IDs must be redacted before inspection output or local export artifacts are written.

## Reading Output

- Treat trace and journey output as chronological evidence, not a provider span tree.
- Prefer `--since` on error, webhook, and component queries so agents do not reason from stale local history.
- Use `--include-state` only when the redacted state fields help explain the behavior.
- If an event should exist but does not, inspect the emitting surface and generated typed event definition before changing business logic.
- Do not paste raw provider payloads, secrets, or environment values into events. Add typed state fields and redact before inspection or export.

## Current Limits

- Storage is `.agentstack/events.jsonl` in the generated project, and local JSONL remains the source of local inspection.
- Inspection output and `OTLP-shaped JSON` local export artifact output are local, redacted, and provider-neutral.
- The export artifact is redacted because it is built from redacted store query output.
- Network export, hosted telemetry indexing, provider dashboards, retention policies, and production permission enforcement are outside the current generated framework boundary.
- Inspection is provider-neutral over local JSONL, with local `OTLP-shaped JSON` export artifacts available when agents need a portable local artifact.
