# Agent Rules

- Run `pnpm run validate` before completion.
- Validate theme changes with `pnpm run theme:validate`; normal `pnpm run validate` also checks token shape.
- Style UI through `@app/theme` token roles and `@app/ui` primitives before adding surface-specific components.
- Use framework package scripts and generated docs instead of provider dashboards.
- Treat preview commands as local-cloud preview state only; real provider adapters are future work.
- Use telemetry primitives for product events and operational traces.
- Add typed product telemetry with `agentstack add event <name> --journey <journey> --surfaces web,mobile,convex --state key:type`.
- Create app telemetry envelopes with `createAppTelemetry(runtime).event(definition, state)`; this does not export to a provider.
- Do not edit generated vendor glue directly.
- Add custom env values through `agentstack.config.json`.
- For source-prototype smoke runs, set `AGENTSTACK_CLI_BIN` and `AGENTSTACK_TSX_BIN` before running generated package scripts.
- Inspect behavior with framework observability commands when available.
- Inspect generated-event command history with `agentstack observe timeline --journey telemetry-generation --env development`.
- Rehearse releases with `pnpm run preview:deploy` and `pnpm run preview:deploy:apply`; they do not deploy to real providers.
- Rehearse mobile builds with `pnpm run mobile:build:development`, `pnpm run mobile:build:preview`, and `pnpm run mobile:build:preview:apply`; they write local `.agentstack/builds/` artifacts only when apply is used.
- Use `apps/mobile/eas.json` and `apps/mobile/app.config.ts` as generated anchors for Expo/EAS configuration tied to `agentstack.config.json`.
