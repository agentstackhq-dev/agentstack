# Billing

Billing is an anchor for subscription and entitlement work. This template does not install Stripe or a billing SDK yet.

Use `BILLING_PROVIDER_MODE=sandbox` during preview development. Production billing work should add provider code behind the shared runtime package and keep entitlement checks available to web, mobile, and Convex code.

Before applying provider changes, run:

```sh
pnpm run sync:preview
pnpm run sync:preview:apply
pnpm run validate:cloud
pnpm run observe:timeline
```
