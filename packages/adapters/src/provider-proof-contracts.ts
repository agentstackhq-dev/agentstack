import type { ProviderControlPlaneService } from "./provider-control-plane.js";
import type {
  ProviderExactIdentityComparisonLabel,
  ProviderExactIdentityProofLabel,
  ProviderExecutionResult,
  ProviderIdentityCandidateLabel,
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
  exactIdentityAvailable: ProviderExactIdentityAvailability;
  identityProofRequirements: ProviderProofRequirementLabel[];
  driftProofRequirements: ProviderProofRequirementLabel[];
};

export type ProviderExactIdentityAvailability =
  | false
  | {
      scope: "provider-proof";
      environments: ["preview"] | ["preview", "production"];
      resourceTypes: ["application" | "project"];
      evaluator: "provider-specific-identity-parser";
    };

export type ProviderIdentityReadCommandId =
  | "clerk.doctor-agent"
  | "clerk.env-pull-agent"
  | "clerk.apps-list-json"
  | "clerk.config-pull-agent"
  | "convex.env-list-preview-deployment"
  | "convex.env-list-production-deployment"
  | "vercel.env-ls-preview"
  | "vercel.env-ls-production"
  | "vercel.project-ls-json"
  | "eas.env-list-preview"
  | "eas.env-list-production"
  | "eas.project-info";

export type ProviderIdentityCandidateCategory = ProviderIdentityCandidateLabel;

