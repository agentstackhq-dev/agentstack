import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

type WorkspaceStatus = {
  workspaceId: string;
  workspaceName: string;
  phase: "setup" | "active" | "attention";
  plan: "free" | "pro";
  memberCount: number;
  openTasks: number;
  lastUpdatedAt: string;
  checklist: Array<{
    id: string;
    label: string;
    complete: boolean;
    required: boolean;
  }>;
};

function getWorkspaceStatusSeed(): WorkspaceStatus {
  return {
    workspaceId: "demo-workspace",
    workspaceName: "__APP_NAME__",
    phase: "setup",
    plan: "pro",
    memberCount: 3,
    openTasks: 4,
    lastUpdatedAt: new Date(0).toISOString(),
    checklist: [
      { id: "auth", label: "Connect Clerk auth", complete: true, required: true },
      { id: "data", label: "Load protected Convex data", complete: true, required: true },
      { id: "deploy", label: "Deploy Vercel preview", complete: false, required: true }
    ]
  };
}

function getWorkspaceStatusChecklistProgress(status: WorkspaceStatus) {
  const completed = status.checklist.filter((item) => item.complete).length;
  const requiredRemaining = status.checklist.filter((item) => item.required && !item.complete).length;

  return {
    completed,
    total: status.checklist.length,
    requiredRemaining
  };
}

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

export const protectedStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (identity === null) {
      throw new Error("Not authenticated");
    }

    const status = getWorkspaceStatusSeed();
    const existing = await ctx.db
      .query("workspaceStatuses")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", status.workspaceId))
      .first();
    const workspaceStatus = existing ?? status;

    return {
      workspaceId: workspaceStatus.workspaceId,
      workspaceName: workspaceStatus.workspaceName,
      phase: workspaceStatus.phase,
      checklistProgress: getWorkspaceStatusChecklistProgress(workspaceStatus),
      viewer: {
        subject: identity.subject,
        issuer: identity.issuer,
        name: identity.name ?? identity.email ?? "Signed-in user"
      }
    };
  }
});
