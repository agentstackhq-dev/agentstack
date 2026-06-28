# Preview Rehearsal

This is a local preview deploy rehearsal. It exercises Agentstack planning, local-cloud preview state, validation, deployment artifact writing, and deployment telemetry without deploying to Vercel, running EAS builds, or calling Stripe or telemetry-provider APIs. Explicit provider execution is available only through `agentstack provider inspect/apply`.

Clerk, Convex, Vercel, and EAS have command-plan surfaces. `clerk:command-plan`, `convex:command-plan`, `vercel:command-plan`, and `eas:command-plan` mean Agentstack knows current provider CLI command shapes and can print the commands an operator would run with `Evidence: provider-command-plan`. `pnpm run provider:preview:plan` and `pnpm run provider:production:plan` print aggregate plans for all enabled providers with `Provider execution: none`, `Mutation: none`, and `Readiness: not-claimed`; they are plan-only, do not read live providers, and print sanitized `Resource`, `Ledger`, and `Lifecycle` lines for each expected provider resource. `Lifecycle` is a plan decision only: `create`, `provision`, `update`, `no-op`, or `blocked` never authorizes provider mutation on its own. `pnpm run provider:preview:reconcile` and `pnpm run provider:production:reconcile` print local-only aggregate reconciliation plan artifacts with `Evidence: provider-reconciliation-plan`, `Provider execution: none`, `Mutation: none`, `Readiness: not-claimed`, `Live state: not-read`, `Local-cloud state: not-read`, and `Operations: not-evaluated`. They use local validation plus sanitized ledger summaries only; do not call provider executors or provider CLIs; do not read live provider, local-cloud rehearsal, or provider-link state; write no `.agentstack/events.jsonl`, `.agentstack/local-cloud.json`, `.agentstack/provider-links.json`, provider resources, or `docs/provider-resource-ledger.md`; and do not claim exact identity, drift proof, provisioning, adoption/link confirmation, live coherence, or readiness. `pnpm run provider:preview:reconcile:live` and `pnpm run provider:production:reconcile:live` run explicit aggregate live-read reconciliation with `Evidence: live-reconciliation-plan`, `Provider execution: read-only`, `Mutation: none`, `Live state: read`, `Local-cloud state: not-read`, `Readiness: not-claimed`, and per-service proof diagnostics; they call only bounded read-only inventory/inspect primitives, summarize sanitized per-provider current status, and fail with `Reason: live-read-failed` when any live read fails. Live reconciliation writes no telemetry, local-cloud, provider-link, provider resource, or ledger state, and it is still not readiness, exact drift/live coherence, link/adopt authorization, or mutation permission. `provider inspect` is explicit read/diagnostic provider interaction for Clerk, Convex, Vercel preview/production env listing plus provider-owned project JSON listing, and EAS preview/production env listing with `Evidence: live-read`. Apply execution is explicit, ledger-gated, and limited to Convex commands or Vercel preview deploy only with `Evidence: live-mutation`; Convex production is guarded by `--confirm-production`, Clerk apply, Vercel production apply, and EAS apply are unavailable. Generated projects include the Clerk, Convex, Vercel, and EAS CLI packages so `pnpm exec clerk`, `pnpm exec convex`, `pnpm exec vercel`, and `pnpm exec eas` resolve locally.

Supported provider apply paths require a matching `planned` or `active` ledger row before the provider executor runs. Convex preview apply requires provider `convex`, env `preview`, resource type `deployment`, and name `__APP_SLUG__-preview`. Convex production apply requires provider `convex`, env `production`, resource type `deployment`, and name `prod`. Vercel preview apply requires provider `vercel`, env `preview`, resource type `project`, and name `__APP_SLUG__`. Missing, incomplete, invalid, blocked, cleanup-pending, cleaned, or abandoned-with-reason ledger rows block mutation with `FAIL provider.ledger.*` diagnostics. `provider plan` does not require or mutate the ledger, but prints sanitized summaries such as `Resource: project __APP_SLUG__`, `Ledger: missing`, and `Lifecycle: create` for every expected provider resource. `provider reconcile --plan` does not require or mutate the ledger either; it remains an unknown-current-state reconciliation artifact.

## M1 web-only preview path

