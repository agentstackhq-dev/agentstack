# Release

Start with the local preview deploy rehearsal:

```bash
pnpm run preview:deploy
pnpm run preview:deploy:apply
pnpm run mobile:build:preview
pnpm run mobile:build:preview:apply
```

Expected output includes `PLAN deploy preview` for the plan step and `APPLIED deploy preview` for the apply step. Apply writes `.agentstack/deployments/preview.json` and records `agentstack.deploy.completed` telemetry.

Mobile build rehearsal output includes `PLAN mobile build preview` and `APPLIED mobile build preview`. Apply writes `.agentstack/builds/mobile-preview.json` and records `agentstack.mobile.build.completed` telemetry on the `mobile-build` journey.

This rehearsal does not deploy to Vercel or submit EAS builds. Provider execution is explicit only through `agentstack provider inspect/apply`; Clerk inspect and EAS preview inspect are read-only, Convex apply is supported, and Vercel preview apply runs only the preview deploy command. Vercel production apply, Vercel env mutation execution, EAS build/init/env mutation execution, and EAS apply are unavailable in this slice. Live Stripe integration, hosted/network telemetry export, provider dashboards, and retention are outside the current generated framework boundary.

Run release validation before production release rehearsal so environment sync, provider readiness, and generated boundaries are checked together.

## Local Production Release Rehearsal

Production release commands are local rehearsals. They inspect, plan, validate, and write local Agentstack artifacts only; they do not call Vercel, EAS, Stripe, telemetry-provider, or other deployment APIs. Convex production provider apply is separate and requires `--confirm-production`; Vercel production apply and EAS production inspect/apply are unavailable.

```bash
pnpm run prod:prepare
pnpm run prod:provision
pnpm run prod:provision:apply
pnpm run prod:validate
pnpm run prod:deploy
pnpm run prod:deploy:apply
```

- `prod:prepare` checks production release readiness and reports repair commands before provision or deploy work.
- `prod:provision` plans production local-cloud state without writing it.
- `prod:provision:apply` applies local production state.
- `prod:validate` runs release validation for the production release lane.
- `prod:deploy` plans the production deploy rehearsal without writing the deployment artifact.
- `prod:deploy:apply` applies the local artifact only and requires explicit production confirmation through the script.
