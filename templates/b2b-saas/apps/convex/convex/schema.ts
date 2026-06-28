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
  }).index("by_workspace", ["workspaceId"])
});
