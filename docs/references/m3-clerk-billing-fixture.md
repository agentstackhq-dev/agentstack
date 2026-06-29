# M3 Clerk Billing Fixture Workflow

This is the repeatable M3 path for setting up Clerk Billing, attaching a test payment method, moving the smoke user
onto the configured plan, and proving the real webhook entitlement gate. Run commands from a fresh generated app root,
not from the Agentstack framework repo.

The fixture is intentionally package-owned. Generated apps should keep only ignored `.agentstack/` runtime state and
the lean root files from the M2 contract.

## Inputs

- `agentstack.config.ts` maps `feature.auditLog` to Clerk Billing feature slug `audit_log` and plan slug
  `agentstack_m3_audit_log`.
- `pnpm run provider:bootstrap`, `pnpm run provider:link`, `pnpm run preview:deploy`, and
  `pnpm run auth:user -- ensure` have passed.
- The generated `.agentstack/auth-user.json`, `.agentstack/provider-resources.json`, and
  `.agentstack/provider-links.json` files exist.
- Clerk Billing is enabled for the preview Clerk application with the Clerk test payment gateway.

## Provider Setup

In Clerk, the preview application must have:

- Billing enabled.
- Feature slug: `audit_log`.
- Plan slug: `agentstack_m3_audit_log`.
- The `audit_log` feature attached to the `agentstack_m3_audit_log` plan.
- A default price on the plan.

`billing:bootstrap` verifies the configured plan/feature shape and configures the Convex webhook target:

```sh
pnpm run billing:bootstrap -- --env preview --confirm-live-mutation
```

If this reports `billing_not_enabled`, enable Clerk Billing for the exact preview Clerk application named in the
command output, create the feature/plan above, then rerun the command.

## Fixture Lifecycle

Create the Convex-side smoke billing principal in the default denied state:

```sh
pnpm run billing:fixture -- ensure --env preview --entitlement feature.auditLog --confirm-live-mutation
```

Capture the signed-in denied DOM from the preview URL and verify it:

```sh
pnpm run billing:smoke -- --env preview --expected denied --dom-file .agentstack/m3-denied-dom.html
```

Move the Clerk smoke user from the free subscription item to the configured plan:

```sh
pnpm run billing:fixture -- subscribe --env preview --entitlement feature.auditLog --confirm-live-mutation
```

The command uses Clerk Backend API reads with the preview app id, verifies that the configured plan contains the
configured feature, finds the default target price, and calls Clerk's subscription item price transition endpoint.
It writes non-secret state to `.agentstack/billing-fixture.json` and evidence to
`.agentstack/evidence/M3-billing-webhook/billing-fixture-subscribe.txt`.

If Clerk returns `payment_method_required_for_transition`, add a test payment method through the live preview Clerk
browser SDK, then rerun `billing:fixture -- subscribe`.

After the real Clerk Billing webhook arrives, verify the Convex grant and the allowed UI:

```sh
pnpm run billing:fixture -- grant --env preview --entitlement feature.auditLog --confirm-live-mutation
pnpm run billing:smoke -- --env preview --expected allowed --dom-file .agentstack/m3-allowed-dom.html
```

Replay the last Billing delivery from the Clerk/Svix dashboard, then verify idempotency and final evidence:

```sh
pnpm run billing:fixture -- replay-last --env preview --entitlement feature.auditLog --confirm-live-mutation
pnpm run evidence:check -- --env preview --milestone M3
```

## Test Payment Method Handoff

Use the live preview page for payment-method setup so Clerk attaches the card to the correct preview application and
smoke user. Do not store setup intent secrets, payment tokens, card numbers, session cookies, or the smoke-user
password in repo files.

1. Open the deployed preview URL with any required Vercel automation bypass.
2. Sign in as the generated smoke user from `.agentstack/auth-user.json`.
3. Run this script in the signed-in page console.
4. Confirm that it prints a non-secret payment source id and `last4: "4242"`.
5. Rerun `pnpm run billing:fixture -- subscribe --env preview --entitlement feature.auditLog --confirm-live-mutation`.

```js
async function addAgentstackM3TestPaymentMethod() {
  const clerk = globalThis.Clerk;
  if (!clerk?.user) {
    throw new Error("Clerk user is not loaded. Sign in as the smoke user on the preview page first.");
  }

  const setup = await clerk.user.initializePaymentMethod({ gateway: "stripe" });
  const externalClientSecret = setup?.externalClientSecret ?? setup?.external_client_secret;
  const externalGatewayId =
    setup?.gateway?.externalGatewayId ??
    setup?.gateway?.external_gateway_id ??
    setup?.externalGatewayId ??
    setup?.external_gateway_id;
  if (!externalClientSecret) {
    throw new Error("Clerk did not return a Stripe setup intent client secret.");
  }

  const stripeLoader = clerk.__internal_loadStripeJs;
  if (typeof stripeLoader !== "function") {
    throw new Error("Clerk Stripe loader is unavailable on this page.");
  }

  const stripe = await stripeLoader(externalGatewayId);
  const result = await stripe.confirmCardSetup(externalClientSecret, {
    payment_method: "pm_card_visa"
  });
  if (result.error) {
    throw new Error(result.error.message);
  }

  const paymentToken = result.setupIntent?.payment_method;
  if (!paymentToken) {
    throw new Error("Stripe did not return a payment method token.");
  }

  const paymentSource = await clerk.user.addPaymentMethod({
    gateway: "stripe",
    paymentToken
  });

  console.log({
    id: paymentSource.id,
    last4: paymentSource.card?.last4 ?? paymentSource.paymentMethod?.card?.last4 ?? "unknown"
  });
}

await addAgentstackM3TestPaymentMethod();
```

If the test payment method id stops working in Clerk/Stripe, use the same SDK sequence with a normal Stripe Elements
card element and the test card number `4242 4242 4242 4242`, any future expiry date, any CVC, and any ZIP. The
required Clerk calls are still `initializePaymentMethod`, Stripe setup intent confirmation, and
`user.addPaymentMethod({ gateway: "stripe", paymentToken })`.

## Cleanup

After M3 review, delete or cancel provider resources in this order:

```sh
pnpm run billing:fixture -- delete --env preview --entitlement feature.auditLog --confirm-live-mutation
pnpm run auth:user -- delete --confirm-live-mutation
```

If an active Clerk Billing subscription item remains, delete or cancel it in Clerk before deleting the smoke user.
If a test payment source remains visible in Clerk, remove it through Clerk Billing or delete the smoke user. Record any
real provider cleanup in `docs/provider-resource-ledger.md`.

## Evidence Rules

Repository evidence may include:

- PASS/FAIL command summaries.
- Clerk app, feature, plan, price, webhook endpoint, user, subscription item, and payment source ids.
- Card brand and last four digits for a test card.

Repository evidence must not include:

- Clerk secret keys.
- Convex deploy keys.
- Webhook signing secrets.
- Vercel automation bypass secrets.
- Setup intent client secrets.
- Stripe payment method tokens.
- Smoke-user passwords.
- Browser cookies or DOM snapshots containing session state.
