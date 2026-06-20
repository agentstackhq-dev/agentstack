# Core SaaS Spine

The SaaS spine is the shared anchor for identity, authorization, billing, entitlements, webhook ingestion, and audit metadata.

## Domain Helpers

Use `packages/domain/src/saas-spine.ts` for literal shared contracts:

- `agentstackRoles` and `roleHasPermission(role, permission)` for role checks.
- `agentstackBillingPlans` and `planHasEntitlement(plan, entitlement)` for plan-gated behavior.
- `agentstackWebhookTypes` for Clerk webhook routing.
- `agentstackAuditEventTypes` for audit event naming.

## Convex Metadata

Use `convex/saasSpine.ts` and `convex/schema.ts` as metadata-only anchors. They identify the expected SaaS tables without importing Convex schema APIs:

- `users`
- `identities`
- `orgs`
- `memberships`
- `roles`
- `billingSubscriptions`
- `entitlements`
- `webhookEvents`
- `auditEvents`

Convex functions should enforce membership and entitlement checks server-side. Web and mobile checks are product affordances only.

## Provider Wrapper Rule

Keep provider SDKs behind framework wrappers. Clerk, billing, webhook, and audit ingestion code should normalize into the spine types before application code consumes it.
