# Observability

- Use `pnpm run observe:timeline` for the smoke journey timeline.
- Inspect generated-event history with `agentstack observe timeline --journey telemetry-generation --env development`.
- Pivot from broad timeline output into focused trace, journey, errors, webhook, component, or compare modes when available.
- Treat `.agentstack/events.jsonl` as redacted local evidence. Hosted telemetry export is not configured by default.
