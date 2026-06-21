export const agentstackSaasTables = [
  "users",
  "identities",
  "orgs",
  "memberships",
  "roles",
  "billingSubscriptions",
  "entitlements",
  "webhookEvents",
  "auditEvents",
  "workspaceStatuses"
] as const;

export const clerkWebhookTypes = [
  "clerk.user.created",
  "clerk.organization.created",
  "clerk.organizationMembership.created",
  "clerk.billing.subscription.updated"
] as const;

export const workspaceStatusFunctionTypes = [
  "workspaceStatus.get",
  "workspaceStatus.seed",
  "workspaceStatus.checklistProgress"
] as const;

export const agentstackAuditEventTypes = [
  "auth.user.linked",
  "org.member.added",
  "billing.subscription.synced",
  "entitlement.granted",
  "workspace.status.seeded"
] as const;

export const agentstackSaasSpine = {
  purpose:
    "Metadata anchors for Clerk identity, Convex authorization, billing state, entitlements, workspace status, webhook ingestion, and audit events.",
  tables: agentstackSaasTables,
  clerkWebhookTypes,
  functionTypes: workspaceStatusFunctionTypes,
  auditEventTypes: agentstackAuditEventTypes
} as const;