Use this path when validating Agentstack M1 Preview E2E. M1 is web-only: it covers Clerk, Convex, and Vercel preview resources. Start with the aggregate provider plan to see intended lifecycle, then run the live bootstrap command:

```bash
pnpm run provider:preview:plan
```

```bash
pnpm run m1:providers:bootstrap -- --confirm-live-mutation --created-by <name>
```

`m1:providers:bootstrap` is the primary M1 Ledger + Connect entrypoint. It uses local provider CLIs to create or reuse the Clerk preview application, Convex preview deployment, and Vercel project, records planned rows before create where needed, replaces them with active ledger rows once real resources exist, runs Clerk/Vercel link commands, saves Convex deploy-key env to `.agentstack/convex-preview.env`, configures the minimum Convex and Vercel runtime env needed for M1, and writes redacted `provider-bootstrap.txt` evidence.

Provider CLI authentication, browser login, and Convex account/project selection are part of the path. If a CLI prints a login URL or interactive project selection requirement, complete that handoff and rerun the same bootstrap command. Do not replace this with undocumented dashboard setup or manual resource transcription.

Use `m1:ledger:record` only as a low-level fallback when repairing rows or recording known existing resources that bootstrap cannot discover:

```bash
export M1_CLERK_EXTERNAL_ID=<real-id-or-url>
export M1_CONVEX_EXTERNAL_ID=<real-id-or-url>
export M1_VERCEL_EXTERNAL_ID=<real-id-or-url>
pnpm run m1:ledger:record -- --owner <owner-account-or-project> --created-by <name> --created-at <yyyy-mm-dd> --status active --replace
```

Update `docs/milestones/evidence/M1-preview-e2e/runbook.md` as each real M1 step runs. Keep command notes redacted and do not paste raw provider CLI output, tokens, cookies, or raw DOM snapshots.

After the three active M1 ledger rows exist, link the preview resources into local Agentstack provider-link state:

```bash
pnpm run m1:providers:link
```

`m1:providers:link` requires active Clerk, Convex, and Vercel M1 ledger rows before it calls the existing ledger-gated `provider link` commands. It writes `.agentstack/provider-links.json` plus redacted M1 link evidence at `docs/milestones/evidence/M1-preview-e2e/provider-links.txt`, prints `Evidence: m1-provider-link`, and does not call provider CLIs, mutate provider resources, mutate the ledger, or write telemetry. If any link command fails, it restores the previous `.agentstack/provider-links.json` state, removes stale `provider-links.txt`, and writes no `provider-links.txt` success evidence. This is local connection state, not external provider existence proof.

After active ledger rows and local provider links exist, run the explicit M1 deploy helper:

```bash
pnpm run m1:preview:deploy -- --confirm-live-mutation
```

`m1:preview:deploy` requires active Clerk, Convex, and Vercel M1 ledger rows plus `.agentstack/provider-links.json` and top-level `Result: PASS` `provider-links.txt` evidence from a passing `m1:providers:link` run before provider execution. Missing, failed, or incomplete provider-link state prints `FAIL m1 preview deploy.provider-links-required` before provider execution and writes no deploy evidence. It then runs the existing ledger-gated `provider apply` command for Convex preview, then the existing ledger-gated `provider apply` command for Vercel preview. It requires `--confirm-live-mutation`, prints `Evidence: m1-preview-deploy`, captures the emitted Vercel `Deploy URL: ...` line, and writes only redacted local evidence files under `docs/milestones/evidence/M1-preview-e2e/`: `deploy-url.txt` and `deploy-output.txt`. When provider execution starts but the deploy attempt fails, it removes any stale `deploy-url.txt`, still writes `deploy-output.txt` with `Result: FAIL`, the failed stage, per-provider completion status, and no raw provider stdout, stderr, identifiers, tokens, or secrets. Any deploy attempt that reaches provider execution removes stale `smoke-output.txt` so Auth/Data smoke evidence must be rerun for the current deploy state. Active-ledger and provider-link refusals happen before provider execution and write no deploy evidence. Provider mutation is real Convex preview apply plus Vercel preview deploy; telemetry mutation is whatever the underlying provider apply commands record.

