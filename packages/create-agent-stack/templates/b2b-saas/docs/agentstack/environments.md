# Environments

This template defines `development`, `preview`, and `production`.

Declare required custom environment values in `agentstack.config.json` under `env.custom`. Each declaration must include explicit `providerTargets` entries that name the owning provider service, surfaces, environments, and source for provider sync.
For this prototype, local validation reads actual values from `.agentstack/env-values.json` when the file exists. Treat that file as CLI-managed local state instead of editing it by hand.

Use `agentstack env set` to write values into local validation state only. The CLI validates the environment, surface, declared variable name, declaration scope, and enum values before updating `.agentstack/env-values.json`:

```bash
agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox
```

Use `agentstack env inspect --env preview` or `pnpm run env:inspect` to confirm whether declared bindings are present without exposing secret values.

Use `agentstack inspect --env preview` or `pnpm run inspect` to see provider adapter contract status and pending provider operation IDs. `contract-only` means the provider boundary is normalized, but mutations are still local-cloud rehearsal here. `clerk:command-plan`, `convex:command-plan`, `vercel:command-plan`, and `eas:command-plan` mean Agentstack can plan current provider CLI command shapes without executing them. Operation IDs are stable and redacted; env operations include surface scope and variable names only, never values or hashes. An `env.set` operation can appear before a local value is available; sync remains the actionability gate.

Missing `.agentstack/env-values.json` is treated as an empty value set. Invalid JSON or non-string values fail `validate` and `validate:cloud`.

Use `agentstack sync --env <env>` after local values exist to reconcile the local provider env resource rehearsal. Sync refuses missing or invalid declared values before planning or applying provider env resources. The local-cloud adapter creates provider env resources only from declared `providerTargets`, such as `convex.convex.STRIPE_MODE` when `STRIPE_MODE` targets the Convex provider service on the Convex surface. Applied sync writes those resources to `.agentstack/local-cloud.json` with redacted metadata and `valueHash` only; raw env values are never written there.

Use `pnpm run provider:clerk:preview` to print a deterministic Clerk preview command plan without running provider commands. Generated projects include the Clerk package so `pnpm exec clerk` resolves locally. Preview planning prints `pnpm exec clerk init -y`, `pnpm exec clerk doctor --mode agent`, `pnpm exec clerk env pull --mode agent`, and `pnpm exec clerk config pull --mode agent`.

Use `pnpm run provider:clerk:inspect:preview` or `agentstack provider inspect --service clerk --env preview` for explicit read-only Clerk diagnostics. Clerk inspect requires an authenticated Clerk CLI or `CLERK_SECRET_KEY`, depending on local Clerk setup. Keep raw key values out of command examples, logs, docs, and telemetry. Development environment inspect is rejected. Clerk apply is unavailable in this slice.

Use `pnpm run provider:clerk:production` to print a deterministic Clerk production command plan without running provider commands. Production planning requires `CLERK_SECRET_KEY`, prints the same inspection commands plus `pnpm exec clerk deploy --mode agent`, and marks production confirmation as required for the command-plan surface.

Use `pnpm run provider:convex:preview` to print a deterministic Convex preview command plan without running provider commands. Generated projects include the Convex package so `pnpm exec convex` resolves locally. Preview planning requires `CONVEX_DEPLOY_KEY` and prints `pnpm exec convex deploy --preview-name __APP_SLUG__-preview`. Preview env commands use `.agentstack/env-values.json` as the value source label and `convex env --deployment <preview-deployment-name> set/remove ...` until a concrete Convex preview deployment exists.

Use `pnpm run provider:convex:inspect:preview` or `agentstack provider inspect --service convex --env preview` for explicit Convex read/diagnostic provider interaction. Use `pnpm run provider:convex:apply:preview` or `agentstack provider apply --service convex --env preview` for explicit Convex preview provider execution. Convex inspect and apply require `CONVEX_DEPLOY_KEY`. Development environment inspect/apply is rejected. Production Convex apply requires `--confirm-production`.

Use `pnpm run provider:convex:production` to print a deterministic Convex production command plan without running provider commands. Production planning requires `CONVEX_DEPLOY_KEY`, prints `pnpm exec convex deploy`, scopes env commands with production Convex flags, and marks production confirmation as required for the command-plan surface.

Use `pnpm run provider:vercel:preview` to print a deterministic Vercel preview command plan without running provider commands. Generated projects include the Vercel package so `pnpm exec vercel` resolves locally. Preview planning requires `VERCEL_TOKEN`, a linked Vercel project from `vercel link` or `.vercel/project.json`, and prints `pnpm exec vercel deploy --target=preview`.

Use `pnpm run provider:vercel:production` to print a deterministic Vercel production command plan without running provider commands. Production planning requires `VERCEL_TOKEN`, requires the same linked Vercel project, prints `pnpm exec vercel --prod`, and marks production confirmation as required for the command-plan surface.

Use `pnpm run provider:eas:preview` to print a deterministic EAS preview command plan without running provider commands. Generated projects include `eas-cli` so `pnpm exec eas` resolves locally. Preview planning requires `EXPO_TOKEN`, prints `pnpm exec eas project:init --non-interactive`, `pnpm exec eas env:list --environment preview`, and `pnpm exec eas build -p all -e preview --json --non-interactive`.

Use `pnpm run provider:eas:production` to print a deterministic EAS production command plan without running provider commands. Production planning requires `EXPO_TOKEN`, prints the production EAS env/build command plan, and marks production confirmation as required for the command-plan surface. App-store submission is outside the current generated framework boundary and is not automated by this plan.

Provider command output is redacted. Env add/update/remove command plans identify variable names and whether input comes from `.agentstack/env-values.json`; Clerk env pull plans identify values as coming from Clerk Dashboard or `clerk env pull`. They do not print raw values, hashes, or secrets. Vercel env plans map missing values to `pnpm exec vercel env add`, drifted values to `pnpm exec vercel env update`, and stale values to `pnpm exec vercel env rm`.

EAS env plans map missing mobile values to `pnpm exec eas env:create`, drifted values to `pnpm exec eas env:update`, and stale values to `pnpm exec eas env:delete`. Non-secret Agentstack values use EAS `plaintext` visibility; secret values use `secret` visibility. Mobile env values for EAS Build must be present in EAS server env storage, not only in local CI settings or `.env` files.

Clerk publishable keys, `CLERK_SECRET_KEY`, and `CLERK_WEBHOOK_SIGNING_SECRET` stay provider-owned. Synchronize them through the Clerk command plan and dashboard review rather than committing generated source changes that contain key material.

`validate --cloud --env <env>` checks linked services and provider env resource presence or drift against local-cloud state. Vercel and EAS stay command-plan/rehearsal surfaces. Clerk inspect is read-only. Convex apply is explicit provider execution, and command output plus telemetry remain redacted.
