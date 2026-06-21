import type { ProviderControlPlaneService } from "./provider-control-plane.js";
import type {
  ProviderExecutionResult,
  ProviderLiveFactLabel,
  ProviderLiveIdentityConfidence
} from "./provider-executor.js";

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

export type ProviderDriftProofResult =
  | { proof: "unavailable" }
  | {
      proof: "partial";
      evaluator: "env-list-preview";
      evidence: ProviderLiveFactLabel[];
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

const envListPreviewFacts = [
  "env-list-read",
  "expected-env-names",
  "preview-environment"
] as const satisfies ProviderLiveFactLabel[];

export function getProviderProofContract(service: ProviderControlPlaneService): ProviderProofContract {
  return contracts[service];
}

export function evaluateProviderDriftProof(
  service: ProviderControlPlaneService,
  readResults: readonly ProviderExecutionResult[]
): ProviderDriftProofResult {
  if (service !== "vercel" && service !== "eas") {
    return { proof: "unavailable" };
  }

  const hasCompleteEnvListPreviewEvidence = readResults.some((result) => {
    const expectedCommandKind = service === "vercel" ? "env.list" : "mobile.env.list";
    if (
      result.service !== service ||
      result.environment !== "preview" ||
      result.commandKind !== expectedCommandKind ||
      result.status !== "success" ||
      result.liveIdentityFacts?.identityConfidence !== "partial" ||
      result.outputRedacted !== true
    ) {
      return false;
    }
    const facts = new Set(result.liveIdentityFacts?.facts ?? []);
    return envListPreviewFacts.every((fact) => facts.has(fact));
  });

  if (!hasCompleteEnvListPreviewEvidence) {
    return { proof: "unavailable" };
  }

  return {
    proof: "partial",
    evaluator: "env-list-preview",
    evidence: [...envListPreviewFacts].sort()
  };
}
