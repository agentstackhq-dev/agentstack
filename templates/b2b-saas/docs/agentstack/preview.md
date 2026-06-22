# Preview Rehearsal

This is a local preview deploy rehearsal. It exercises Agentstack planning, local-cloud preview state, validation, deployment artifact writing, and deployment telemetry without deploying to Vercel, running EAS builds, or calling Stripe or telemetry-provider APIs. Explicit provider execution is available only through `agentstack provider inspect/apply`.

Clerk, Convex, Vercel, and EAS have command-plan surfaces. `clerk:command-plan`, `convex:command-plan`, `vercel:command-plan`, and `eas:command-plan` mean Agentstack knows current provider CLI command shapes and can print the commands an operator would run with `Evidence: provider-command-plan`. `pnpm run provider:preview:plan` prints an aggregate preview plan for all enabled providers with `Provider execution: none`, `Mutation: none`, and `Readiness: not-claimed`; it is plan-only and preview-only. `pnpm run provider:preview:reconcile` prints an aggregate preview reconciliation plan artifact with `Evidence: provider-reconciliation-plan`, `Provider execution: none`, `Mutation: none`, `Readiness: not-claimed`, `Live state: not-read`, `Local-cloud state: not-read`, and `Operations: not-evaluated`. It uses local validation plus sanitized ledger summaries only; does not call provider executors or provider CLIs; does not read live provider, local-cloud rehearsal, or provider-link state; writes no `.agentstack/events.jsonl`, `.agentstack/local-cloud.json`, `.agentstack/provider-links.json`, provider resources, or `docs/provider-resource-ledger.md`; and does not claim exact identity, drift proof, provisioning, adoption/link confirmation, live coherence, or readiness. `provider inspect` is explicit read/diagnostic provider interaction for Clerk, Convex, Vercel preview env listing plus provider-owned project JSON listing, and EAS preview env listing with `Evidence: live-read`. Apply execution is explicit, ledger-gated, and limited to Convex commands or Vercel preview deploy only with `Evidence: live-mutation`; Convex production is guarded by `--confirm-production`, Clerk apply and EAS apply are unavailable. Generated projects include the Clerk, Convex, Vercel, and EAS CLI packages so `pnpm exec clerk`, `pnpm exec convex`, `pnpm exec vercel`, and `pnpm exec eas` resolve locally.

Supported provider apply paths require a matching `planned` or `active` ledger row before the provider executor runs. Convex preview apply requires provider `convex`, env `preview`, resource type `deployment`, and name `__APP_SLUG__-preview`. Convex production apply requires provider `convex`, env `production`, resource type `deployment`, and name `prod`. Vercel preview apply requires provider `vercel`, env `preview`, resource type `project`, and name `__APP_SLUG__`. Missing, incomplete, invalid, blocked, cleanup-pending, cleaned, or abandoned-with-reason ledger rows block mutation with `FAIL provider.ledger.*` diagnostics. `provider plan` and `provider reconcile --plan` do not require or mutate the ledger, but print sanitized summaries such as `Ledger: missing`, `Ledger: planned`, `Ledger: active`, `Ledger: blocked <status>`, or `Ledger: invalid` for supported apply targets.

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
Evidence: local-rehearsal
Scope: local-cloud state only; no live provider reads
```

Plan all enabled preview provider commands without running them:

```bash
pnpm run provider:preview:plan
```

Expected output includes:

```text
PLAN provider preview all
Evidence: provider-command-plan
Provider execution: none
Mutation: none
Readiness: not-claimed
```

Print the aggregate preview reconciliation plan artifact without provider or local-cloud reads:

```bash
pnpm run provider:preview:reconcile
```

Expected output includes:

```text
PLAN provider reconcile preview
Evidence: provider-reconciliation-plan
Provider execution: none
Mutation: none
Readiness: not-claimed
Live state: not-read
Local-cloud state: not-read
Operations: not-evaluated
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

Plan Convex preview commands without running them:

```bash
pnpm run provider:convex:preview
```

Expected output includes the preview deploy key requirement and the planned deploy command:

```text
CONVEX_DEPLOY_KEY
pnpm exec convex deploy --preview-name __APP_SLUG__-preview
Evidence: provider-command-plan
```

Convex env set/remove commands are printed with redacted values. Secret and non-secret values use `.agentstack/env-values.json` as the value source label, not the raw value. Preview env commands use `convex env --deployment <preview-deployment-name> set/remove ...` until `pnpm exec convex deploy --preview-name __APP_SLUG__-preview` has created a concrete Convex preview deployment name.

