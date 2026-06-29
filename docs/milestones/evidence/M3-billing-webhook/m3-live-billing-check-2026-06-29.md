# M3 Live Billing Pass - 2026-06-29

Result: **passed end-to-end against live Clerk Billing, Convex, and Vercel preview**

## Generated Consumer App

- App name: `m3-live-audit`
- Generated path: `/tmp/agentstack-m3-live-20260628/m3-live-audit`
- Package dependency: `agentstack` via `link:<agentstack-repo>/packages/agentstack`
- Preview URL: `<vercel-preview-url>`

## Commands Run

```text
corepack pnpm run billing:bootstrap -- --env preview --confirm-live-mutation
stat -f '%Sp %N' .agentstack/clerk-billing-webhook.env
./node_modules/.bin/clerk api /billing/plans --method GET --yes
./node_modules/.bin/clerk api /billing/prices --method GET --yes
Clerk browser SDK smoke-user payment-method setup with Stripe test card 4242
./node_modules/.bin/clerk api /billing/subscription_items/<free-item-id>/price_transition --method POST --app <clerk-app-id> --data <redacted price ids> --yes
corepack pnpm run billing:fixture -- grant --env preview --entitlement feature.auditLog --confirm-live-mutation
./node_modules/.bin/clerk api /users/<smoke-user-id>/billing/subscription --method GET --yes
../../node_modules/.bin/convex run billing:readM3BillingEvidence --deployment <provider-owner>:m3-live-audit:preview/m3-live-audit-preview
headless Chrome DevTools sign-in using the generated Clerk smoke user and Clerk browser SDK
corepack pnpm run billing:smoke -- --env preview --expected allowed --dom-file .agentstack/m3-allowed-dom.html
Clerk/Svix dashboard replay of the subscriptionItem.active delivery
corepack pnpm run billing:fixture -- replay-last --env preview --entitlement feature.auditLog --confirm-live-mutation
corepack pnpm run evidence:check -- --env preview --milestone M3
```

## Passed Evidence

- `billing:bootstrap`: PASS.
- Clerk Billing provider: enabled for `m3-live-audit-preview`.
- Clerk Billing Feature: `audit_log`, provider ID `<clerk-feature-id>`.
- Clerk Billing Plan: `agentstack_m3_audit_log`, provider ID `<clerk-plan-id>`.
- Clerk Billing default monthly Price: provider ID `<clerk-price-id>`, amount `$1.00`.
- Clerk/Svix webhook endpoint: configured for `https://<convex-deployment>.convex.site/agentstack/webhooks/clerk/billing`.
- Clerk/Svix endpoint ID: `<svix-endpoint-id>`.
- Convex webhook signing secret: configured in Convex preview env and stored only in hidden local state.
- Local secret file permissions: `-rw------- .agentstack/clerk-billing-webhook.env`.
- Clerk test payment source: added for the smoke user through the live preview's Clerk browser SDK; stored by Clerk,
  not in the repo.
- Clerk Billing subscription transition: free plan to `agentstack_m3_audit_log` passed through the Backend API with
  explicit `--app <clerk-app-id>`.
- Real webhook grant: Convex processed `subscriptionItem.active` and wrote allowed `feature.auditLog`.
- Allowed UI smoke: PASS with `data-agentstack-auth-state="signed-in"`,
  `data-agentstack-protected-data-state="protected-data-loaded"`, and
  `data-agentstack-entitlement-state="allowed"`.
- Real webhook replay: PASS; Svix replay of `subscriptionItem.active` produced Convex duplicate evidence with
  `duplicateCount: 1`.
- Final generated app evidence check: PASS.

Generated app evidence was written to:

```text
.agentstack/evidence/M3-billing-webhook/billing-bootstrap.txt
.agentstack/evidence/M3-billing-webhook/billing-fixture-grant.txt
.agentstack/evidence/M3-billing-webhook/billing-smoke-allowed.txt
.agentstack/evidence/M3-billing-webhook/billing-fixture-replay-last.txt
```

Raw provider stdout, webhook signing secrets, cookies, sessions, Vercel bypass secrets, Clerk keys, and smoke-user
passwords are not stored in repo evidence.

## Key Command Results

`billing:fixture grant`:

```text
PASS billing fixture grant
Entitlement state: allowed
```

`billing:smoke --expected allowed`:

```text
PASS billing smoke preview
Entitlement key: feature.auditLog
Entitlement state: allowed
```

`billing:fixture replay-last`:

```text
PASS billing fixture replay-last
Webhook replay: duplicate detected
```

`evidence:check -- --env preview --milestone M3`:

```text
PASS evidence check preview
Checked: M2 baseline evidence
Checked: billing bootstrap evidence
Checked: billing fixture evidence
Checked: billing smoke evidence
```

## Cleanup State

The M3 live path intentionally leaves provider resources active for post-M3 review:

- Clerk smoke user: active.
- Clerk test payment source: active, test card ending in `4242`.
- Clerk Billing subscription item: active on `agentstack_m3_audit_log`.
- Clerk/Svix endpoint: active.
- Convex preview deployment and Vercel preview project: active.

Known non-secret cleanup identifiers:

```text
active subscription item: <clerk-subscription-item-id>
test payment source: <clerk-payment-source-id>
```

Minimum cleanup after post-M3 review:

```text
./node_modules/.bin/clerk api /billing/subscription_items/<clerk-subscription-item-id> --method DELETE --app <clerk-app-id> --yes
corepack pnpm run billing:fixture -- delete --env preview --entitlement feature.auditLog --confirm-live-mutation
corepack pnpm run auth:user -- delete --confirm-live-mutation
```
