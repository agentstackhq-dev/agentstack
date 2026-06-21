# Environments

This template defines `development`, `preview`, and `production`.

Declare required custom environment values in `agentstack.config.json` under `env.custom`.
For this prototype, local validation reads actual values from `.agentstack/env-values.json` when the file exists. Treat that file as CLI-managed local state instead of editing it by hand.

Use `agentstack env set` to write values into local validation state only. The CLI validates the environment, surface, declared variable name, declaration scope, and enum values before updating `.agentstack/env-values.json`:

```bash
agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox
```

Use `agentstack env inspect --env preview` or `pnpm run env:inspect` to confirm whether declared bindings are present without exposing secret values.

Use `agentstack inspect --env preview` or `pnpm run inspect` to see provider adapter contract status and pending provider operation IDs. `contract-only` means the provider boundary is normalized, but mutations are still local-cloud rehearsal here. `convex:command-plan` and `vercel:command-plan` mean Agentstack can plan current provider CLI deploy/env commands without executing them. Operation IDs are stable and redacted; env operations include surface scope and variable names only, never values or hashes. An `env.set` operation can appear before a local value is available; sync remains the actionability gate.

Missing `.agentstack/env-values.json` is treated as an empty value set. Invalid JSON or non-string values fail `validate` and `validate:cloud`.

Use `agentstack sync --env <env>` after local values exist to reconcile the local provider env resource rehearsal. Sync refuses missing or invalid declared values before planning or applying provider env resources. The local-cloud adapter derives provider env resources from declared bindings and surfaces, such as `convex.STRIPE_MODE` for Convex and `vercel.STRIPE_MODE` for web. Applied sync writes those resources to `.agentstack/local-cloud.json` with redacted metadata and `valueHash` only; raw env values are never written there.

Use `pnpm run provider:convex:preview` to print real Convex preview commands without running provider mutations. Generated projects include the Convex package so `pnpm exec convex` resolves locally. Preview planning requires `CONVEX_DEPLOY_KEY` and prints `pnpm exec convex deploy --preview-name __APP_SLUG__-preview`. Preview env commands use `.agentstack/env-values.json` as the value source label and `convex env --deployment <preview-deployment-name> set/remove ...` until a concrete Convex preview deployment exists.

Use `pnpm run provider:convex:production` to print real Convex production commands without running provider mutations. Production planning requires `CONVEX_DEPLOY_KEY`, prints `pnpm exec convex deploy`, scopes env commands with production Convex flags, and marks production confirmation as required for the future provider apply slice.

Use `pnpm run provider:vercel:preview` to print real Vercel preview commands without running provider mutations. Generated projects include the Vercel package so `pnpm exec vercel` resolves locally. Preview planning requires `VERCEL_TOKEN`, a linked Vercel project from `vercel link` or `.vercel/project.json`, and prints `pnpm exec vercel deploy --target=preview`.

Use `pnpm run provider:vercel:production` to print real Vercel production commands without running provider mutations. Production planning requires `VERCEL_TOKEN`, requires the same linked Vercel project, prints `pnpm exec vercel --prod`, and marks production confirmation as required for the future provider apply slice.

Provider command output is redacted. Env add/update/remove command plans identify variable names and whether input comes from `.agentstack/env-values.json`; they do not print raw values, hashes, or secrets. Vercel env plans map missing values to `pnpm exec vercel env add`, drifted values to `pnpm exec vercel env update`, and stale values to `pnpm exec vercel env rm`.

`validate --cloud --env <env>` checks linked services and provider env resource presence or drift against local-cloud state. Convex and Vercel command planning are real-provider command surfaces, but provider mutation is still intentionally manual. Real Clerk and EAS adapters will implement the same operation kinds later.