Inspect or apply explicit Convex preview provider operations:

```bash
pnpm run provider:convex:inspect:preview
pnpm run provider:convex:apply:preview
```

Convex inspect/apply requires `CONVEX_DEPLOY_KEY`, keeps raw values out of output, prints `Evidence: live-read` for inspect or `Evidence: live-mutation` for apply, and records redacted `agentstack.provider.inspect.completed` or `agentstack.provider.apply.completed` telemetry.

Plan Clerk preview commands without running them:

```bash
pnpm run provider:clerk:preview
```

Expected output includes Clerk initialization, diagnostic, env pull, and config pull commands:

```text
pnpm exec clerk init -y
pnpm exec clerk doctor --mode agent
pnpm exec clerk env pull --mode agent
pnpm exec clerk config pull --mode agent
Evidence: provider-command-plan
```

Inspect explicit read-only Clerk preview diagnostics:

```bash
pnpm run provider:clerk:inspect:preview
```

Clerk inspect requires an authenticated Clerk CLI or `CLERK_SECRET_KEY`, depending on local setup. Clerk apply is unavailable.

Plan Vercel preview commands without running them:

```bash
pnpm run provider:vercel:preview
```

Expected output includes the Vercel token requirement, the linked project warning, and the planned preview deploy command:

```text
VERCEL_TOKEN
vercel link
pnpm exec vercel deploy --target=preview
Evidence: provider-command-plan
```

Vercel env add/update/remove commands are printed with redacted values. Secret and non-secret values use `.agentstack/env-values.json` as the value source label, not the raw value.

Inspect explicit read-only Vercel preview evidence:

```bash
pnpm run provider:vercel:inspect:preview
```

Vercel preview inspect runs only `pnpm exec vercel env ls preview` and `pnpm exec vercel project ls --json` through the provider executor. The env-list read can provide sanitized preview environment-scope evidence. The provider-owned project JSON read can provide sanitized stable project, provider owner, and provider resource evidence, and can participate in exact preview identity proof only when it is a single strict JSON row matched against the manifest, ledger proof context, and local project-link comparison. `.vercel/project.json` alone is local link-state evidence only. This evidence is not link/adopt authorization, drift/live coherence, readiness, or permission to mutate.

Apply the explicit Vercel preview deploy:

```bash
pnpm run provider:vercel:apply:preview
```

This executes only `pnpm exec vercel deploy --target=preview` through the provider executor after the ledger gate passes, prints `Evidence: live-mutation`, and records redacted provider apply telemetry. It does not run Vercel env add/update/remove commands, and Vercel production apply is unavailable.

Plan EAS preview commands without running them:

```bash
pnpm run provider:eas:preview
```

Expected output includes the Expo token requirement and planned project/env/build commands:

```text
EXPO_TOKEN
pnpm exec eas project:init --non-interactive
pnpm exec eas env:list --environment preview
pnpm exec eas build -p all -e preview --json --non-interactive
Evidence: provider-command-plan
```

EAS env create/update/delete commands are printed with redacted value placeholders. EAS Build uses server-side EAS env values, not local CI variables alone.

Print the default local provider inventory control-plane view without provider executor use:

```bash
node scripts/agentstack.mjs provider inventory --service convex --env preview
```

Expected output includes either `Evidence: local-inventory` or `Evidence: ledger-local-inventory`. Inventory reads manifest expectations, local provider links, and matching ledger rows only. It writes no files, does not call provider CLIs, does not prove the provider resource exists externally, and does not treat `.agentstack/local-cloud.json` sync links as external truth.

Run bounded read-only live inventory when you need live read evidence without mutation:

```bash
node scripts/agentstack.mjs provider inventory --service convex --env preview --source live
```

Expected output includes `Evidence: live-read-inventory`, `Mutation: none`, command/result counts, redacted live status fields, and sanitized `missing=` labels for unavailable identity proof. Live inventory calls only the selected service's existing read-only inspect primitive. It keeps `identity=ambiguous`; partial env-list facts are not exact provider identity.

Run the preview-only provider proof contract check after adding a matching planned or active ledger row:

```bash
pnpm run provider:convex:proof:preview
```

