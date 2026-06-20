import type { Diagnostic } from "./diagnostics.js";
import { expectedAgentstackGuidanceVersion, type AgentstackManifest } from "./manifest.js";

export const agentstackGuidanceAnchors = [
  "skills/agentstack/SKILL.md",
  "skills/agentstack/references/workflows.md",
  "skills/agentstack/references/guardrails.md",
  "skills/agentstack/references/observability.md",
  "docs/agentstack/skills.md"
];

export function getGuidanceGeneratedAnchors(_manifest: AgentstackManifest): string[] {
  return [...agentstackGuidanceAnchors];
}

export function validateGuidancePolicy(manifest: AgentstackManifest): Diagnostic[] {
  if (manifest.guidanceVersion === expectedAgentstackGuidanceVersion) {
    return [];
  }

  return [
    {
      severity: "warn",
      code: "guidance.version.stale",
      path: "guidanceVersion",
      message: `Agentstack guidance version ${manifest.guidanceVersion} differs from expected ${expectedAgentstackGuidanceVersion}.`,
      fix: "Regenerate or review Agentstack guidance skills for this project."
    }
  ];
}
