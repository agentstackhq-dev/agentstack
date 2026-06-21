import {
  getWorkspaceStatusChecklistProgress,
  getWorkspaceStatusSeed,
  getWorkspaceStatusSummary
} from "@app/domain";
import { themeTokens } from "@app/theme";
import { createStatusChecklistPrimitive, createWorkspaceStatusPrimitive } from "@app/ui";

export function App() {
  const status = getWorkspaceStatusSeed();
  const progress = getWorkspaceStatusChecklistProgress(status);
  const workspaceStatus = createWorkspaceStatusPrimitive(
    status,
    `${progress.completed} of ${progress.total} complete`
  );
  const checklist = createStatusChecklistPrimitive(status.checklist);

  return (
    <main
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
          {workspaceStatus.status.workspaceName}
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
        <h2 style={{ marginTop: 24 }}>Checklist</h2>
        <p style={{ color: themeTokens.colors.muted }}>{workspaceStatus.progressLabel}</p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {checklist.items.map((item) => (
            <li key={item.id} style={{ padding: "10px 0", borderTop: `1px solid ${themeTokens.colors.muted}` }}>
              <strong>{item.complete ? "Done" : "Next"}</strong> {item.label}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
