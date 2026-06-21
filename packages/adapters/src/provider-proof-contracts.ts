import type { ProviderControlPlaneService } from "./provider-control-plane.js";
import type { ProviderLiveIdentityConfidence } from "./provider-executor.js";

export const providerProofServices = ["clerk", "convex", "vercel", "eas"] as const;

export type ProviderProofService = (typeof providerProofServices)[number];

export type ProviderProofRequirementLabel =
  | "stable-provider-identity"
  | "ledger-comparable-identity"
  | "provider-specific-identity-parser"
  | "provider-owner-identity"
  | "provider-resource-id"
  | "provider-environment-scope"
  | "manifest-resource-name-match"
  | "ledger-external-id-match"
  | "provider-project-link-proof"
  | "provider-specific-drift-parser"
  | "expected-env-names"
  | "expected-resource-shape"
  | "env-drift-comparison";

export type ProviderProofContract = {
  service: ProviderProofService;
  liveIdentityConfidence: ProviderLiveIdentityConfidence;
  exactIdentityAvailable: false;
  identityProofRequirements: ProviderProofRequirementLabel[];
  driftProofRequirements: ProviderProofRequirementLabel[];
};

const baseIdentityRequirements = [
  "stable-provider-identity",
  "ledger-comparable-identity",
  "provider-specific-identity-parser"
] as const;

const baseDriftRequirements = [
  "provider-specific-drift-parser",
  "expected-env-names",
  "expected-resource-shape",
  "env-drift-comparison"
] as const;

const contracts: Record<ProviderProofService, ProviderProofContract> = {
  clerk: {
    service: "clerk",
    liveIdentityConfidence: "none",
    exactIdentityAvailable: false,
    identityProofRequirements: [
      ...baseIdentityRequirements,
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope",
      "manifest-resource-name-match",
      "ledger-external-id-match"
    ],
    driftProofRequirements: [...baseDriftRequirements, "provider-environment-scope"]
  },
  convex: {
    service: "convex",
    liveIdentityConfidence: "none",
    exactIdentityAvailable: false,
    identityProofRequirements: [
      ...baseIdentityRequirements,
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope",
      "manifest-resource-name-match",
      "ledger-external-id-match"
    ],
    driftProofRequirements: [...baseDriftRequirements, "provider-environment-scope"]
  },
  vercel: {
    service: "vercel",
    liveIdentityConfidence: "none",
    exactIdentityAvailable: false,
    identityProofRequirements: [
      ...baseIdentityRequirements,
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "manifest-resource-name-match",
      "ledger-external-id-match"
    ],
    driftProofRequirements: [...baseDriftRequirements, "provider-environment-scope"]
  },
  eas: {
    service: "eas",
    liveIdentityConfidence: "none",
    exactIdentityAvailable: false,
    identityProofRequirements: [
      ...baseIdentityRequirements,
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "manifest-resource-name-match",
      "ledger-external-id-match"
    ],
    driftProofRequirements: [...baseDriftRequirements, "provider-environment-scope"]
  }
};

export function getProviderProofContract(service: ProviderControlPlaneService): ProviderProofContract {
  return contracts[service];
}
