# Billing

Billing is an anchor for subscription and entitlement work. This template does not install Stripe or a billing SDK yet.

Use `STRIPE_MODE=sandbox` during preview development. Set the local validation value through `agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox`. Production billing work should add provider code behind the shared runtime package and keep entitlement checks available to web, mobile, and Convex code.

Start new billing plans with:

```sh
agentstack add billing-plan pro --entitlements feature.auditLog,feature.advancedReports --seats 10
```

The command creates these files for each plan:

- `packages/domain/src/billing-plans/<plan>.ts`
- `convex/billing-plans/<plan>.ts`
- `apps/web/src/billing-plans/<plan>.ts`
- `apps/mobile/src/billing-plans/<plan>.ts`
- `packages/telemetry/src/billing-plans/<plan>.ts`
- `docs/agentstack/billing-plans/<plan>.md`

Use the generated anchors as the source for plan metadata before adding surface-specific gating code.

Use `agentstackBillingPlans` and `planHasEntitlement(plan, entitlement)` from `packages/domain/src/saas-spine.ts` as the shared source for plan-gated behavior. Keep subscription sync and webhook metadata aligned with `convex/saasSpine.ts`.

Before applying provider changes, run:

```sh
pnpm run sync:preview
pnpm run sync:preview:apply
pnpm run validate:cloud
pnpm run observe:timeline
```
