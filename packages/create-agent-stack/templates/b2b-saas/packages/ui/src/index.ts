import type { WorkspaceStatus, WorkspaceStatusChecklistItem } from "@app/domain";
import { tokenRoles, type TokenRole } from "@app/theme";

export type UiPrimitiveName =
  | "authGate"
  | "orgSwitcher"
  | "userMenu"
  | "planGate"
  | "settingsSection"
  | "dataTable"
  | "form"
  | "modal"
  | "emptyState"
  | "loadingState"
  | "errorState"
  | "commandSearch"
  | "mobileList"
  | "navigationShell"
  | "workspaceStatus"
  | "statusChecklist";

export type UiPrimitiveState = "idle" | "loading" | "empty" | "error" | "disabled" | "selected";

export type UiPrimitiveDefinition = {
  name: UiPrimitiveName;
  requiredStates: UiPrimitiveState[];
  surfaceRoles: {
    background: TokenRole;
    foreground: TokenRole;
    focusRing: TokenRole;
  };
  accessibility: {
    keyboard: boolean;
    labelledByRequired: boolean;
  };
};

const defaultSurfaceRoles = {
  background: tokenRoles.surface,
  foreground: tokenRoles.foreground,
  focusRing: tokenRoles.focusRing
} as const;

export const uiPrimitives = {
  authGate: primitive("authGate", ["idle", "loading", "error"]),
  orgSwitcher: primitive("orgSwitcher", ["idle", "loading", "disabled", "selected"]),
  userMenu: primitive("userMenu", ["idle", "loading", "disabled"]),
  planGate: primitive("planGate", ["idle", "loading", "error", "disabled"]),
  settingsSection: primitive("settingsSection", ["idle", "loading", "error"]),
  dataTable: primitive("dataTable", ["idle", "loading", "empty", "error", "selected"]),
  form: primitive("form", ["idle", "loading", "error", "disabled"]),
  modal: primitive("modal", ["idle", "loading", "error"]),
  emptyState: primitive("emptyState", ["empty"]),
  loadingState: primitive("loadingState", ["loading"]),
  errorState: {
    ...primitive("errorState", ["error"]),
    surfaceRoles: {
      background: tokenRoles.surface,
      foreground: tokenRoles.danger,
      focusRing: tokenRoles.focusRing
    }
  },
  commandSearch: primitive("commandSearch", ["idle", "loading", "empty", "selected"]),
  mobileList: primitive("mobileList", ["idle", "loading", "empty", "error", "selected"]),
  navigationShell: primitive("navigationShell", ["idle", "loading", "selected"]),
  workspaceStatus: primitive("workspaceStatus", ["idle", "loading", "error"]),
  statusChecklist: primitive("statusChecklist", ["idle", "empty", "selected"])
} satisfies Record<UiPrimitiveName, UiPrimitiveDefinition>;

export function primitive(
  name: UiPrimitiveName,
  requiredStates: UiPrimitiveState[]
): UiPrimitiveDefinition {
  return {
    name,
    requiredStates,
    surfaceRoles: defaultSurfaceRoles,
    accessibility: {
      keyboard: true,
      labelledByRequired: true
    }
  };
}

export type WorkspaceStatusPrimitive = UiPrimitiveDefinition & {
  status: WorkspaceStatus;
  progressLabel: string;
};

export type StatusChecklistPrimitive = UiPrimitiveDefinition & {
  items: WorkspaceStatusChecklistItem[];
};

export function createWorkspaceStatusPrimitive(
  status: WorkspaceStatus,
  progressLabel: string
): WorkspaceStatusPrimitive {
  return {
    ...uiPrimitives.workspaceStatus,
    status,
    progressLabel
  };
}

export function createStatusChecklistPrimitive(
  items: WorkspaceStatusChecklistItem[]
): StatusChecklistPrimitive {
  return {
    ...uiPrimitives.statusChecklist,
    items
  };
}
