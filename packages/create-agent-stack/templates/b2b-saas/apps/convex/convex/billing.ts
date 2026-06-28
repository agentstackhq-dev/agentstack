import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";

const entitlementKey = "feature.auditLog" as const;
const providerFeature = "audit_log";
const defaultWorkspaceId = "demo-workspace";

export const protectedEntitlementGate = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (identity === null) {
      throw new Error("Not authenticated");
    }

    const principal = await ctx.db
      .query("billingPrincipals")
      .withIndex("by_user", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    const workspaceId = principal?.workspaceId ?? defaultWorkspaceId;
    const entitlement = await ctx.db
      .query("billingEntitlements")
      .withIndex("by_workspace_entitlement", (q) =>
        q.eq("workspaceId", workspaceId).eq("entitlementKey", entitlementKey)
      )
      .first();
    const allowed = entitlement?.allowed === true;

    return {
      entitlementKey,
      state: allowed ? "allowed" : "denied",
      workspaceId,
      source: allowed ? "clerk-billing-webhook" : "default-deny"
    };
  }
});

export const ensureFixturePrincipal = mutation({
  args: {
    workspaceId: v.optional(v.string()),
    clerkUserId: v.string(),
    clerkOrganizationId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const workspaceId = args.workspaceId ?? defaultWorkspaceId;
    const existing = await ctx.db
      .query("billingPrincipals")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
    const principal = {
      workspaceId,
      clerkUserId: args.clerkUserId,
      clerkOrganizationId: args.clerkOrganizationId,
      fixture: true,
      updatedAt: new Date().toISOString()
    };

    if (existing) {
      await ctx.db.patch(existing._id, principal);
      return existing._id;
    }

    return await ctx.db.insert("billingPrincipals", principal);
  }
});

export const clearFixturePrincipal = mutation({
  args: {
    clerkUserId: v.string()
  },
  handler: async (ctx, args) => {
    const principal = await ctx.db
      .query("billingPrincipals")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!principal) {
      return { deleted: false };
    }

    await ctx.db.delete(principal._id);
    return { deleted: true };
  }
});

export const applyClerkBillingEvent = internalMutation({
  args: {
    provider: v.literal("clerk"),
    messageId: v.string(),
    eventType: v.string(),
    receivedAt: v.string(),
    entitlementKey: v.optional(v.literal("feature.auditLog")),
    providerFeature: v.optional(v.string()),
    providerPlan: v.optional(v.string()),
    providerPayerType: v.optional(v.union(v.literal("user"), v.literal("organization"))),
    providerPayerId: v.optional(v.string()),
    allowed: v.optional(v.boolean()),
    redactedSummary: v.string()
  },
  handler: async (ctx, args) => {
    const existingEvent = await ctx.db
      .query("billingWebhookEvents")
      .withIndex("by_provider_message", (q) => q.eq("provider", args.provider).eq("messageId", args.messageId))
      .first();
    const now = new Date().toISOString();

    if (existingEvent) {
      await ctx.db.patch(existingEvent._id, {
        status: "duplicate",
        duplicateCount: (existingEvent.duplicateCount ?? 0) + 1,
        processedAt: now
      });
      return { status: "duplicate" };
    }

    const eventId = await ctx.db.insert("billingWebhookEvents", {
      provider: args.provider,
      messageId: args.messageId,
      eventType: args.eventType,
      status: "received",
      receivedAt: args.receivedAt,
      entitlementKey: args.entitlementKey,
      providerPayerType: args.providerPayerType,
      providerPayerId: args.providerPayerId,
      redactedSummary: args.redactedSummary
    });

    if (args.entitlementKey !== entitlementKey || args.allowed === undefined) {
      await ctx.db.patch(eventId, { status: "ignored", processedAt: now });
      return { status: "ignored" };
    }

    const principal = await findPrincipal(ctx, args.providerPayerType, args.providerPayerId);
    const workspaceId = principal?.workspaceId ?? defaultWorkspaceId;
    const existingEntitlement = await ctx.db
      .query("billingEntitlements")
      .withIndex("by_workspace_entitlement", (q) =>
        q.eq("workspaceId", workspaceId).eq("entitlementKey", entitlementKey)
      )
      .first();
    const entitlement = {
      workspaceId,
      entitlementKey,
      allowed: args.allowed,
      provider: "clerk" as const,
      providerFeature: args.providerFeature ?? providerFeature,
      providerPlan: args.providerPlan,
      providerPayerType: args.providerPayerType,
      providerPayerId: args.providerPayerId,
      sourceEventMessageId: args.messageId,
      updatedAt: now
    };

    if (existingEntitlement) {
      await ctx.db.patch(existingEntitlement._id, entitlement);
    } else {
      await ctx.db.insert("billingEntitlements", entitlement);
    }

    await ctx.db.patch(eventId, { status: "processed", processedAt: now });
    return { status: "processed", workspaceId, allowed: args.allowed };
  }
});

export const readM3BillingEvidence = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("billingWebhookEvents").collect();
    const entitlements = await ctx.db.query("billingEntitlements").collect();
    const principals = await ctx.db.query("billingPrincipals").collect();

    return {
      events: events.map((event) => ({
        eventType: event.eventType,
        status: event.status,
        entitlementKey: event.entitlementKey,
        hasProviderPayer: event.providerPayerId !== undefined,
        duplicateCount: event.duplicateCount ?? 0
      })),
      entitlements: entitlements.map((entitlement) => ({
        workspaceId: entitlement.workspaceId,
        entitlementKey: entitlement.entitlementKey,
        allowed: entitlement.allowed,
        providerFeature: entitlement.providerFeature,
        source: entitlement.sourceEventMessageId ? "clerk-billing-webhook" : "default-deny"
      })),
      principals: principals.map((principal) => ({
        workspaceId: principal.workspaceId,
        hasUser: principal.clerkUserId.length > 0,
        hasOrganization: principal.clerkOrganizationId !== undefined,
        fixture: principal.fixture
      }))
    };
  }
});

async function findPrincipal(
  ctx: {
    db: {
      query: (table: "billingPrincipals") => {
        withIndex: (
          indexName: "by_user" | "by_organization",
          indexRange: (q: { eq: (field: string, value: string) => unknown }) => unknown
        ) => { first: () => Promise<{ workspaceId: string } | null> };
      };
    };
  },
  providerPayerType: "user" | "organization" | undefined,
  providerPayerId: string | undefined
) {
  if (!providerPayerId) {
    return undefined;
  }

  if (providerPayerType === "organization") {
    const organization = await ctx.db
      .query("billingPrincipals")
      .withIndex("by_organization", (q) => q.eq("clerkOrganizationId", providerPayerId))
      .first();
    if (organization) {
      return organization;
    }
  }

  return await ctx.db
    .query("billingPrincipals")
    .withIndex("by_user", (q) => q.eq("clerkUserId", providerPayerId))
    .first();
}
