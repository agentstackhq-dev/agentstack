# Release

Start with the local preview deploy rehearsal:

```bash
pnpm run preview:deploy
pnpm run preview:deploy:apply
```

Expected output includes `PLAN deploy preview` for the plan step and `APPLIED deploy preview` for the apply step. Apply writes `.agentstack/deployments/preview.json` and records `agentstack.deploy.completed` telemetry.

This rehearsal does not deploy to real providers. Real Convex, Clerk, Vercel, EAS, Stripe, and telemetry-provider adapters are future work.

Run release validation before any future production apply so environment sync, provider readiness, and generated boundaries are checked together.
