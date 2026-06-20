# Observability

- Use `pnpm run observe:timeline` for the smoke journey timeline.
- Inspect generated-event history with `agentstack observe timeline --journey telemetry-generation --env development`.
- Pivot from broad timeline output into focused trace, journey, errors, webhook, component, or compare modes when available.
- Treat `.agentstack/events.jsonl` as redacted local evidence and the source of local inspection.
- Use `agentstack observe export --env preview --format otlp-json` only to write an `OTLP-shaped JSON` local export artifact from redacted store query output.
- No network export or hosted provider is configured by default.
