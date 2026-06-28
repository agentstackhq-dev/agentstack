# M3 Live Billing Webhook Attempt - 2026-06-28

Result: **blocked by provider configuration**

## Generated Consumer App

- App name: `m3-live-audit`
- Generated path: `/tmp/agentstack-m3-live-20260628/m3-live-audit`
- Package dependency: `agentstack` via `link:<agentstack-repo>/packages/agentstack`
- Preview URL: `<vercel-preview-url>`

The generated root remained lean. No generated `docs/`, `scripts/`, root `convex/`, root `vercel.json`, or provider
ledger files were copied into the consumer app.

## Commands Run

```text
corepack pnpm install
corepack pnpm run validate
corepack pnpm run provider:bootstrap -- --env preview --confirm-live-mutation
../../node_modules/.bin/convex deployment create <provider-owner>:m3-live-audit:m3-preview --type preview --region us --select --expiration "in 5 days"
../../node_modules/.bin/convex dev --once --typecheck disable
corepack pnpm run provider:bootstrap -- --env preview --confirm-live-mutation
corepack pnpm run provider:link
corepack pnpm run preview:deploy -- --confirm-live-mutation
corepack pnpm run auth:user -- ensure --confirm-live-mutation
vercel project protection enable m3-live-audit --protection-bypass --scope <vercel-team-id> --no-color
headless Chrome DevTools sign-in using the generated Clerk smoke user and Clerk browser SDK
corepack pnpm run preview:smoke -- --url <preview-url> --dom-file .agentstack/m2-smoke-dom.html
corepack pnpm run billing:smoke -- --env preview --expected denied --dom-file .agentstack/m3-denied-dom.html
corepack pnpm run billing:bootstrap -- --env preview --confirm-live-mutation
corepack pnpm run billing:fixture -- ensure --env preview --entitlement feature.auditLog --confirm-live-mutation
corepack pnpm run billing:fixture -- grant --env preview --entitlement feature.auditLog --confirm-live-mutation
corepack pnpm run evidence:check -- --env preview --milestone M3
```

## Passed Evidence

- `validate`: PASS.
- `provider:bootstrap`: PASS after Convex project/deployment context existed.
- `provider:link`: PASS.
- `preview:deploy`: PASS.
- `auth:user ensure`: PASS.
- Vercel Deployment Protection bypass: PASS using a project automation bypass and a browser bypass cookie.
- Clerk sign-in repeatability: PASS using the generated smoke user and Clerk browser SDK `signIn.create()` in the app page context.
- `preview:smoke`: PASS with `data-agentstack-auth-state="signed-in"` and
  `data-agentstack-protected-data-state="protected-data-loaded"`.
- `billing:smoke --expected denied`: PASS with `feature.auditLog` denied from default state.
- `billing:fixture ensure`: PASS, creating the Convex fixture principal for the smoke user.

Generated app evidence files were written under:

```text
.agentstack/evidence/M2-agent-completes-m1/
.agentstack/evidence/M3-billing-webhook/
```

Raw DOM snapshots, cookies, smoke-user password, Vercel bypass secret, Convex deploy key, Clerk keys, and Svix one-time
dashboard URLs are not stored in repo evidence.

## Live Blocker

`agentstack billing bootstrap --env preview --confirm-live-mutation` now verifies Clerk Billing before attempting webhook
secret setup. Clerk returned:

```text
billing_not_enabled
The billing feature is not enabled for this instance. You can enable it at https://dashboard.clerk.com.
```

The package-owned command records this as:

```text
FAIL billing bootstrap preview
Reason: Provider action required: enable Clerk Billing for Clerk application m3-live-audit-preview.
Expected feature slug: audit_log.
Expected plan slug: agentstack_m3_audit_log.
After Billing is enabled, rerun agentstack billing bootstrap --env preview --confirm-live-mutation.
```

Because Clerk Billing is disabled on the preview Clerk application, M3 could not produce:

- a real Clerk Billing grant event,
- a real Clerk Billing webhook delivery to Convex,
- allowed `feature.auditLog` state in the Vercel preview UI,
- duplicate webhook replay evidence,
- final `evidence:check -- --env preview --milestone M3` pass.

`billing:fixture grant` correctly failed with provider-action-required because no real Clerk Billing event had updated
Convex entitlement state.

`evidence:check -- --env preview --milestone M3` correctly failed on missing PASS evidence for billing bootstrap,
billing fixture grant, billing fixture replay-last, and billing smoke allowed.

## Next Exact Step

In Clerk Dashboard for `m3-live-audit-preview`:

1. Enable Clerk Billing for the instance.
2. Create or verify Feature slug `audit_log`.
3. Create or verify Plan slug `agentstack_m3_audit_log`.
4. Create or verify the Svix webhook endpoint for:
   `https://<convex-deployment>.convex.site/agentstack/webhooks/clerk/billing`
5. Subscribe/grant the smoke principal to the plan so Clerk sends a real Billing event.
6. Save the webhook endpoint signing secret only in hidden local state:
   `.agentstack/clerk-billing-webhook.env` as `CLERK_WEBHOOK_SIGNING_SECRET=<secret>`.
7. Rerun:

```text
corepack pnpm run billing:bootstrap -- --env preview --confirm-live-mutation
corepack pnpm run billing:fixture -- grant --env preview --entitlement feature.auditLog --confirm-live-mutation
capture allowed DOM through the same Clerk browser SDK sign-in path
corepack pnpm run billing:smoke -- --env preview --expected allowed --dom-file .agentstack/m3-allowed-dom.html
corepack pnpm run billing:fixture -- replay-last --env preview --entitlement feature.auditLog --confirm-live-mutation
corepack pnpm run evidence:check -- --env preview --milestone M3
```
