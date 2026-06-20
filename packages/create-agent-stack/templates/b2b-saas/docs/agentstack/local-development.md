# Local Development

The generated app starts as framework-shaped anchors, not a full React, Expo, or Convex install. Add product dependencies only when a surface needs real runtime code.

Useful root scripts:

- `pnpm run inspect` summarizes the generated app, anchors, services, and preview local-cloud state before you edit.
- `pnpm run doctor` runs local validation plus preview local-cloud checks and prints exact repair commands when something blocks provider, env, build, or deploy work.
- `pnpm run dev` runs the local dev preflight. When local validation passes, it prints the next validation, env, sync, web, and mobile commands; it does not start real web, mobile, Convex, Expo, or provider servers in this prototype.
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
- `agentstack add billing-plan pro --entitlements feature.auditLog,feature.advancedReports --seats 10` creates coordinated billing-plan anchors before surface-specific gating code is added.
- Generated feature files are product code. Fill them in, then run `pnpm run validate`.
- Before opening provider, environment, build, sync, or deploy work, run `pnpm run doctor` and follow any repair commands it prints.
- Use `pnpm run dev` when you need the next local product commands; treat it as a preflight checklist, not a server supervisor.
- Set required local-cloud preview environment values through the CLI, for example `agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox`; do not hand-edit `.agentstack/env-values.json`.
- If the feature changes provider state or environment bindings, run `pnpm run env:inspect`, `pnpm run preview:plan`, and `pnpm run preview:apply` as needed before cloud validation.
- Use `docs/agentstack/preview.md` for the full local preview deploy rehearsal. The generated preview deploy scripts do not deploy to real providers; real provider adapters are future work.
- Inspect billing generation with `node scripts/agentstack.mjs observe timeline --env development --journey billing`.

For source-prototype smoke runs, set `AGENTSTACK_CLI_BIN` and `AGENTSTACK_TSX_BIN` as described in `docs/agentstack/validation.md`.