Do not ledger, link, apply, or inspect EAS for M1 unless mobile scope is explicitly unlocked. `pnpm run provider:preview:plan`, `pnpm run preview:plan`, `pnpm run preview:apply`, and the local preview deploy rehearsal still include EAS because the full B2B SaaS template includes mobile; treat those as broader template rehearsals, not the M1 web-only path.

## M1 deployed smoke markers

After `m1:preview:deploy` writes `deploy-url.txt` and a `Result: PASS` `deploy-output.txt`, open that same URL and sign in through Clerk. Record redacted evidence when the deployed DOM shows `data-agentstack-auth-state="signed-in"` and the protected Convex call resolves with `data-agentstack-protected-data-state="protected-data-loaded"` plus `data-agentstack-protected-workspace-id`. Do not mark M1 Auth or Data complete from local builds, runtime-placeholder output, unmatched deploy URLs, or `signed-out` state alone.

For repeatable evidence capture, save a temporary post-sign-in DOM snapshot outside git, then run the generated smoke helper:

```bash
mkdir -p .agentstack
# In the signed-in browser console, run:
# copy(document.documentElement.outerHTML)
# Paste that clipboard text into .agentstack/m1-preview-dom.html without committing it.
pnpm run m1:preview:smoke -- --url <deploy-url> --dom-file .agentstack/m1-preview-dom.html
```

`m1:preview:smoke` first requires `deploy-url.txt` and `deploy-output.txt` from a `m1:preview:deploy` run with top-level `Result: PASS` deploy evidence, and both deploy evidence files must match the `--url` value after URL normalization. If deploy evidence is missing, failed, or for a different URL, it prints `FAIL m1 preview smoke.deploy-evidence-required` and writes no smoke evidence. With matching deploy evidence, it writes `smoke-output.txt` with `Result: PASS` or a redacted `Result: FAIL` marker blocker; on pass it also refreshes `deploy-url.txt`. It refuses unless the DOM snapshot contains the signed-in auth marker, the loaded protected-data marker, and a non-empty protected workspace id marker. Smoke evidence records the DOM source only as a redacted local temporary file marker, not the supplied path. Do not commit the raw DOM snapshot, provider identifiers, cookies, or tokens.

If the DOM is Vercel's Deployment Protection login page, `m1:preview:smoke` records a specific Vercel protection blocker. Complete one of the real access handoffs before claiming Auth/Data: authenticate in a Vercel-authorized browser and capture the post-Clerk DOM, configure Vercel Protection Bypass for Automation and pass the bypass secret to the browser/test, or disable protection for the M1 preview in the Vercel project settings.

After the runbook, ledger notes, deploy evidence, and smoke output are updated, run the local evidence checker:

```bash
pnpm run m1:evidence:check
```

`m1:evidence:check` prints `Evidence: m1-evidence-check`, checks the redacted local M1 evidence bundle plus `.agentstack/provider-links.json`, verifies that provider-link, deploy, and smoke evidence each have a top-level `Result: PASS`, verifies that the provider-link state contains active Clerk, Convex, and Vercel preview links, verifies that `deploy-url.txt`, `deploy-output.txt`, and `smoke-output.txt` all name the same preview URL, verifies smoke `Checked at` is not older than deploy `Checked at`, rejects the untouched scaffold runbook, unresolved runbook placeholders, missing runbook step result lines, failed/not-run step results, missing final required M1 checkbox review lines, and final checkbox values other than pass, and does not call provider CLIs, mutate provider resources, write local state, or append telemetry. Do not treat a passing evidence check as live provider readiness; it only proves the local evidence bundle and local link state are complete enough for M1 review.

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

Print explicit aggregate preview live reconciliation without mutation:

```bash
pnpm run provider:preview:reconcile:live
```

Expected output includes:

```text
PLAN provider reconcile preview
Evidence: live-reconciliation-plan
Provider execution: read-only
Mutation: none
Readiness: not-claimed
Live state: read
Local-cloud state: not-read
```

Per-service sections also include proof diagnostics such as `Identity proof`, exact or candidate identity evidence, `Drift proof`, and `Live coherence`; these are diagnostics only and do not make live reconciliation a readiness pass. If any read-only provider inventory call fails, the command exits nonzero with `FAIL provider reconcile preview` and `Reason: live-read-failed`; it still writes no local state, telemetry, provider resources, provider links, local-cloud state, or ledger entries.

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

