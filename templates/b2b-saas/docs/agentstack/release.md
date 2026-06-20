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

This rehearsal does not deploy to real providers or submit EAS builds. Real Convex, Clerk, Vercel, EAS, Stripe, and telemetry-provider adapters are future work.

Run release validation before any future production apply so environment sync, provider readiness, and generated boundaries are checked together.
