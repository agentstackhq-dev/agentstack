import React from "react";
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/react";
import { useConvexAuth, useQuery } from "convex/react";
import { anyApi } from "convex/server";

import { themeTokens } from "./theme";
import {
  getWorkspaceStatusChecklistProgress,
  getWorkspaceStatusSeed,
  getWorkspaceStatusSummary
} from "./workspaceStatus";

type AppProps = {
  runtimeReady?: boolean;
};

type ProtectedWorkspaceStatus = {
  workspaceId: string;
  workspaceName: string;
  phase: string;
  checklistProgress: {
    completed: number;
    total: number;
    requiredRemaining: number;
  };
  viewer: {
    subject: string;
    issuer: string;
    name: string;
  };
};

const protectedWorkspaceStatusQuery = anyApi.workspaceStatus.protectedStatus;

export function App({ runtimeReady = true }: AppProps) {
  const status = getWorkspaceStatusSeed();
  const progress = getWorkspaceStatusChecklistProgress(status);

  return (
    <main
      data-agentstack-app="__APP_SLUG__"
      style={{
        minHeight: "100vh",
        background: themeTokens.colors.background,
        color: themeTokens.colors.foreground,
        fontFamily: themeTokens.typography.fontFamily,
        padding: themeTokens.spacing.xl
      }}
    >
      <section
        aria-labelledby="workspace-status-title"
        style={{
          maxWidth: 720,
          background: themeTokens.colors.surface,
          borderRadius: themeTokens.radius.md,
          boxShadow: themeTokens.shadow.md,
          padding: themeTokens.spacing.lg
        }}
      >
        <p style={{ color: themeTokens.colors.muted, margin: 0 }}>Workspace status</p>
        <h1 id="workspace-status-title" style={{ margin: "8px 0" }}>
          {status.workspaceName}
        </h1>
        <p style={{ margin: "0 0 24px" }}>{getWorkspaceStatusSummary(status)}</p>
        <dl style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div>
            <dt style={{ color: themeTokens.colors.muted }}>Plan</dt>
            <dd style={{ margin: 0 }}>{status.plan}</dd>
          </div>
          <div>
            <dt style={{ color: themeTokens.colors.muted }}>Members</dt>
            <dd style={{ margin: 0 }}>{status.memberCount}</dd>
          </div>
          <div>
            <dt style={{ color: themeTokens.colors.muted }}>Open tasks</dt>
            <dd style={{ margin: 0 }}>{status.openTasks}</dd>
          </div>
        </dl>
        <div style={{ marginTop: 24 }}>
          {runtimeReady ? <AuthRuntime /> : <AuthRuntimePlaceholder />}
        </div>
        <h2 style={{ marginTop: 24 }}>Checklist</h2>
        <p style={{ color: themeTokens.colors.muted }}>
          {progress.completed} of {progress.total} complete
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {status.checklist.map((item) => (
            <li key={item.id} style={{ padding: "10px 0", borderTop: `1px solid ${themeTokens.colors.muted}` }}>
              <strong>{item.complete ? "Done" : "Next"}</strong> {item.label}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function AuthRuntime() {
  const { isLoaded, isSignedIn } = useUser();
  const { isAuthenticated: isConvexAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();

  if (!isLoaded || (isSignedIn && isConvexAuthLoading)) {
    return (
      <section
        aria-labelledby="auth-runtime-title"
        data-agentstack-auth-state={isSignedIn ? "signed-in" : "loading"}
      >
        <p style={{ color: themeTokens.colors.muted, margin: 0 }}>Auth and data</p>
        <h2 id="auth-runtime-title" style={{ margin: "8px 0" }}>
          Protected Convex status
        </h2>
        <p style={{ margin: 0 }} data-agentstack-protected-data-state={isSignedIn ? "loading" : undefined}>
          {isSignedIn ? "Loading Convex auth..." : "Loading Clerk session..."}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="auth-runtime-title"
      data-agentstack-auth-state={isSignedIn ? "signed-in" : "signed-out"}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <p style={{ color: themeTokens.colors.muted, margin: 0 }}>Auth and data</p>
          <h2 id="auth-runtime-title" style={{ margin: "8px 0" }}>
            Protected Convex status
          </h2>
        </div>
        {isSignedIn ? <UserButton /> : null}
      </div>
      {isSignedIn && isConvexAuthenticated ? (
        <ProtectedConvexStatus />
      ) : isSignedIn ? (
        <p style={{ margin: 0 }} data-agentstack-protected-data-state="loading">
          Waiting for Convex auth...
        </p>
      ) : (
        <>
          <p style={{ margin: "0 0 16px" }}>Sign in to call the protected Convex workspace query.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <SignInButton mode="modal">
              <button type="button">Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button type="button">Create account</button>
            </SignUpButton>
          </div>
        </>
      )}
    </section>
  );
}

function AuthRuntimePlaceholder() {
  return (
    <section
      aria-labelledby="auth-runtime-placeholder-title"
      data-agentstack-auth-state="runtime-not-configured"
    >
      <p style={{ color: themeTokens.colors.muted, margin: 0 }}>Auth and data</p>
      <h2 id="auth-runtime-placeholder-title" style={{ margin: "8px 0" }}>
        Runtime configuration needed
      </h2>
      <p style={{ margin: 0 }}>
        Set VITE_CLERK_PUBLISHABLE_KEY and VITE_CONVEX_URL to enable Clerk sign-in and the protected
        Convex workspace query.
      </p>
    </section>
  );
}

function ProtectedConvexStatus() {
  const protectedStatus = useQuery(protectedWorkspaceStatusQuery, {}) as ProtectedWorkspaceStatus | undefined;

  if (protectedStatus === undefined) {
    return (
      <p style={{ margin: 0 }} data-agentstack-protected-data-state="loading">
        Loading protected workspace status...
      </p>
    );
  }

  return (
    <div
      data-agentstack-protected-data-state="protected-data-loaded"
      data-agentstack-protected-workspace-id={protectedStatus.workspaceId}
    >
      <p style={{ margin: "0 0 12px" }}>
        {protectedStatus.viewer.name} can read {protectedStatus.workspaceName} through an authenticated Convex
        query.
      </p>
      <dl style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <div>
          <dt style={{ color: themeTokens.colors.muted }}>Workspace</dt>
          <dd style={{ margin: 0 }}>{protectedStatus.workspaceId}</dd>
        </div>
        <div>
          <dt style={{ color: themeTokens.colors.muted }}>Phase</dt>
          <dd style={{ margin: 0 }}>{protectedStatus.phase}</dd>
        </div>
        <div>
          <dt style={{ color: themeTokens.colors.muted }}>Required left</dt>
          <dd style={{ margin: 0 }}>{protectedStatus.checklistProgress.requiredRemaining}</dd>
        </div>
      </dl>
    </div>
  );
}