export type ProviderIdentityReadPlan = {
  service: ProviderProofService;
  exactIdentityAvailable: ProviderExactIdentityAvailability;
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

export type ProviderIdentityCandidateProofResult =
  | {
      proof: "unavailable";
      evaluator: "unavailable";
      labels: [];
      missing: ProviderProofRequirementLabel[];
    }
  | {
      proof: "ambiguous";
      evaluator: "provider-specific-identity-candidate-parser";
      labels: ProviderIdentityCandidateLabel[];
      missing: ProviderProofRequirementLabel[];
    };

export type ProviderExactIdentityDecision =
  | {
      proof: "exact";
      evaluator: "provider-exact-identity";
      labels: ProviderExactIdentityProofLabel[];
      missing: [];
    }
  | {
      proof: "ambiguous" | "unavailable";
      evaluator: "provider-exact-identity" | "unavailable";
      labels: ProviderExactIdentityProofLabel[];
      missing: ProviderProofRequirementLabel[];
    };

export type ProviderDriftProofResult =
  | { proof: "unavailable" }
  | {
      proof: "partial";
      evaluator: "env-list-preview" | "env-list-production" | "clerk-apps-list-preview" | "clerk-config-preview";
      evidence: ProviderLiveFactLabel[];
    };

export type ProviderLiveCoherenceProofResult =
  | {
      proof: "unavailable";
      evaluator: "unavailable";
      blockers: ProviderProofRequirementLabel[];
    }
  | {
      proof: "blocked";
      evaluator: "provider-live-coherence";
      blockers: ProviderProofRequirementLabel[];
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
    exactIdentityAvailable: {
      scope: "provider-proof",
      environments: ["preview", "production"],
      resourceTypes: ["application"],
      evaluator: "provider-specific-identity-parser"
    },
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
    exactIdentityAvailable: {
      scope: "provider-proof",
      environments: ["preview", "production"],
      resourceTypes: ["project"],
      evaluator: "provider-specific-identity-parser"
    },
    identityProofRequirements: [
      ...baseIdentityRequirements,
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope",
      "provider-project-link-proof",
      "manifest-resource-name-match",
      "ledger-external-id-match"
    ],
    driftProofRequirements: [...baseDriftRequirements, "provider-environment-scope"]
  },
  eas: {
    service: "eas",
    liveIdentityConfidence: "none",
    exactIdentityAvailable: {
      scope: "provider-proof",
      environments: ["preview", "production"],
      resourceTypes: ["project"],
      evaluator: "provider-specific-identity-parser"
    },
    identityProofRequirements: [
      ...baseIdentityRequirements,
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope",
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
    exactIdentityAvailable: contracts.clerk.exactIdentityAvailable,
    readCommands: ["clerk.doctor-agent", "clerk.env-pull-agent", "clerk.config-pull-agent", "clerk.apps-list-json"],
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
    readCommands: ["convex.env-list-preview-deployment", "convex.env-list-production-deployment"],
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
    exactIdentityAvailable: contracts.vercel.exactIdentityAvailable,
    readCommands: ["vercel.env-ls-preview", "vercel.env-ls-production", "vercel.project-ls-json"],
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
    exactIdentityAvailable: contracts.eas.exactIdentityAvailable,
    readCommands: ["eas.env-list-preview", "eas.env-list-production", "eas.project-info"],
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
const envListProductionFacts = [
  "env-list-read",
  "expected-env-names",
  "production-environment"
] as const satisfies ProviderLiveFactLabel[];

const providerSpecificIdentityParserBlocker = "provider-specific-identity-parser" as const;
const ledgerComparableIdentityBlocker = "ledger-comparable-identity" as const;

const proofLabelsRequiringComparison = [
  "stable-provider-identity",
  "ledger-comparable-identity",
  "manifest-resource-name-match",
  "ledger-external-id-match",
  "provider-owner-identity",
  "provider-resource-id",
  "provider-environment-scope",
  "provider-project-link-proof"
] as const satisfies readonly ProviderExactIdentityComparisonLabel[];

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

export function evaluateProviderIdentityCandidateProof(
  service: ProviderControlPlaneService,
  readResults: readonly ProviderExecutionResult[]
): ProviderIdentityCandidateProofResult {
  const plan = getProviderIdentityReadPlan(service);

  if (readResults.length === 0 || readResults.some((result) => result.status !== "success")) {
    return {
      proof: "unavailable",
      evaluator: "unavailable",
      labels: [],
      missing: plan.missingUntilParsersExist
    };
  }

  const labels = new Set<ProviderIdentityCandidateLabel>();
  for (const result of readResults) {
    if (
      result.service !== service ||
      result.identityCandidates?.kind !== "provider-identity-candidates" ||
      result.identityCandidates.evaluator !== "provider-specific-identity-candidate-parser"
    ) {
      continue;
    }
    for (const label of result.identityCandidates.labels) {
      labels.add(label);
    }
  }

  const sortedLabels = [...labels].sort();
  if (sortedLabels.length === 0) {
    return {
      proof: "unavailable",
      evaluator: "unavailable",
      labels: [],
      missing: plan.missingUntilParsersExist
    };
  }

  return {
    proof: "ambiguous",
    evaluator: "provider-specific-identity-candidate-parser",
    labels: sortedLabels,
    missing: missingIdentityProofForCandidateLabels(plan, labels)
  };
}

export function evaluateProviderExactIdentityProof(
  service: ProviderControlPlaneService,
  readResults: readonly ProviderExecutionResult[]
): ProviderExactIdentityDecision {
  const plan = getProviderIdentityReadPlan(service);
  const labels = new Set<ProviderExactIdentityProofLabel>();
  const matchedComparisons = new Set<ProviderExactIdentityComparisonLabel>();

  if (readResults.length === 0 || readResults.some((result) => result.status !== "success")) {
    return {
      proof: "unavailable",
      evaluator: "unavailable",
      labels: [],
      missing: plan.missingUntilParsersExist
    };
  }

  for (const result of readResults) {
    if (
      result.service !== service ||
      result.exactIdentityProof?.kind !== "provider-exact-identity-proof" ||
      result.exactIdentityProof.evaluator !== "provider-specific-identity-parser"
    ) {
      continue;
    }
    for (const label of result.exactIdentityProof.labels) {
      labels.add(label);
    }
    for (const comparison of result.exactIdentityProof.comparisons ?? []) {
      if (comparison.outcome === "matched") {
        matchedComparisons.add(comparison.label);
      }
    }
  }

  const required = [
    "provider-specific-identity-parser",
    "stable-provider-identity",
    "ledger-comparable-identity",
    ...plan.requiredCandidateCategories
  ] as const satisfies readonly ProviderProofRequirementLabel[];
  const requiredSet = new Set<ProviderProofRequirementLabel>(required);
  const requiredComparisons = proofLabelsRequiringComparison.filter((label) =>
    requiredSet.has(label)
  );
  const missingLabels = required.filter((label) => !labels.has(label as ProviderExactIdentityProofLabel));
  const missingComparisons = requiredComparisons.filter((label) => !matchedComparisons.has(label));
  const missing = [...new Set([...missingLabels, ...missingComparisons])];
  const sortedLabels = [...labels].sort();

  if (sortedLabels.length === 0) {
    return {
      proof: "unavailable",
      evaluator: "unavailable",
      labels: [],
      missing: plan.missingUntilParsersExist
    };
  }

  if (missing.length > 0) {
    return {
      proof: "ambiguous",
      evaluator: "provider-exact-identity",
      labels: sortedLabels,
      missing
    };
  }

  return {
    proof: "exact",
    evaluator: "provider-exact-identity",
    labels: sortedLabels,
    missing: []
  };
}

function missingIdentityProofForCandidateLabels(
  plan: ProviderIdentityReadPlan,
  labels: ReadonlySet<ProviderIdentityCandidateLabel>
): ProviderProofRequirementLabel[] {
  const missingCandidateCategories = plan.requiredCandidateCategories.filter((category) => !labels.has(category));
  const missing = [
    providerSpecificIdentityParserBlocker,
    ...(labels.has("stable-provider-identity") ? [] : ["stable-provider-identity" as const]),
    ledgerComparableIdentityBlocker,
    ...missingCandidateCategories.filter((category) => category !== "stable-provider-identity")
  ];
  return [...new Set(missing)];
}

export function evaluateProviderDriftProof(
  service: ProviderControlPlaneService,
  readResults: readonly ProviderExecutionResult[]
): ProviderDriftProofResult {
  if (service === "clerk") {
    return evaluateClerkAppsListPreviewDriftProof(readResults);
  }

  if (service !== "convex" && service !== "vercel" && service !== "eas") {
    return { proof: "unavailable" };
  }

  const expectedCommandKind = service === "eas" ? "mobile.env.list" : "env.list";
  const hasCompleteEnvListPreviewEvidence = hasCompleteEnvListEvidence(readResults, {
    service,
    environment: "preview",
    commandKind: expectedCommandKind,
    facts: envListPreviewFacts
  });

  if (hasCompleteEnvListPreviewEvidence) {
    return {
      proof: "partial",
      evaluator: "env-list-preview",
      evidence: [...envListPreviewFacts].sort()
    };
  }

  if (
    service === "vercel" &&
    hasCompleteEnvListEvidence(readResults, {
      service,
      environment: "production",
      commandKind: "env.list",
      facts: envListProductionFacts
    })
  ) {
    return {
      proof: "partial",
      evaluator: "env-list-production",
      evidence: [...envListProductionFacts].sort()
    };
  }

  return { proof: "unavailable" };
}

export function evaluateProviderLiveCoherenceProof(
  service: ProviderControlPlaneService,
  exactIdentityDecision: ProviderExactIdentityDecision,
  driftProof: ProviderDriftProofResult
): ProviderLiveCoherenceProofResult {
  if (exactIdentityDecision.proof !== "exact") {
    if (exactIdentityDecision.proof === "unavailable") {
      return {
        proof: "unavailable",
        evaluator: "unavailable",
        blockers: exactIdentityDecision.missing
      };
    }

    return {
      proof: "blocked",
      evaluator: "provider-live-coherence",
      blockers: failClosedLiveCoherenceBlockers(exactIdentityDecision.missing)
    };
  }

  const contract = getProviderProofContract(service);
  const driftBlockers =
    driftProof.proof === "partial"
      ? contract.driftProofRequirements.filter((label) => !driftProof.evidence.includes(label as ProviderLiveFactLabel))
      : contract.driftProofRequirements;

  return {
    proof: "blocked",
    evaluator: "provider-live-coherence",
    blockers: failClosedLiveCoherenceBlockers(driftBlockers)
  };
}

function failClosedLiveCoherenceBlockers(
  blockers: ProviderProofRequirementLabel[]
): ProviderProofRequirementLabel[] {
  return blockers.length > 0 ? blockers : ["env-drift-comparison"];
}

const clerkAppsListPreviewFacts = ["apps-list-read", "expected-resource-shape", "preview-environment"] as const;
const clerkEnvPreviewFacts = ["clerk-env-key-presence", "provider-env-read", "preview-environment"] as const;
const clerkConfigPreviewFacts = [
  "clerk-billing-config-present",
  "clerk-organization-config-present",
  "clerk-redirect-config-present",
  "clerk-webhook-config-present",
  "provider-config-read",
  "preview-environment"
] as const;
const clerkExactAppsListComparisonLabels = [
  "stable-provider-identity",
  "ledger-comparable-identity",
  "manifest-resource-name-match",
  "ledger-external-id-match",
  "provider-owner-identity",
  "provider-resource-id",
  "provider-environment-scope"
] as const;
const clerkExactAppsListProofLabels = [
  ...clerkExactAppsListComparisonLabels,
  "provider-specific-identity-parser"
] satisfies readonly ProviderExactIdentityProofLabel[];

function evaluateClerkAppsListPreviewDriftProof(
  readResults: readonly ProviderExecutionResult[]
): ProviderDriftProofResult {
  if (readResults.length === 0 || readResults.some((result) => result.status !== "success")) {
    return { proof: "unavailable" };
  }

  const hasCompleteClerkAppsListPreviewEvidence = readResults.some((result) => {
    if (
      result.service !== "clerk" ||
      result.environment !== "preview" ||
      result.commandKind !== "auth.apps.list" ||
      result.status !== "success" ||
      result.liveIdentityFacts?.identityConfidence !== "partial" ||
      result.outputRedacted !== true ||
      result.exactIdentityProof?.kind !== "provider-exact-identity-proof" ||
      result.exactIdentityProof.evaluator !== "provider-specific-identity-parser"
    ) {
      return false;
    }

    const facts = new Set(result.liveIdentityFacts.facts);
    if (!clerkAppsListPreviewFacts.every((fact) => facts.has(fact))) {
      return false;
    }

    const labels = new Set(result.exactIdentityProof.labels);
    if (!clerkExactAppsListProofLabels.every((label) => labels.has(label))) {
      return false;
    }

    const matchedComparisons = new Set(
      (result.exactIdentityProof.comparisons ?? [])
        .filter((comparison) => comparison.outcome === "matched")
        .map((comparison) => comparison.label)
    );
    return clerkExactAppsListComparisonLabels.every((label) => matchedComparisons.has(label));
  });

  if (!hasCompleteClerkAppsListPreviewEvidence) {
    return { proof: "unavailable" };
  }

  const hasCompleteClerkEnvPreviewEvidence = readResults.some((result) =>
    hasClerkLiveFacts(result, "auth.env.pull", clerkEnvPreviewFacts)
  );
  const hasCompleteClerkConfigPreviewEvidence = readResults.some((result) =>
    hasClerkLiveFacts(result, "auth.config.pull", clerkConfigPreviewFacts)
  );

  if (hasCompleteClerkEnvPreviewEvidence && hasCompleteClerkConfigPreviewEvidence) {
    return {
      proof: "partial",
      evaluator: "clerk-config-preview",
      evidence: [
        ...new Set([
          ...clerkAppsListPreviewFacts,
          ...clerkEnvPreviewFacts,
          ...clerkConfigPreviewFacts
        ])
      ].sort()
    };
  }

  return {
    proof: "partial",
    evaluator: "clerk-apps-list-preview",
    evidence: [...clerkAppsListPreviewFacts].sort()
  };
}

function hasCompleteEnvListEvidence(
  readResults: readonly ProviderExecutionResult[],
  input: {
    service: ProviderControlPlaneService;
    environment: "preview" | "production";
    commandKind: "env.list" | "mobile.env.list";
    facts: readonly ProviderLiveFactLabel[];
  }
): boolean {
  return readResults.some((result) => {
    if (
      result.service !== input.service ||
      result.environment !== input.environment ||
      result.commandKind !== input.commandKind ||
      result.status !== "success" ||
      result.liveIdentityFacts?.identityConfidence !== "partial" ||
      result.outputRedacted !== true
    ) {
      return false;
    }

    const facts = new Set(result.liveIdentityFacts.facts);
    return input.facts.every((fact) => facts.has(fact));
  });
}

function hasClerkLiveFacts(
  result: ProviderExecutionResult,
  commandKind: "auth.env.pull" | "auth.config.pull",
  requiredFacts: readonly ProviderLiveFactLabel[]
): boolean {
  if (
    result.service !== "clerk" ||
    result.environment !== "preview" ||
    result.commandKind !== commandKind ||
    result.status !== "success" ||
    result.liveIdentityFacts?.identityConfidence !== "partial" ||
    result.outputRedacted !== true
  ) {
    return false;
  }

  const facts = new Set(result.liveIdentityFacts.facts);
  return requiredFacts.every((fact) => facts.has(fact));
}
