# Local Development

The generated app starts as framework-shaped anchors, not a full React, Expo, or Convex install. Add product dependencies only when a surface needs real runtime code.

Useful root scripts:

- `pnpm run validate` checks the manifest, docs, package anchors, and local environment declarations.
- `pnpm run env:inspect` prints expected preview services and environment bindings.
- `pnpm run preview:plan` plans local-cloud preview service changes without writing state.
- `pnpm run preview:apply` applies local-cloud preview service state.
- `pnpm run preview:validate` checks local-cloud preview readiness.
- `pnpm run preview:deploy` plans the local preview deploy rehearsal.
- `pnpm run preview:deploy:apply` writes the local preview deployment artifact.
- `pnpm run sync:preview` remains as a compatibility alias for planning local-cloud preview service changes.
- `pnpm run sync:preview:apply` remains as a compatibility alias for applying local-cloud preview service changes.
- `pnpm run observe:timeline` prints a redacted preview journey timeline.

Useful feature workflow:

- `agentstack add feature <name> --surfaces web,mobile --backend convex` creates coordinated domain, Convex, web, mobile, telemetry, and feature-doc anchors.
- Generated feature files are product code. Fill them in, then run `pnpm run validate`.
- Set required local-cloud preview environment values through the CLI, for example `agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox`; do not hand-edit `.agentstack/env-values.json`.
- If the feature changes provider state or environment bindings, run `pnpm run env:inspect`, `pnpm run preview:plan`, and `pnpm run preview:apply` as needed before cloud validation.
- Use `docs/agentstack/preview.md` for the full local preview deploy rehearsal. The generated preview deploy scripts do not deploy to real providers; real provider adapters are future work.

For source-prototype smoke runs, set `AGENTSTACK_CLI_BIN` and `AGENTSTACK_TSX_BIN` as described in `docs/agentstack/validation.md`.
