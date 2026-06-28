# Core SaaS Spine

The SaaS spine is the shared anchor for identity, authorization, billing, entitlements, webhook ingestion, and audit metadata.

## Domain Helpers

Use `packages/domain/src/saas-spine.ts` for literal shared contracts:

- `agentstackRoles` and `roleHasPermission(role, permission)` for role checks.
- `agentstackBillingPlans` and `planHasEntitlement(plan, entitlement)` for plan-gated behavior.
- `agentstackWebhookTypes` for Clerk webhook routing.
- `agentstackAuditEventTypes` for audit event naming.

## Convex Metadata

Use `convex/saasSpine.ts` for current SaaS spine metadata. It identifies the framework-owned domains without importing Convex schema APIs:

- identity
- authorization
- billing
- entitlements
- webhook ingestion
- audit events

`convex/schema.ts` currently materializes the runnable `workspaceStatuses` table for the generated workspace-status vertical.

`convex/workspaceStatus.ts` exposes `protectedStatus` as the M1 smoke query. It fails closed when `ctx.auth.getUserIdentity()` is null and returns a small workspace-status payload only for signed-in users. Convex functions should enforce membership and entitlement checks server-side. Web and mobile checks are product affordances only.

## Provider Wrapper Rule

Keep provider SDKs behind framework wrappers. Clerk, billing, webhook, and audit ingestion code should normalize into the spine types before application code consumes it.
