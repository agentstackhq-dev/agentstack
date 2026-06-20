import type { AgentstackManifest } from "./manifest.js";

export const saasSpineGeneratedAnchors = [
  "docs/agentstack/saas-spine.md",
  "packages/domain/src/saas-spine.ts",
  "convex/saasSpine.ts"
] as const;

export type SaasSpineGeneratedAnchor = (typeof saasSpineGeneratedAnchors)[number];

export function hasManagedSaasSpine(manifest: AgentstackManifest): boolean {
  return (
    manifest.services.clerk.enabled &&
    manifest.services.convex.enabled &&
    manifest.surfaces.includes("convex")
  );
}

export function getSaasSpineGeneratedAnchors(manifest: AgentstackManifest): SaasSpineGeneratedAnchor[] {
  return hasManagedSaasSpine(manifest) ? [...saasSpineGeneratedAnchors] : [];
}
