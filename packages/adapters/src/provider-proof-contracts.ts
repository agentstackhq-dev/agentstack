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

export type ProviderIdentityReadCommandId =
  | "clerk.doctor-agent"
  | "clerk.env-pull-agent"
  | "clerk.config-pull-agent"
  | "convex.env-list-preview-deployment"
  | "vercel.env-ls-preview"
  | "eas.env-list-preview";

export type ProviderIdentityCandidateCategory =
  | "stable-provider-identity"
  | "manifest-resource-name-match"
  | "ledger-external-id-match"
  | "provider-owner-identity"
  | "provider-resource-id"
  | "provider-environment-scope"
  | "provider-project-link-proof";

export type ProviderIdentityReadPlan = {
  service: ProviderProofService;
  exactIdentityAvailable: false;
  readCommands: ProviderIdentityReadCommandId[];
  requiredCandidateCategories: ProviderIdentityCandidateCategory[];
  missingUntilParsersExist: ProviderProofRequirementLabel[];
};

export type ProviderIdentityCandidateSource = "provider-read-plan" | "manifest" | "ledger" | "local-link";

export type ProviderIdentityCandidate = {
  category: ProviderIdentityCandidateCategory;
  source: ProviderIdentityCandidateSource;
  sanitizedLabel: string;
};

export type ProviderIdentityProofResult =
  | {
      proof: "unavailable";
      evaluator: "unavailable";
      missing: ProviderProofRequirementLabel[];
    }
  | {
      proof: "ambiguous";
      evaluator: "identity-read-plan";
      missing: ProviderProofRequirementLabel[];
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

const identityReadPlans: Record<ProviderProofService, ProviderIdentityReadPlan> = {
  clerk: {
    service: "clerk",
    exactIdentityAvailable: false,
    readCommands: ["clerk.doctor-agent", "clerk.env-pull-agent", "clerk.config-pull-agent"],
    requiredCandidateCategories: [
      "stable-provider-identity",
      "manifest-resource-name-match",
      "ledger-external-id-match",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope"
    ],
    missingUntilParsersExist: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope"
    ]
  },
  convex: {
    service: "convex",
    exactIdentityAvailable: false,
    readCommands: ["convex.env-list-preview-deployment"],
    requiredCandidateCategories: [
      "stable-provider-identity",
      "manifest-resource-name-match",
      "ledger-external-id-match",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope"
    ],
    missingUntilParsersExist: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope"
    ]
  },
  vercel: {
    service: "vercel",
    exactIdentityAvailable: false,
    readCommands: ["vercel.env-ls-preview"],
    requiredCandidateCategories: [
      "stable-provider-identity",
      "manifest-resource-name-match",
      "ledger-external-id-match",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ],
    missingUntilParsersExist: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ]
  },
  eas: {
    service: "eas",
    exactIdentityAvailable: false,
    readCommands: ["eas.env-list-preview"],
    requiredCandidateCategories: [
      "stable-provider-identity",
      "manifest-resource-name-match",
      "ledger-external-id-match",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ],
    missingUntilParsersExist: [
      "provider-specific-identity-parser",
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "provider-environment-scope"
    ]
  }
};

const envListPreviewFacts = [
  "env-list-read",
  "expected-env-names",
  "preview-environment"
] as const satisfies ProviderLiveFactLabel[];

const providerSpecificIdentityParserBlocker = "provider-specific-identity-parser" as const;
const ledgerComparableIdentityBlocker = "ledger-comparable-identity" as const;

export function getProviderProofContract(service: ProviderControlPlaneService): ProviderProofContract {
  return contracts[service];
}

export function getProviderIdentityReadPlan(service: ProviderControlPlaneService): ProviderIdentityReadPlan {
  return identityReadPlans[service];
}

export function evaluateProviderIdentityProof(
  service: ProviderControlPlaneService,
  candidates: readonly ProviderIdentityCandidate[]
): ProviderIdentityProofResult {
  const plan = getProviderIdentityReadPlan(service);
  const sanitizedCategories = new Set(
    candidates
      .filter((candidate) => candidate.sanitizedLabel === candidate.category)
      .map((candidate) => candidate.category)
  );

  if (sanitizedCategories.size === 0) {
    return {
      proof: "unavailable",
      evaluator: "unavailable",
      missing: plan.missingUntilParsersExist
    };
  }

  const missingCategories: ProviderProofRequirementLabel[] = plan.requiredCandidateCategories.filter(
    (category) => !sanitizedCategories.has(category)
  );
  const missingWithoutStableIdentity = missingCategories.filter((category) => category !== "stable-provider-identity");
  const missing = [
    providerSpecificIdentityParserBlocker,
    ...(missingCategories.includes("stable-provider-identity") ? ["stable-provider-identity" as const] : []),
    ledgerComparableIdentityBlocker,
    ...missingWithoutStableIdentity
  ];
  return {
    proof: "ambiguous",
    evaluator: "identity-read-plan",
    missing
  };
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
