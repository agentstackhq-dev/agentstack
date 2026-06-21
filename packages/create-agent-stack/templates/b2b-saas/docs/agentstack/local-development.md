# Local Development

The generated app includes one small runnable local vertical: `workspace status` across shared domain, Convex, web, mobile, and unstyled `@app/ui` primitives. It is not a full React, Expo, or Convex product yet. Add broader product dependencies only when a surface needs more runtime code.

Useful root scripts:

- `pnpm run inspect` summarizes the generated app, anchors, services, and preview local-cloud state before you edit.
- `pnpm run doctor` runs local validation plus preview local-cloud checks and prints exact repair commands when something blocks provider, env, build, or deploy work.
- `pnpm run dev` runs the local dev preflight. When local validation passes, it points to the local workspace-status web, mobile, and Convex surfaces plus validation, env, and sync commands; it does not mutate providers.
- `pnpm run validate` checks the manifest, docs, package anchors, and local environment declarations.
- `pnpm run env:inspect` prints expected preview services and environment bindings.
- `pnpm run preview:plan` plans local-cloud preview service changes without writing state.
- `pnpm run preview:apply` applies local-cloud preview service state.
- `pnpm run preview:validate` checks local-cloud preview readiness.
- `pnpm run preview:deploy` plans the local preview deploy rehearsal.
- `pnpm run preview:deploy:apply` writes the local preview deployment artifact.
- `pnpm run observe:timeline` prints a redacted preview journey timeline.

Useful feature workflow:

- `agentstack add feature <name> --surfaces web,mobile --backend convex` creates coordinated domain, Convex, web, mobile, telemetry, and feature-doc anchors.
- `agentstack add billing-plan pro --entitlements feature.auditLog,feature.advancedReports --seats 10` creates coordinated billing-plan anchors before surface-specific gating code is added.
- Use the generated `workspace status` files as the reference shape for small cross-surface behavior: shared domain first, Convex boundary second, then web/mobile rendering through `@app/ui` primitive metadata.
- Generated feature files are product code. Fill them in, then run `pnpm run validate`.
- Before opening provider, environment, build, sync, or deploy work, run `pnpm run doctor` and follow any repair commands it prints.
- Use `pnpm run dev` when you need the next local product commands; treat it as a preflight checklist, not a server supervisor.
- Set required local-cloud preview environment values through the CLI, for example `agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox`; do not hand-edit `.agentstack/env-values.json`.
- If the feature changes provider state or environment bindings, run `pnpm run env:inspect`, `pnpm run preview:plan`, and `pnpm run preview:apply` as needed before cloud validation.
- Use `docs/agentstack/preview.md` for the full local preview deploy rehearsal. The generated preview deploy scripts do not deploy to Vercel or EAS; provider execution is explicit only through `agentstack provider inspect/apply`.
- Inspect billing generation with `node scripts/agentstack.mjs observe timeline --env development --journey billing`.

For source-prototype smoke runs, set `AGENTSTACK_CLI_BIN` and `AGENTSTACK_TSX_BIN` as described in `docs/agentstack/validation.md`.