Inspect explicit Convex preview or production provider state, or apply explicit Convex preview provider operations:

```bash
pnpm run provider:convex:inspect:preview
pnpm run provider:convex:inspect:production
pnpm run provider:convex:apply:preview
```

Convex inspect/apply requires `CONVEX_DEPLOY_KEY`, keeps raw values out of output, and prints `Evidence: live-read` for inspect or `Evidence: live-mutation` for apply. Production inspect runs only `pnpm exec convex env --prod list` and is read-only. Convex apply records redacted provider apply telemetry and remains ledger-gated.

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

Vercel env add/update/remove commands are printed with redacted values. Secret and non-secret values use `.agentstack/env-values.json` as the value source label, not the raw value. The generated root `vercel.json` pins the Vercel framework preset to Vite, builds `@app/web`, and serves `apps/web/dist` so the root deploy command targets the generated web app in the monorepo.

Inspect explicit read-only Vercel preview or production evidence:

```bash
pnpm run provider:vercel:inspect:preview
pnpm run provider:vercel:inspect:production
```

Vercel inspect runs only `pnpm exec vercel env ls <env>` and `pnpm exec vercel project ls --json` through the provider executor. The env-list read can provide sanitized requested-environment-scope evidence. The provider-owned project JSON read can provide sanitized stable project, provider owner, and provider resource evidence, and can participate in exact identity proof only when it is a single strict JSON row matched against the manifest, ledger proof context, requested environment, and local project-link comparison. `.vercel/project.json` alone is local link-state evidence only. This evidence is not link/adopt authorization, drift/live coherence, readiness, or permission to mutate.

Apply the explicit Vercel preview deploy:

```bash
pnpm run provider:vercel:apply:preview
```

This executes only `pnpm exec vercel deploy --target=preview` through the provider executor after the ledger gate passes, prints `Evidence: live-mutation`, uses the generated root `vercel.json` to build and serve `apps/web`, extracts the first `https://*.vercel.app` URL as `Deploy URL: ...` for the M1 evidence bundle, and records redacted provider apply telemetry. It does not run Vercel env add/update/remove commands, and Vercel production apply is unavailable.

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

Expected output includes `Evidence: live-read-inventory`, `Mutation: none`, command/result counts, redacted live status fields, sanitized candidate identity evidence summaries when read-only candidate labels are available, and sanitized `missing=` labels for unavailable identity proof. Live inventory calls only the selected service's existing read-only inspect primitive. It keeps `identity=ambiguous`; partial env-list facts and candidate identity evidence are not exact provider identity.

Run the provider proof contract check after adding a matching planned or active ledger row:

```bash
pnpm run provider:convex:proof:preview
```

Expected Convex output includes `FAIL provider proof convex preview`, `Evidence: live-proof-check`, `Provider execution: read-only`, `Local-cloud state: not-read`, `Identity proof: ambiguous` or `unavailable`, `Drift proof: partial` only where structured preview env-list gates pass, `Readiness: refused`, and sanitized identity/drift proof requirement labels. Clerk preview application proof can print sanitized exact identity and `Drift proof: partial` with `Drift evaluator: clerk-apps-list-preview` when the strict apps-list and ledger/manifest gates pass, or `Drift evaluator: clerk-config-preview` when strict preview env/config JSON also proves fixed sanitized category presence after exact app-list identity. `pnpm run provider:clerk:proof:production` can print sanitized exact identity for a matching production Clerk application row, but it is exact-identity diagnostic only and still reports drift unproven/live coherence blocked. `pnpm run provider:convex:proof:production` can run bounded `convex env --prod list`, but it remains read evidence only with no exact identity or readiness. Vercel preview or production project proof can print sanitized exact identity when strict provider-owned project JSON matches manifest, ledger, local project-link, and requested environment-scope gates; production Vercel proof can also report partial `env-list-production` drift diagnostics while still refusing readiness. EAS preview or production project proof can print sanitized exact identity when `eas project:info` provider-owned `fullName`/`ID`, local Expo `extra.eas.projectId`, manifest, ledger, owner, and requested environment-scope gates match; production EAS proof can also report partial `env-list-production` drift diagnostics while still refusing readiness. Convex partial drift evidence is diagnostic only: Convex still has no exact provider identity, no exact drift/live coherence, no readiness proof, no live-safe link/adopt confirmation, and no mutation permission. Clerk, Vercel, and EAS exact proof paths still exit 1 with `Readiness: refused`; Vercel/EAS exact identity evidence and partial drift do not prove link/adopt authorization or exact live drift/coherence. Missing, invalid, incomplete, or blocked ledger state fails closed before provider executor use with `Provider execution: none`. Proof never writes telemetry, local-cloud, provider-link, provider resource, or ledger state, and it does not claim exact drift proof, provisioning, link/adoption confirmation, live coherence, or readiness.

