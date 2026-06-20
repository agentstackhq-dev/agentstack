# Agent Rules

- Run `pnpm run validate` before completion.
- Use framework package scripts and generated docs instead of provider dashboards.
- Treat preview commands as local-cloud preview state only; real provider adapters are future work.
- Use telemetry primitives for product events and operational traces.
- Do not edit generated vendor glue directly.
- Add custom env values through `agentstack.config.json`.
- For source-prototype smoke runs, set `AGENTSTACK_CLI_BIN` and `AGENTSTACK_TSX_BIN` before running generated package scripts.
- Inspect behavior with framework observability commands when available.
- Rehearse releases with `pnpm run preview:deploy` and `pnpm run preview:deploy:apply`; they do not deploy to real providers.
