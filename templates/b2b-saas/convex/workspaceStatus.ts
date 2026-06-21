import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  getWorkspaceStatusChecklistProgress,
  getWorkspaceStatusSeed,
  type WorkspaceStatus
} from "../packages/domain/src/index.js";

export const get = query({
  args: { workspaceId: v.optional(v.string()) },
  handler: async (ctx, args): Promise<WorkspaceStatus> => {
    const workspaceId = args.workspaceId ?? "demo-workspace";
    const existing = await ctx.db
      .query("workspaceStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    return existing ?? getWorkspaceStatusSeed();
  }
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const status = getWorkspaceStatusSeed();
    const existing = await ctx.db
      .query("workspaceStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", status.workspaceId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, status);
      return existing._id;
    }

    return await ctx.db.insert("workspaceStatuses", status);
  }
});

export const checklistProgress = query({
  args: { workspaceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const workspaceId = args.workspaceId ?? "demo-workspace";
    const existing = await ctx.db
      .query("workspaceStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    return getWorkspaceStatusChecklistProgress(existing ?? getWorkspaceStatusSeed());
  }
});