Write a local provider link after adding a matching planned or active ledger row:

```bash
node scripts/agentstack.mjs provider link --service convex --env preview --resource-type deployment --name __APP_SLUG__-preview
```

Link requires a matching `planned` or `active` row in `docs/provider-resource-ledger.md` and writes only `.agentstack/provider-links.json`. It does not mutate the root provider ledger, telemetry, local-cloud state, or provider resources.
Use `--source live` to require the same ledger gate and then run only read-only live inventory/inspect before confirming. Ledger-backed Clerk/Vercel/EAS live link can surface exact `identity=matched` evidence where provider-owned proof context matches, but it still refuses with `provider.link.live-coherence-blocked|unavailable` until exact live coherence exists; ambiguous evidence still prints sanitized identity proof requirements. No live-link refusal writes local, provider, telemetry, local-cloud, provider-link, or ledger state.

Print a redacted adopt proposal for operator review:

```bash
node scripts/agentstack.mjs provider adopt --service convex --env preview --resource-type deployment --name __APP_SLUG__-preview --external-id <id-or-url> --owner <owner> --purpose <purpose> --created-by <name> --created-at <yyyy-mm-dd> --cleanup <procedure> --cleanup-trigger <trigger-or-date> --evidence <path-or-url>
```

Adopt is print-only in this slice. It does not mutate the root provider ledger, `.agentstack/provider-links.json`, telemetry, local-cloud state, or provider resources. Generated package scripts intentionally expose inventory/link only, not adopt, because adopt needs operator-specific external ID, owner, purpose, creation, cleanup, and evidence fields. Review the proposal and manually update the ledger before running link or any supported provider apply command.
Use `--source live` to run only read-only live inventory/inspect without requiring an existing ledger row. Clerk/Vercel/EAS live adopt can use the supplied resource type, name, external ID, and owner as exact proof context when that resource also matches the manifest; matching provider-owned evidence may surface `identity=matched`. Exact identity still does not print a proposal or authorize adoption while live coherence is blocked or unavailable: live adopt refuses with `provider.adopt.live-coherence-blocked|unavailable`. Ambiguous evidence still refuses with sanitized identity proof requirements, and every live-adopt refusal writes no local, provider, telemetry, local-cloud, provider-link, or ledger state. Link and adopt do not support the inventory-only `--live` shorthand.

Inspect explicit read-only EAS preview or production env state:

```bash
pnpm run provider:eas:inspect:preview
pnpm run provider:eas:inspect:production
```

This executes only `pnpm exec eas env:list --environment <preview|production>` through the provider executor and prints `Evidence: live-read`. It does not run `eas project:init`, `eas build`, EAS env create/update/delete commands, or EAS apply.

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
- Clerk inspect, Convex preview/production inspect, Vercel preview/production inspect, and EAS preview/production inspect are read-only. Convex apply executes Convex commands. Vercel preview apply executes only the preview deploy command. Clerk apply, EAS apply, Vercel production apply, Vercel env mutation execution, and EAS build/init/env mutation execution are unavailable.
- It does not prove production readiness.
- It does not replace provider credentials, real CI/CD, app builds, smoke tests, or production release approval.

Use this runbook to rehearse the framework path and choose explicit provider inspect/apply only when diagnostics, Convex execution, Vercel preview/production env-list inspection, Vercel preview deploy execution, or EAS preview/production env-list inspection are required.
