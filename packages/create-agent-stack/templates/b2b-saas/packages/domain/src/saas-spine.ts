export const agentstackRoles = ["owner", "admin", "member"] as const;
export type AgentstackRole = (typeof agentstackRoles)[number];

export const agentstackPermissions = [
  "org.manage",
  "members.manage",
  "billing.manage",
  "feature.use",
  "audit.read"
] as const;
export type AgentstackPermission = (typeof agentstackPermissions)[number];

export const agentstackBillingPlans = ["free", "pro"] as const;
export type AgentstackBillingPlan = (typeof agentstackBillingPlans)[number];

export const agentstackEntitlements = [
  "seats.included",
  "feature.auditLog",
  "feature.advancedReports"
] as const;
export type AgentstackEntitlement = (typeof agentstackEntitlements)[number];

export const agentstackWebhookTypes = [
  "clerk.user.created",
  "clerk.organization.created",
  "clerk.organizationMembership.created",
  "clerk.billing.subscription.updated"
] as const;
export type AgentstackWebhookType = (typeof agentstackWebhookTypes)[number];

export const agentstackAuditEventTypes = [
  "auth.user.linked",
  "org.member.added",
  "billing.subscription.synced",
  "entitlement.granted"
] as const;
export type AgentstackAuditEventType = (typeof agentstackAuditEventTypes)[number];

const rolePermissions: Record<AgentstackRole, readonly AgentstackPermission[]> = {
  owner: ["org.manage", "members.manage", "billing.manage", "feature.use", "audit.read"],
  admin: ["members.manage", "feature.use", "audit.read"],
  member: ["feature.use"]
};

const planEntitlements: Record<AgentstackBillingPlan, readonly AgentstackEntitlement[]> = {
  free: ["seats.included"],
  pro: ["seats.included", "feature.auditLog", "feature.advancedReports"]
};

export function roleHasPermission(role: AgentstackRole, permission: AgentstackPermission): boolean {
  return rolePermissions[role].includes(permission);
}

export function planHasEntitlement(
  plan: AgentstackBillingPlan,
  entitlement: AgentstackEntitlement
): boolean {
  return planEntitlements[plan].includes(entitlement);
}
