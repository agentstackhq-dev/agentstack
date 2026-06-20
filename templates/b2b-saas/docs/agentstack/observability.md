# Observability

Use wide, typed, redacted telemetry events for product and operational behavior. Keep payloads structured and avoid raw secrets, tokens, credentials, or unbounded user input.

Use framework observability commands with filters for environment, surface, event name, journey, trace, and correlation context when investigating behavior.

The local generated prototype records framework command events in `.agentstack/events.jsonl`. Use `pnpm run observe:timeline` to inspect a redacted preview timeline.
