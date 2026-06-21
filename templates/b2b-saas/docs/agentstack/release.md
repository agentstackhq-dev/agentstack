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

This rehearsal does not deploy to real providers or submit EAS builds. Real provider mutation/apply automation, Stripe integration, and hosted telemetry-provider adapters are future work.

Run release validation before any future production apply so environment sync, provider readiness, and generated boundaries are checked together.

## Local Production Release Rehearsal

Production release commands are local rehearsals. They inspect, plan, validate, and write local Agentstack artifacts only; no real Convex, Clerk, Vercel, EAS, Stripe, telemetry-provider, or other provider APIs are called.

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
