import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workspaceStatuses: defineTable({
    workspaceId: v.string(),
    workspaceName: v.string(),
    phase: v.union(v.literal("setup"), v.literal("active"), v.literal("attention")),
    plan: v.union(v.literal("free"), v.literal("pro")),
    memberCount: v.number(),
    openTasks: v.number(),
    lastUpdatedAt: v.string(),
    checklist: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        complete: v.boolean(),
        required: v.boolean()
      })
    )
  }).index("by_workspace", ["workspaceId"]),
  billingWebhookEvents: defineTable({
    provider: v.literal("clerk"),
    messageId: v.string(),
    eventType: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("duplicate"),
      v.literal("ignored"),
      v.literal("failed")
    ),
    receivedAt: v.string(),
    processedAt: v.optional(v.string()),
    duplicateCount: v.optional(v.number()),
    entitlementKey: v.optional(v.literal("feature.auditLog")),
    providerPayerType: v.optional(v.union(v.literal("user"), v.literal("organization"))),
    providerPayerId: v.optional(v.string()),
    redactedSummary: v.string()
  })
    .index("by_provider_message", ["provider", "messageId"])
    .index("by_event_type", ["eventType"]),
  billingEntitlements: defineTable({
    workspaceId: v.string(),
    entitlementKey: v.literal("feature.auditLog"),
    allowed: v.boolean(),
    provider: v.literal("clerk"),
    providerFeature: v.string(),
    providerPlan: v.optional(v.string()),
    providerPayerType: v.optional(v.union(v.literal("user"), v.literal("organization"))),
    providerPayerId: v.optional(v.string()),
    sourceEventMessageId: v.optional(v.string()),
    updatedAt: v.string()
  }).index("by_workspace_entitlement", ["workspaceId", "entitlementKey"]),
  billingPrincipals: defineTable({
    workspaceId: v.string(),
    clerkUserId: v.string(),
    clerkOrganizationId: v.optional(v.string()),
    fixture: v.boolean(),
    updatedAt: v.string()
  })
    .index("by_user", ["clerkUserId"])
    .index("by_organization", ["clerkOrganizationId"])
});
