# Preview Rehearsal

This is a local preview deploy rehearsal. It exercises Agentstack planning, local-cloud preview state, validation, deployment artifact writing, and deployment telemetry without deploying to real Convex, Clerk, Vercel, EAS, Stripe, or telemetry-provider APIs.

## Commands

Plan preview service sync:

```bash
pnpm run preview:plan
```

Expected output includes:

```text
PLAN preview
- link preview.clerk
- link preview.convex
- link preview.vercel
- link preview.eas
```

Apply preview service sync:

```bash
pnpm run preview:apply
```

Expected output includes:

```text
APPLIED preview
- link preview.clerk
- link preview.convex
- link preview.vercel
- link preview.eas
```

Validate local-cloud preview readiness:

```bash
pnpm run preview:validate
```

Expected output includes:

```text
PASS validate --cloud
```

Plan the local preview deploy rehearsal:

```bash
pnpm run preview:deploy
```

Expected output includes:

```text
PLAN deploy preview
- planned release preview.vercel
- planned release preview.eas
```

Apply the local preview deploy rehearsal:

```bash
pnpm run preview:deploy:apply
```

Expected output includes:

```text
APPLIED deploy preview
- applied release preview.vercel
- applied release preview.eas
```

Inspect deployment telemetry:

```bash
node scripts/agentstack.mjs observe timeline --env preview --journey deployment
```

Expected output includes:

```text
agentstack.deploy.completed
```

## Files Written

- `.agentstack/local-cloud.json` is written by `pnpm run preview:apply` and records local-cloud preview service links.
- `.agentstack/deployments/preview.json` is written only by `pnpm run preview:deploy:apply` and records the secret-free local preview deployment artifact.
- `.agentstack/events.jsonl` records redacted telemetry such as `agentstack.deploy.completed`.

`pnpm run preview:plan`, `pnpm run preview:validate`, and `pnpm run preview:deploy` do not write deployment artifacts.

## Non-Goals

- This is not a real provider deployment.
- It does not create or mutate Convex, Clerk, Vercel, EAS, Stripe, or telemetry-provider resources.
- It does not prove production readiness.
- It does not replace provider credentials, real CI/CD, app builds, smoke tests, or production release approval.

Use this runbook to rehearse the framework path before connecting real provider adapters in future Agentstack releases.
