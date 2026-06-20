# Local Development

The generated app starts as framework-shaped anchors, not a full React, Expo, or Convex install. Add product dependencies only when a surface needs real runtime code.

Useful root scripts:

- `pnpm run validate` checks the manifest, docs, package anchors, and local environment declarations.
- `pnpm run env:inspect` prints expected preview services and environment bindings.
- `pnpm run sync:preview` plans preview provider changes without writing state.
- `pnpm run sync:preview:apply` applies the local preview provider plan.
- `pnpm run observe:timeline` prints a redacted preview journey timeline.

For source-prototype smoke runs, set `AGENTSTACK_CLI_BIN` and `AGENTSTACK_TSX_BIN` as described in `docs/agentstack/validation.md`.
