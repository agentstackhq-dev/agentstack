# Environments

This template defines `development`, `preview`, and `production`.

Declare required custom environment values in `agentstack.config.json` under `env.custom`.
For this prototype, local validation reads actual values from `.agentstack/env-values.json` when the file exists. Treat that file as CLI-managed local state instead of editing it by hand.

Use `agentstack env set` to write values into local validation state only. The CLI validates the environment, surface, declared variable name, declaration scope, and enum values before updating `.agentstack/env-values.json`:

```bash
agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox
```

Use `agentstack env inspect --env preview` or `pnpm run env:inspect` to confirm whether declared bindings are present without exposing secret values.

Missing `.agentstack/env-values.json` is treated as an empty value set. Invalid JSON or non-string values fail `validate` and `validate:cloud`.

Use `agentstack sync --env <env>` after local values exist to reconcile the local provider env resource rehearsal. Sync refuses missing or invalid declared values before planning or applying provider env resources. The local-cloud adapter derives provider env resources from declared bindings and surfaces, such as `convex.STRIPE_MODE` for Convex and `vercel.STRIPE_MODE` for web. Applied sync writes those resources to `.agentstack/local-cloud.json` with redacted metadata and `valueHash` only; raw env values are never written there.

`validate --cloud --env <env>` checks linked services and provider env resource presence or drift against local-cloud state. Real Convex, Vercel, EAS, and Clerk adapters will implement the same resource contract later; this prototype only rehearses that contract locally.
