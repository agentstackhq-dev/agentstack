# Agentstack M3 Clerk Billing Webhook Design

Status: implemented with live pass on 2026-06-29; see `../../milestones/M3-billing-webhook.md` for current state
Date: 2026-06-28

## Milestone Target

M3 proves the next SaaS spine after auth: a lean generated Agentstack app receives a real Clerk Billing
webhook, updates Convex entitlement state, and gates one authenticated web feature on preview.

The target entitlement is `feature.auditLog`. It is Agentstack's internal entitlement key. The Clerk Billing
Feature slug is provider-specific and must be declared in typed config, with the default template mapping
`feature.auditLog` to a Clerk-safe slug such as `audit_log`.

## Decisions Locked By User

- Use Clerk Billing, not Stripe Billing.
- Use `feature.auditLog` as the M3 entitlement.
- Use a real Clerk webhook. Synthetic local webhook tests are allowed for unit coverage, but they cannot satisfy
  the live M3 acceptance evidence.
- Preserve the M2 consumer contract: generated apps stay lean and Agentstack package commands own provider glue.
- Ledger and evidence rules continue to apply to all real provider resources.

## Product Contract

The generated consumer app remains an app using Agentstack, not a copied framework workspace. The generated root
surface stays limited to:

```text
apps/mobile
apps/web
apps/convex
agentstack.config.ts
AGENTS.md
.gitignore
package.json
```

Package-manager lockfiles may appear after install. Framework docs, runbooks, scripts, provider ledgers, and
diagnostic logic must stay package-owned or hidden under `.agentstack/`.

The public consumer path for M3 is through generated package scripts that call the installed `agentstack` CLI:

```text
pnpm run billing:bootstrap -- --env preview --confirm-live-mutation
pnpm run billing:fixture -- ensure --env preview --entitlement feature.auditLog --confirm-live-mutation
pnpm run billing:fixture -- subscribe --env preview --entitlement feature.auditLog --confirm-live-mutation
pnpm run billing:fixture -- grant --env preview --entitlement feature.auditLog --confirm-live-mutation
pnpm run billing:fixture -- replay-last --env preview --entitlement feature.auditLog --confirm-live-mutation
pnpm run billing:fixture -- delete --env preview --entitlement feature.auditLog --confirm-live-mutation
pnpm run billing:smoke -- --env preview --expected allowed --dom-file .agentstack/m3-allowed-dom.html
```

The exact command names can be refined during implementation, but the final command set must be discoverable from
`agentstack help` and generated `package.json` scripts. Direct imports of framework internals cannot be the success
path.

## Typed Config Contract

`agentstack.config.ts` gains an explicit `billing` section. This is the M3 agent feedback boundary.

Proposed default:

```ts
billing: {
  provider: "clerk",
  requiredEnvironments: ["preview", "production"],
  entitlements: {
    "feature.auditLog": {
      providerFeature: "audit_log",
      providerPlan: "agentstack_m3_audit_log",
      scope: "workspace",
      payer: "organization"
    }
  },
  webhook: {
    service: "convex",
    route: "/agentstack/webhooks/clerk/billing",
    events: [
      "subscription.created",
      "subscription.updated",
      "subscription.active",
      "subscription.past_due",
      "subscriptionItem.created",
      "subscriptionItem.updated",
      "subscriptionItem.active",
      "subscriptionItem.canceled",
      "subscriptionItem.ended",
      "subscriptionItem.past_due"
    ]
  }
}
```

Validation rules:

- `billing.provider` is `clerk` for M3.
- Entitlement keys use the existing Agentstack dotted-key shape, including `feature.auditLog`.
- `providerFeature` and `providerPlan` use provider-safe slugs and are separate from the internal entitlement key.
- `billing.webhook.service` must be `convex` for M3 because Clerk should deliver directly to the public Convex
  HTTP action.
- The schema rejects Clerk Billing when `services.clerk` or `services.convex` is disabled for the target
  environment.
- Template config must remove the stale `STRIPE_MODE` custom env entry.

## Webhook Architecture

Clerk sends Billing webhook events directly to a Convex HTTP action:

```text
Clerk Billing event
  -> https://<preview-deployment>.convex.site/agentstack/webhooks/clerk/billing
  -> Convex HTTP action verifies Clerk signature
  -> internal Convex mutation records idempotent event
  -> entitlement mutation grants/revokes feature.auditLog
  -> authenticated web query returns allowed/denied
```

This avoids routing provider delivery through Vercel. Vercel Deployment Protection can still affect browser smoke,
but it cannot block Clerk webhook delivery because the webhook target is the Convex `.convex.site` domain.

The Convex handler must:

- read the raw request body and Clerk/Svix headers
- verify the request with Clerk's `verifyWebhook()` behavior or an equivalent supported package path
- return `400` for failed verification
- return `200` for duplicate already-processed events
- store a redacted event row before applying effects
- store enough provider identifiers to prove idempotency without storing raw payloads or secrets
- apply entitlement effects only through an internal mutation

Idempotency key:

- primary: `svix-id` request header
- fallback: deterministic hash of event `type`, `timestamp`, `instance_id`, and raw body if `svix-id` is not exposed
  by the verification package

## Convex Data Model

M3 adds the smallest durable tables needed to prove the entitlement path:

```text
billingWebhookEvents
  provider: "clerk"
  messageId: string
  eventType: string
  status: "received" | "processed" | "duplicate" | "ignored" | "failed"
  receivedAt: string
  processedAt?: string
  entitlementKey?: "feature.auditLog"
  providerPayerType?: "user" | "organization"
  providerPayerId?: string
  redactedSummary: string

billingEntitlements
  workspaceId: string
  entitlementKey: "feature.auditLog"
  allowed: boolean
  provider: "clerk"
  providerFeature: string
  providerPlan?: string
  providerPayerType?: "user" | "organization"
  providerPayerId?: string
  sourceEventMessageId?: string
  updatedAt: string

billingPrincipals
  workspaceId: string
  clerkUserId: string
  clerkOrganizationId?: string
  fixture: boolean
  updatedAt: string
```

`billingPrincipals` lets M3 model a B2B workspace without adding a full organization switcher UI. The package-owned
fixture command creates or reuses the smoke principal and records which Clerk user or organization maps to the demo
workspace.

## Entitlement Behavior

The gate is denied by default. The web UI must not trust client-side Clerk feature checks alone; it must call a
protected Convex query as the signed-in user.

The default query result shape:

```ts
{
  entitlementKey: "feature.auditLog",
  state: "allowed" | "denied",
  workspaceId: string,
  source: "clerk-billing-webhook" | "default-deny"
}
```

The web UI exposes stable smoke markers:

```html
data-agentstack-entitlement-key="feature.auditLog"
data-agentstack-entitlement-state="allowed"
data-agentstack-entitlement-source="clerk-billing-webhook"
```

The denied state uses `data-agentstack-entitlement-state="denied"`.

## Provider Automation And Handoffs

The CLI should automate Clerk API/CLI actions where Clerk exposes a stable API:

- verify the Clerk application created during provider bootstrap
- verify or create the webhook endpoint if supported by Clerk API/CLI
- set `CLERK_WEBHOOK_SIGNING_SECRET` in the Convex preview deployment
- create or reuse smoke users and organizations
- create, update, and delete fixture metadata
- inspect billing plans, features, subscriptions, and webhook deliveries where provider APIs expose them

Clerk Billing plan/feature creation is still a provider setup handoff when the Clerk API/CLI cannot create the desired
objects. Subscription transition is now package-owned through `billing:fixture -- subscribe`; if the smoke user lacks a
test payment method, the command fails with the documented Clerk browser SDK handoff in
`../../references/m3-clerk-billing-fixture.md`.

If Clerk does not expose a stable API for creating Billing plans/features, `agentstack billing bootstrap` must fail with
a precise provider-action-required diagnostic. The diagnostic must state:

- the Clerk application name
- the exact Clerk Dashboard page/action needed
- the expected Plan slug
- the expected Feature slug
- the expected webhook URL
- the event types to select
- the secret/env value destination

That handoff is allowed only as a one-time setup unblock. M3 does not pass until the provider resources are verified,
ledgered as active, and a real Clerk Billing event reaches Convex.

## Fixture Lifecycle

`agentstack billing fixture` owns repeatable dev/test/staging setup:

- `ensure`: create or reuse the M3 Clerk smoke principal and a Convex `billingPrincipals` row; ensure default denied
- `subscribe`: transition the smoke user from the active free subscription item to the configured Clerk Billing plan,
  or print the exact test-payment-method handoff when Clerk requires one
- `grant`: verify a real Clerk Billing subscription/feature event for the smoke principal, then wait until Convex
  reports `feature.auditLog` allowed
- `revoke`: cause a real Clerk Billing event that removes the feature, then wait until Convex reports denied
- `replay-last`: replay or re-deliver the last provider event when Clerk exposes this, or report an exact provider
  replay handoff; Convex must mark the event duplicate
- `delete`: remove smoke users, organizations, fixture rows, and local hidden fixture state where safe

The fixture command is also the place to carry the M1/M2 lesson about Clerk auth flows: generated tests should not
require ad hoc user setup. The package owns user creation, password update, metadata tagging, trust bypass where
supported, and cleanup.

## Evidence

Generated apps write raw local state only under ignored `.agentstack/`. The Agentstack framework repo receives a
redacted milestone evidence file under `docs/milestones/evidence/M3-billing-webhook/`.

Required evidence:

- provider bootstrap/link/deploy baseline from M2 path
- Clerk Billing feature/plan/webhook endpoint verified or provider-action handoff resolved
- Convex webhook route deployed on `.convex.site`
- one real Clerk Billing event received and processed
- duplicate/replay event detected as idempotent
- web UI denied DOM capture
- web UI allowed DOM capture
- fixture subscribe result
- fixture cleanup result or explicitly deferred cleanup state in the M3 milestone card

Evidence must not store:

- Clerk signing secret
- Clerk secret key
- raw webhook payload
- raw provider stdout containing secrets
- browser cookies, session tokens, OTPs, or passwords

## Explicit Non-Goals

- Production Clerk Billing setup
- Stripe Billing setup
- Full pricing page or customer portal polish
- Mobile entitlement UI
- Full organization management
- Multiple entitlement keys
- Support for non-Clerk billing providers

## References Checked

- Clerk Billing for B2B SaaS: https://clerk.com/docs/nextjs/guides/billing/for-b2b
- Clerk Billing webhooks: https://clerk.com/docs/nextjs/guides/development/webhooks/billing
- Clerk webhooks overview: https://clerk.com/docs/guides/development/webhooks/overview
- Clerk `verifyWebhook()`: https://clerk.com/docs/reference/backend/verify-webhook
- Convex HTTP actions: https://docs.convex.dev/functions/http-actions