Expected Convex output includes `FAIL provider proof convex preview`, `Evidence: live-proof-check`, `Provider execution: read-only`, `Local-cloud state: not-read`, `Identity proof: ambiguous` or `unavailable`, `Drift proof: partial` only where structured preview env-list gates pass, `Readiness: refused`, and sanitized identity/drift proof requirement labels. Clerk preview application proof can print sanitized exact identity and `Drift proof: partial` with `Drift evaluator: clerk-apps-list-preview` when the strict apps-list and ledger/manifest gates pass, or `Drift evaluator: clerk-config-preview` when strict preview env/config JSON also proves fixed sanitized category presence after exact app-list identity. Vercel preview project proof can print sanitized exact identity when the strict provider-owned project JSON row matches manifest, ledger, and local project-link comparison gates. Convex partial drift evidence is diagnostic only: Convex still has no exact provider identity, no exact drift/live coherence, no readiness proof, no live-safe link/adopt confirmation, and no mutation permission. Both Clerk and Vercel exact proof paths still exit 1 with `Readiness: refused`; Vercel exact identity evidence does not prove link/adopt authorization or live drift/coherence. Missing, invalid, incomplete, or blocked ledger state fails closed before provider executor use with `Provider execution: none`. Proof never writes telemetry, local-cloud, provider-link, provider resource, or ledger state, and it does not claim exact drift proof, provisioning, link/adoption confirmation, live coherence, or readiness.

Write a local provider link after adding a matching planned or active ledger row:

```bash
node scripts/agentstack.mjs provider link --service convex --env preview --resource-type deployment --name __APP_SLUG__-preview
```

Link requires a matching `planned` or `active` row in `docs/provider-resource-ledger.md` and writes only `.agentstack/provider-links.json`. It does not mutate the root provider ledger, telemetry, local-cloud state, or provider resources.
Use `--source live` to require the same ledger gate and then run only read-only live inventory/inspect before confirming. Current live evidence is partial or ambiguous only, so live link refuses with sanitized identity proof requirements and no local, provider, or ledger mutation.

Print a redacted adopt proposal for operator review:

```bash
node scripts/agentstack.mjs provider adopt --service convex --env preview --resource-type deployment --name __APP_SLUG__-preview --external-id <id-or-url> --owner <owner> --purpose <purpose> --created-by <name> --created-at <yyyy-mm-dd> --cleanup <procedure> --cleanup-trigger <trigger-or-date> --evidence <path-or-url>
```

Adopt is print-only in this slice. It does not mutate the root provider ledger, `.agentstack/provider-links.json`, telemetry, local-cloud state, or provider resources. Generated package scripts intentionally expose inventory/link only, not adopt, because adopt needs operator-specific external ID, owner, purpose, creation, cleanup, and evidence fields. Review the proposal and manually update the ledger before running link or any supported provider apply command.
Use `--source live` to run only read-only live inventory/inspect without requiring an existing ledger row. Current live evidence is partial or ambiguous only, so live adopt refuses with sanitized identity proof requirements, without printing a proposal or writing local, provider, or ledger state. Link and adopt do not support the inventory-only `--live` shorthand.

Inspect explicit read-only EAS preview env state:

```bash
pnpm run provider:eas:inspect:preview
```

This executes only `pnpm exec eas env:list --environment preview` through the provider executor and prints `Evidence: live-read`. It does not run `eas project:init`, `eas build`, EAS env create/update/delete commands, production inspect, or EAS apply.

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
- `.agentstack/events.jsonl` records redacted telemetry such as `agentstack.deploy.completed`, `agentstack.provider.inspect.completed`, and `agentstack.provider.apply.completed`.

`pnpm run preview:plan`, `pnpm run preview:validate`, and `pnpm run preview:deploy` do not write deployment artifacts.

## Non-Goals

- This is not a Stripe or telemetry-provider deployment, and local preview deploy/build rehearsals do not run provider CLIs as side effects.
- Plan, sync, deploy, and build commands do not execute provider CLIs. Provider execution is explicit only through `agentstack provider inspect/apply`.
- Clerk inspect, Vercel preview inspect, and EAS preview inspect are read-only. Convex apply executes Convex commands. Vercel preview apply executes only the preview deploy command. Clerk apply, EAS apply, Vercel production inspect/apply, Vercel env mutation execution, and EAS build/init/env mutation execution are unavailable.
- It does not prove production readiness.
- It does not replace provider credentials, real CI/CD, app builds, smoke tests, or production release approval.

Use this runbook to rehearse the framework path and choose explicit provider inspect/apply only when diagnostics, Convex execution, Vercel preview env-list or deploy execution, or EAS preview env-list inspection are required.
