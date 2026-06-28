# M3: Billing Webhook + Entitlement Gate

Status: **specified, awaiting implementation approval**

M2 passed on 2026-06-28. M3 is now unlocked for the Clerk Billing approach specified in
[../superpowers/specs/2026-06-28-agentstack-m3-clerk-billing-webhook-design.md](../superpowers/specs/2026-06-28-agentstack-m3-clerk-billing-webhook-design.md).

Implementation must follow
[../superpowers/plans/2026-06-28-agentstack-m3-clerk-billing-webhook.md](../superpowers/plans/2026-06-28-agentstack-m3-clerk-billing-webhook.md)
after the plan is approved.

## Hypothesis under test

The lean generated SaaS spine can handle one real Clerk Billing webhook delivered to a Convex HTTP
action, update Convex entitlement state for `feature.auditLog`, and show a gated web feature path on a
Vercel preview URL without adding generated framework docs, scripts, or provider ledgers to the consumer
app.

Provider decisions:

- Billing provider: Clerk Billing.
- Internal entitlement key: `feature.auditLog`.
- Provider feature mapping: `feature.auditLog` maps to a Clerk Billing Feature slug declared in
  `agentstack.config.ts`; the M3 default should use a Clerk-safe slug such as `audit_log`.
- Webhook delivery target: Convex HTTP action on the preview deployment `.convex.site` URL, not the
  Vercel preview URL.
- Fixture lifecycle: package-owned commands must be able to create, use, modify, and remove M3 smoke
  billing principals and entitlement state. Any provider action that cannot be automated by Clerk API/CLI
  must be expressed as an exact one-time handoff and remains a blocker until resolved.

## Done when

- [ ] `agentstack.config.ts` has a typed `billing` contract for Clerk Billing and `feature.auditLog`,
      with validation diagnostics pointing to stable schema paths.
- [ ] The generated app root remains lean: no copied `docs/`, copied `scripts/`, generated skills, root
      `convex/`, root `vercel.json`, generated provider ledger, or generated runbook.
- [ ] Package-owned commands bootstrap or verify the Clerk Billing feature/plan and Clerk webhook endpoint
      for preview, ledger all real provider resources, and store the webhook signing secret only in hidden
      local/provider env state.
- [ ] Convex exposes a public HTTP action for Clerk Billing webhook delivery, verifies Clerk webhook
      signatures, and stores idempotent webhook event records keyed by provider message identity.
- [ ] A real Clerk Billing event grants or refreshes `feature.auditLog` in Convex entitlement state.
- [ ] Replaying the same provider event is idempotent and does not duplicate entitlement effects.
- [ ] The authenticated Vercel preview UI shows `feature.auditLog` denied before grant and allowed after
      the real webhook updates Convex.
- [ ] Package-owned smoke/evidence commands verify the entitlement DOM markers and Convex evidence.
- [ ] Redacted evidence is recorded in `docs/milestones/evidence/M3-billing-webhook/`.
- [ ] Cleanup/revert command deletes or revokes M3 smoke users, organizations, subscription fixtures, and
      local secret/evidence state that should not persist.

## Not this milestone

- Full billing UI or pricing table polish
- Production billing or production payment setup
- Mobile billing surfaces
- Hosted Agentstack control plane
- Broad billing provider matrix
- General organization management beyond the single smoke billing principal needed for M3

## Consumer path under test

The successful M3 path must be executable from a fresh lean generated app through package-owned scripts:

```text
agentstack create <tmp-app> --package-spec <local-or-published-agentstack>
pnpm install
pnpm run validate
pnpm run provider:bootstrap -- --env preview --confirm-live-mutation
cd apps/convex && ../../node_modules/.bin/convex dev --once --configure new
pnpm run provider:bootstrap -- --env preview --confirm-live-mutation
pnpm run provider:link
pnpm run preview:deploy -- --confirm-live-mutation
pnpm run auth:user -- ensure --confirm-live-mutation
pnpm run billing:bootstrap -- --env preview --confirm-live-mutation
pnpm run billing:fixture -- ensure --env preview --entitlement feature.auditLog --confirm-live-mutation
browser sign-in with the generated smoke user
pnpm run billing:smoke -- --env preview --expected denied --dom-file <denied-dom>
pnpm run billing:fixture -- grant --env preview --entitlement feature.auditLog --confirm-live-mutation
pnpm run billing:smoke -- --env preview --expected allowed --dom-file <allowed-dom>
pnpm run billing:fixture -- replay-last --env preview --entitlement feature.auditLog --confirm-live-mutation
pnpm run evidence:check -- --env preview --milestone M3
pnpm run billing:fixture -- delete --env preview --entitlement feature.auditLog --confirm-live-mutation
```

Command names may change during implementation only if package-owned `agentstack help` and generated package
scripts make the final path equally discoverable.

## External references checked

- Clerk Billing for B2B SaaS: https://clerk.com/docs/nextjs/guides/billing/for-b2b
- Clerk Billing webhooks: https://clerk.com/docs/nextjs/guides/development/webhooks/billing
- Clerk webhooks overview: https://clerk.com/docs/guides/development/webhooks/overview
- Clerk `verifyWebhook()`: https://clerk.com/docs/reference/backend/verify-webhook
- Convex HTTP actions: https://docs.convex.dev/functions/http-actions
