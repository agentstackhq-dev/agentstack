# Local Development

The generated app starts as framework-shaped anchors, not a full React, Expo, or Convex install. Add product dependencies only when a surface needs real runtime code.

Useful root scripts:

- `pnpm run validate` checks the manifest, docs, package anchors, and local environment declarations.
- `pnpm run env:inspect` prints expected preview services and environment bindings.
- `pnpm run sync:preview` plans preview provider changes without writing state.
- `pnpm run sync:preview:apply` applies the local preview provider plan.
- `pnpm run observe:timeline` prints a redacted preview journey timeline.

Useful feature workflow:

- `agentstack add feature <name> --surfaces web,mobile --backend convex` creates coordinated domain, Convex, web, mobile, telemetry, and feature-doc anchors.
- Generated feature files are product code. Fill them in, then run `pnpm run validate`.
- Set required local environment values through the CLI, for example `agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox`; do not hand-edit `.agentstack/env-values.json`.
- If the feature changes provider state or environment bindings, run `pnpm run env:inspect`, `pnpm run sync:preview`, and `pnpm run sync:preview:apply` as needed before cloud validation.

For source-prototype smoke runs, set `AGENTSTACK_CLI_BIN` and `AGENTSTACK_TSX_BIN` as described in `docs/agentstack/validation.md`.
