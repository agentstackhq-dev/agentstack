# Preview Rehearsal

This is a local preview deploy rehearsal. It exercises Agentstack planning, local-cloud preview state, validation, deployment artifact writing, and deployment telemetry without deploying to real Convex, Clerk, Vercel, EAS, Stripe, or telemetry-provider APIs.

Clerk, Convex, Vercel, and EAS have command-plan surfaces. `clerk:command-plan`, `convex:command-plan`, `vercel:command-plan`, and `eas:command-plan` mean Agentstack knows current provider CLI command shapes and can print the commands an operator would run, but this slice still does not execute provider mutations. Generated projects include the Clerk, Convex, Vercel, and EAS CLI packages so `pnpm exec clerk`, `pnpm exec convex`, `pnpm exec vercel`, and `pnpm exec eas` resolve locally.

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

Plan real Convex preview commands without running them:

```bash
pnpm run provider:convex:preview
```

Expected output includes the preview deploy key requirement and the planned deploy command:

```text
CONVEX_DEPLOY_KEY
pnpm exec convex deploy --preview-name __APP_SLUG__-preview
```

Convex env set/remove commands are printed with redacted values. Secret and non-secret values use `.agentstack/env-values.json` as the value source label, not the raw value. Preview env commands use `convex env --deployment <preview-deployment-name> set/remove ...` until `pnpm exec convex deploy --preview-name __APP_SLUG__-preview` has created a concrete Convex preview deployment name.

Plan real Clerk preview commands without running them:

```bash
pnpm run provider:clerk:preview
```

Expected output includes Clerk initialization, diagnostic, env pull, and config pull commands:

```text
pnpm exec clerk init -y
pnpm exec clerk doctor --mode agent
pnpm exec clerk env pull --mode agent
pnpm exec clerk config pull --mode agent
```

Plan real Vercel preview commands without running them:

```bash
pnpm run provider:vercel:preview
```

Expected output includes the Vercel token requirement, the linked project warning, and the planned preview deploy command:

```text
VERCEL_TOKEN
vercel link
pnpm exec vercel deploy --target=preview
```

Vercel env add/update/remove commands are printed with redacted values. Secret and non-secret values use `.agentstack/env-values.json` as the value source label, not the raw value.

Plan real EAS preview commands without running them:

```bash
pnpm run provider:eas:preview
```

Expected output includes the Expo token requirement and planned project/env/build commands:

```text
EXPO_TOKEN
pnpm exec eas project:init --non-interactive
pnpm exec eas env:list --environment preview
pnpm exec eas build -p all -e preview --json --non-interactive
```

EAS env create/update/delete commands are printed with redacted value placeholders. EAS Build uses server-side EAS env values, not local CI variables alone.

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
- It does not create or mutate Convex, Clerk, Vercel, EAS, Stripe, or telemetry-provider resources. Clerk, Convex, Vercel, and EAS command planning prints real CLI command shapes only.
- It does not prove production readiness.
- It does not replace provider credentials, real CI/CD, app builds, smoke tests, or production release approval.

Use this runbook to rehearse the framework path before enabling real provider apply automation in future Agentstack releases.
