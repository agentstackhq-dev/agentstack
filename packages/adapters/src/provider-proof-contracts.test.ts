import { describe, expect, it } from "vitest";
import {
  evaluateProviderDriftProof,
  evaluateProviderExactIdentityProof,
  evaluateProviderLiveCoherenceProof,
  evaluateProviderIdentityCandidateProof,
  evaluateProviderIdentityProof,
  getProviderIdentityReadPlan,
  getProviderProofContract,
  providerProofServices,
  type ProviderIdentityCandidate,
  type ProviderProofRequirementLabel
} from "./provider-proof-contracts.js";
import type { ProviderExecutionResult } from "./provider-executor.js";

const sanitizedLabelPattern = /^[a-z][a-z0-9.-]*$/;

const completeSanitizedCandidates: ProviderIdentityCandidate[] = [
  { category: "stable-provider-identity", source: "provider-read-plan", sanitizedLabel: "stable-provider-identity" },
  { category: "manifest-resource-name-match", source: "manifest", sanitizedLabel: "manifest-resource-name-match" },
  { category: "ledger-external-id-match", source: "ledger", sanitizedLabel: "ledger-external-id-match" },
  { category: "provider-owner-identity", source: "provider-read-plan", sanitizedLabel: "provider-owner-identity" },
  { category: "provider-resource-id", source: "provider-read-plan", sanitizedLabel: "provider-resource-id" },
  { category: "provider-environment-scope", source: "provider-read-plan", sanitizedLabel: "provider-environment-scope" },
  { category: "provider-project-link-proof", source: "local-link", sanitizedLabel: "provider-project-link-proof" }
];

describe("provider proof contracts", () => {
  it("keeps exact live identity unavailable except bounded Clerk and Vercel preview proof slices", () => {
    for (const service of providerProofServices) {
      const contract = getProviderProofContract(service);

      expect(contract.service).toBe(service);
      expect(contract.liveIdentityConfidence).toBe("none");
      expect(contract.identityProofRequirements).toEqual(
        expect.arrayContaining([
          "stable-provider-identity",
          "ledger-comparable-identity",
          "provider-specific-identity-parser"
        ] satisfies ProviderProofRequirementLabel[])
      );
      expect(contract.driftProofRequirements).toEqual(
        expect.arrayContaining([
          "provider-specific-drift-parser",
          "expected-env-names",
          "expected-resource-shape"
        ] satisfies ProviderProofRequirementLabel[])
      );
    }

    expect(getProviderProofContract("clerk").exactIdentityAvailable).toEqual({
      scope: "provider-proof",
      environments: ["preview"],
      resourceTypes: ["application"],
      evaluator: "provider-specific-identity-parser"
    });
    expect(getProviderProofContract("vercel").exactIdentityAvailable).toEqual({
      scope: "provider-proof",
      environments: ["preview"],
      resourceTypes: ["project"],
      evaluator: "provider-specific-identity-parser"
    });
    for (const service of ["convex", "eas"] as const) {
      expect(getProviderProofContract(service).exactIdentityAvailable).toBe(false);
    }
  });

  it("returns stable sanitized provider-specific proof requirement labels", () => {
    expect(getProviderProofContract("clerk").identityProofRequirements).toEqual([
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-specific-identity-parser",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope",
      "manifest-resource-name-match",
      "ledger-external-id-match"
    ]);
    expect(getProviderProofContract("convex").identityProofRequirements).toEqual([
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-specific-identity-parser",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope",
      "manifest-resource-name-match",
      "ledger-external-id-match"
    ]);
    expect(getProviderProofContract("vercel").identityProofRequirements).toEqual([
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-specific-identity-parser",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-environment-scope",
      "provider-project-link-proof",
      "manifest-resource-name-match",
      "ledger-external-id-match"
    ]);
    expect(getProviderProofContract("eas").identityProofRequirements).toEqual([
      "stable-provider-identity",
      "ledger-comparable-identity",
      "provider-specific-identity-parser",
      "provider-owner-identity",
      "provider-resource-id",
      "provider-project-link-proof",
      "manifest-resource-name-match",
      "ledger-external-id-match"
    ]);

    for (const service of providerProofServices) {
      const contract = getProviderProofContract(service);
      for (const label of [...contract.identityProofRequirements, ...contract.driftProofRequirements]) {
        expect(label).toMatch(sanitizedLabelPattern);
        expect(label).not.toContain("://");
        expect(label).not.toContain("_");
      }
    }
  });

  it("lists provider-specific sanitized identity read plans with Clerk exact proof bounded to preview proof", () => {
    expect(getProviderIdentityReadPlan("clerk")).toEqual({
      service: "clerk",
      exactIdentityAvailable: {
        scope: "provider-proof",
        environments: ["preview"],
        resourceTypes: ["application"],
        evaluator: "provider-specific-identity-parser"
      },
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
    });

    expect(getProviderIdentityReadPlan("convex")).toEqual({
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
    });

    expect(getProviderIdentityReadPlan("vercel")).toEqual({
      service: "vercel",
      exactIdentityAvailable: {
        scope: "provider-proof",
        environments: ["preview"],
        resourceTypes: ["project"],
        evaluator: "provider-specific-identity-parser"
      },
      readCommands: ["vercel.env-ls-preview", "vercel.project-ls-json"],
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
    });

    expect(getProviderIdentityReadPlan("eas")).toEqual({
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
    });

    for (const service of providerProofServices) {
      const plan = getProviderIdentityReadPlan(service);
      expect(plan.exactIdentityAvailable).toEqual(getProviderProofContract(service).exactIdentityAvailable);
      for (const label of [
        ...plan.readCommands,
        ...plan.requiredCandidateCategories,
        ...plan.missingUntilParsersExist
      ]) {
        expect(label).toMatch(/^[a-z][a-z0-9.-]*$/);
        expect(label).not.toContain("://");
        expect(label).not.toContain("_");
      }
    }
  });

  it("keeps identity unavailable when there are no sanitized candidates", () => {
    for (const service of providerProofServices) {
      expect(evaluateProviderIdentityProof(service, [])).toEqual({
        proof: "unavailable",
        evaluator: "unavailable",
        missing: getProviderIdentityReadPlan(service).missingUntilParsersExist
      });
    }
  });

  it("keeps identity ambiguous even when every sanitized candidate category is present", () => {
    for (const service of providerProofServices) {
      expect(evaluateProviderIdentityProof(service, completeSanitizedCandidates)).toEqual({
        proof: "ambiguous",
        evaluator: "identity-read-plan",
        missing: ["provider-specific-identity-parser", "ledger-comparable-identity"]
      });
    }
  });

  it("keeps incomplete candidates ambiguous with sanitized missing labels", () => {
    expect(
      evaluateProviderIdentityProof("vercel", [
        { category: "manifest-resource-name-match", source: "manifest", sanitizedLabel: "manifest-resource-name-match" },
        { category: "ledger-external-id-match", source: "ledger", sanitizedLabel: "ledger-external-id-match" }
      ])
    ).toEqual({
      proof: "ambiguous",
      evaluator: "identity-read-plan",
      missing: [
        "provider-specific-identity-parser",
        "stable-provider-identity",
        "ledger-comparable-identity",
        "provider-owner-identity",
        "provider-resource-id",
        "provider-project-link-proof",
        "provider-environment-scope"
      ]
    });
  });

  it("drops unsanitized identity candidates before evaluation", () => {
    const result = evaluateProviderIdentityProof("clerk", [
      { category: "provider-resource-id", source: "provider-read-plan", sanitizedLabel: "app_123_raw" },
      { category: "provider-owner-identity", source: "provider-read-plan", sanitizedLabel: "https://dashboard.clerk.com/acme" },
      { category: "manifest-resource-name-match", source: "manifest", sanitizedLabel: "manifest-resource-name-match" }
    ] as never);

    expect(result).toEqual({
      proof: "ambiguous",
      evaluator: "identity-read-plan",
      missing: [
        "provider-specific-identity-parser",
        "stable-provider-identity",
        "ledger-comparable-identity",
        "ledger-external-id-match",
        "provider-owner-identity",
        "provider-resource-id",
        "provider-environment-scope"
      ]
    });
    expect(JSON.stringify(result)).not.toContain("app_123_raw");
    expect(JSON.stringify(result)).not.toContain("dashboard.clerk.com");
  });

  it("ignores provider-shaped and secret-shaped labels that do not equal their category", () => {
    const result = evaluateProviderIdentityProof("vercel", [
      {
        category: "provider-owner-identity",
        source: "provider-read-plan",
        sanitizedLabel: "dashboard.clerk.com"
      },
      {
        category: "provider-resource-id",
        source: "provider-read-plan",
        sanitizedLabel: "prj-secret-project"
      },
      {
        category: "stable-provider-identity",
        source: "provider-read-plan",
        sanitizedLabel: "sk-live-secret"
      },
      {
        category: "manifest-resource-name-match",
        source: "manifest",
        sanitizedLabel: "manifest-resource-name-match"
      }
    ]);

    expect(result).toEqual({
      proof: "ambiguous",
      evaluator: "identity-read-plan",
      missing: [
        "provider-specific-identity-parser",
        "stable-provider-identity",
        "ledger-comparable-identity",
        "ledger-external-id-match",
        "provider-owner-identity",
        "provider-resource-id",
        "provider-project-link-proof",
        "provider-environment-scope"
      ]
    });
    expect(JSON.stringify(result)).not.toContain("dashboard.clerk.com");
    expect(JSON.stringify(result)).not.toContain("prj-secret-project");
    expect(JSON.stringify(result)).not.toContain("sk-live-secret");
  });

  it("does not expose an exact identity result shape in the contract slice", () => {
    for (const service of providerProofServices) {
      const result = evaluateProviderIdentityProof(service, completeSanitizedCandidates);
      expect(result.proof).not.toBe("exact");
      expect(JSON.stringify(result)).not.toContain("\"exact\"");
      expect(getProviderProofContract(service).liveIdentityConfidence).toBe("none");
    }
  });

  it("keeps label-only exact proof artifacts ambiguous even with every required label", () => {
    const result = evaluateProviderExactIdentityProof("vercel", [
      {
        service: "vercel",
        environment: "preview",
        commandKind: "env.list",
        status: "success",
        exitCode: 0,
        durationMs: 5,
        stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
        stderrSummary: "",
        stdoutLines: 1,
        stderrLines: 0,
        stdoutBytes: 42,
        stderrBytes: 0,
        outputRedacted: true,
        liveIdentityFacts: {
          identityConfidence: "partial",
          facts: ["env-list-read"]
        },
        exactIdentityProof: {
          kind: "provider-exact-identity-proof",
          evaluator: "provider-specific-identity-parser",
          labels: [
            "provider-specific-identity-parser",
            "stable-provider-identity",
            "ledger-comparable-identity",
            "manifest-resource-name-match",
            "ledger-external-id-match",
            "provider-environment-scope",
            "provider-owner-identity",
            "provider-resource-id",
            "provider-environment-scope",
            "provider-project-link-proof"
          ]
        }
      }
    ]);

    expect(result).toEqual({
      proof: "ambiguous",
      evaluator: "provider-exact-identity",
      labels: [
        "ledger-comparable-identity",
        "ledger-external-id-match",
        "manifest-resource-name-match",
        "provider-environment-scope",
        "provider-owner-identity",
        "provider-project-link-proof",
        "provider-resource-id",
        "provider-specific-identity-parser",
        "stable-provider-identity"
      ],
      missing: [
        "stable-provider-identity",
        "ledger-comparable-identity",
        "manifest-resource-name-match",
        "ledger-external-id-match",
        "provider-owner-identity",
        "provider-resource-id",
        "provider-environment-scope",
        "provider-project-link-proof"
      ]
    });
  });

  it("returns exact identity only from sanitized exact proof artifacts with every required label and matched comparison", () => {
    const result = evaluateProviderExactIdentityProof("vercel", [
      {
        service: "vercel",
        environment: "preview",
        commandKind: "env.list",
        status: "success",
        exitCode: 0,
        durationMs: 5,
        stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
        stderrSummary: "",
        stdoutLines: 1,
        stderrLines: 0,
        stdoutBytes: 42,
        stderrBytes: 0,
        outputRedacted: true,
        liveIdentityFacts: {
          identityConfidence: "partial",
          facts: ["env-list-read"]
        },
        exactIdentityProof: {
          kind: "provider-exact-identity-proof",
          evaluator: "provider-specific-identity-parser",
          labels: [
            "provider-specific-identity-parser",
            "stable-provider-identity",
            "ledger-comparable-identity",
            "manifest-resource-name-match",
            "ledger-external-id-match",
            "provider-owner-identity",
            "provider-resource-id",
            "provider-environment-scope",
            "provider-project-link-proof"
          ],
          comparisons: [
            { label: "stable-provider-identity", outcome: "matched" },
            { label: "ledger-comparable-identity", outcome: "matched" },
            { label: "manifest-resource-name-match", outcome: "matched" },
            { label: "ledger-external-id-match", outcome: "matched" },
            { label: "provider-environment-scope", outcome: "matched" },
            { label: "provider-owner-identity", outcome: "matched" },
            { label: "provider-resource-id", outcome: "matched" },
            { label: "provider-environment-scope", outcome: "matched" },
            { label: "provider-project-link-proof", outcome: "matched" }
          ]
        }
      }
    ]);

    expect(result).toEqual({
      proof: "exact",
      evaluator: "provider-exact-identity",
      labels: [
        "ledger-comparable-identity",
        "ledger-external-id-match",
        "manifest-resource-name-match",
        "provider-environment-scope",
        "provider-owner-identity",
        "provider-project-link-proof",
        "provider-resource-id",
        "provider-specific-identity-parser",
        "stable-provider-identity"
      ],
      missing: []
    });
  });

  it("returns exact Vercel identity from provider-owned project JSON proof but still leaves drift proof unavailable", () => {
    const readResults: ProviderExecutionResult[] = [
      {
        service: "vercel",
        environment: "preview",
        commandKind: "env.list",
        status: "success",
        exitCode: 0,
        durationMs: 5,
        stdoutSummary: "<redacted provider stdout: 2 lines, 90 bytes>",
        stderrSummary: "",
        stdoutLines: 2,
        stderrLines: 0,
        stdoutBytes: 90,
        stderrBytes: 0,
        outputRedacted: true
      },
      {
        service: "vercel",
        environment: "preview",
        commandKind: "project.list",
        status: "success",
        exitCode: 0,
        durationMs: 5,
        stdoutSummary: "<redacted provider stdout: 1 line, 100 bytes>",
        stderrSummary: "",
        stdoutLines: 1,
        stderrLines: 0,
        stdoutBytes: 100,
        stderrBytes: 0,
        outputRedacted: true,
        exactIdentityProof: {
          kind: "provider-exact-identity-proof",
          evaluator: "provider-specific-identity-parser",
          labels: [
            "provider-specific-identity-parser",
            "stable-provider-identity",
            "ledger-comparable-identity",
            "manifest-resource-name-match",
            "ledger-external-id-match",
            "provider-environment-scope",
            "provider-owner-identity",
            "provider-resource-id",
            "provider-project-link-proof"
          ],
          comparisons: [
            { label: "stable-provider-identity", outcome: "matched" },
            { label: "ledger-comparable-identity", outcome: "matched" },
            { label: "manifest-resource-name-match", outcome: "matched" },
            { label: "ledger-external-id-match", outcome: "matched" },
            { label: "provider-environment-scope", outcome: "matched" },
            { label: "provider-owner-identity", outcome: "matched" },
            { label: "provider-resource-id", outcome: "matched" },
            { label: "provider-project-link-proof", outcome: "matched" }
          ]
        }
      }
    ];

    expect(evaluateProviderExactIdentityProof("vercel", readResults)).toEqual({
      proof: "exact",
      evaluator: "provider-exact-identity",
      labels: [
        "ledger-comparable-identity",
        "ledger-external-id-match",
        "manifest-resource-name-match",
        "provider-environment-scope",
        "provider-owner-identity",
        "provider-project-link-proof",
        "provider-resource-id",
        "provider-specific-identity-parser",
        "stable-provider-identity"
      ],
      missing: []
    });
    expect(evaluateProviderDriftProof("vercel", readResults)).toEqual({ proof: "unavailable" });
  });

  it("blocks live coherence when exact identity only has partial drift evidence", () => {
    const exactIdentity = {
      proof: "exact",
      evaluator: "provider-exact-identity",
      labels: [
        "ledger-comparable-identity",
        "ledger-external-id-match",
        "manifest-resource-name-match",
        "provider-environment-scope",
        "provider-owner-identity",
        "provider-project-link-proof",
        "provider-resource-id",
        "provider-specific-identity-parser",
        "stable-provider-identity"
      ],
      missing: []
    } satisfies ReturnType<typeof evaluateProviderExactIdentityProof>;
    const driftProof = {
      proof: "partial",
      evaluator: "env-list-preview",
      evidence: ["env-list-read", "expected-env-names", "preview-environment"]
    } satisfies ReturnType<typeof evaluateProviderDriftProof>;

    expect(evaluateProviderLiveCoherenceProof("vercel", exactIdentity, driftProof)).toEqual({
      proof: "blocked",
      evaluator: "provider-live-coherence",
      blockers: [
        "provider-specific-drift-parser",
        "expected-resource-shape",
        "env-drift-comparison",
        "provider-environment-scope"
      ]
    });
  });

  it("fail-closes blocked live coherence with a sanitized blocker when partial drift overlaps every current requirement", () => {
    const exactIdentity = {
      proof: "exact",
      evaluator: "provider-exact-identity",
      labels: [
        "ledger-comparable-identity",
        "ledger-external-id-match",
        "manifest-resource-name-match",
        "provider-environment-scope",
        "provider-owner-identity",
        "provider-project-link-proof",
        "provider-resource-id",
        "provider-specific-identity-parser",
        "stable-provider-identity"
      ],
      missing: []
    } satisfies ReturnType<typeof evaluateProviderExactIdentityProof>;
    const driftProof = {
      proof: "partial",
      evaluator: "env-list-preview",
      evidence: getProviderProofContract("vercel").driftProofRequirements
    } as ReturnType<typeof evaluateProviderDriftProof>;

    const liveCoherence = evaluateProviderLiveCoherenceProof("vercel", exactIdentity, driftProof);

    expect(liveCoherence).toEqual({
      proof: "blocked",
      evaluator: "provider-live-coherence",
      blockers: ["env-drift-comparison"]
    });
  });

  it("blocks live coherence on missing exact identity with sanitized identity blockers", () => {
    const exactIdentity = {
      proof: "ambiguous",
      evaluator: "provider-exact-identity",
      labels: ["provider-specific-identity-parser"],
      missing: ["stable-provider-identity", "ledger-comparable-identity", "provider-resource-id"]
    } satisfies ReturnType<typeof evaluateProviderExactIdentityProof>;

    expect(evaluateProviderLiveCoherenceProof("clerk", exactIdentity, { proof: "unavailable" })).toEqual({
      proof: "blocked",
      evaluator: "provider-live-coherence",
      blockers: ["stable-provider-identity", "ledger-comparable-identity", "provider-resource-id"]
    });
  });

  it("keeps live coherence unavailable when provider reads fail", () => {
    const exactIdentity = {
      proof: "unavailable",
      evaluator: "unavailable",
      labels: [],
      missing: getProviderIdentityReadPlan("eas").missingUntilParsersExist
    } satisfies ReturnType<typeof evaluateProviderExactIdentityProof>;

    expect(evaluateProviderLiveCoherenceProof("eas", exactIdentity, { proof: "unavailable" })).toEqual({
      proof: "unavailable",
      evaluator: "unavailable",
      blockers: getProviderIdentityReadPlan("eas").missingUntilParsersExist
    });
  });

  it("never upgrades partial drift into exact live coherence", () => {
    const readResults: ProviderExecutionResult[] = [
      {
        service: "vercel",
        environment: "preview",
        commandKind: "env.list",
        status: "success",
        exitCode: 0,
        durationMs: 5,
        stdoutSummary: "<redacted provider stdout: 2 lines, 90 bytes>",
        stderrSummary: "",
        stdoutLines: 2,
        stderrLines: 0,
        stdoutBytes: 90,
        stderrBytes: 0,
        outputRedacted: true,
        liveIdentityFacts: {
          identityConfidence: "partial",
          facts: ["env-list-read", "expected-env-names", "preview-environment"]
        }
      }
    ];

    const liveCoherence = evaluateProviderLiveCoherenceProof(
      "vercel",
      evaluateProviderExactIdentityProof("vercel", readResults),
      evaluateProviderDriftProof("vercel", readResults)
    );

    expect(liveCoherence.proof).toBe("unavailable");
    expect(JSON.stringify(liveCoherence)).not.toContain("exact");
  });

  it("returns exact identity for Clerk from required labels and matched comparisons", () => {
    const result = evaluateProviderExactIdentityProof("clerk", [
      {
        service: "clerk",
        environment: "preview",
        commandKind: "auth.apps.list",
        status: "success",
        exitCode: 0,
        durationMs: 5,
        stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
        stderrSummary: "",
        stdoutLines: 1,
        stderrLines: 0,
        stdoutBytes: 42,
        stderrBytes: 0,
        outputRedacted: true,
        exactIdentityProof: {
          kind: "provider-exact-identity-proof",
          evaluator: "provider-specific-identity-parser",
          labels: [
            "provider-specific-identity-parser",
            "stable-provider-identity",
            "ledger-comparable-identity",
            "manifest-resource-name-match",
            "ledger-external-id-match",
            "provider-owner-identity",
            "provider-resource-id",
            "provider-environment-scope"
          ],
          comparisons: [
            { label: "stable-provider-identity", outcome: "matched" },
            { label: "ledger-comparable-identity", outcome: "matched" },
            { label: "manifest-resource-name-match", outcome: "matched" },
            { label: "ledger-external-id-match", outcome: "matched" },
            { label: "provider-owner-identity", outcome: "matched" },
            { label: "provider-resource-id", outcome: "matched" },
            { label: "provider-environment-scope", outcome: "matched" }
          ]
        }
      }
    ]);

    expect(result).toEqual({
      proof: "exact",
      evaluator: "provider-exact-identity",
      labels: [
        "ledger-comparable-identity",
        "ledger-external-id-match",
        "manifest-resource-name-match",
        "provider-environment-scope",
        "provider-owner-identity",
        "provider-resource-id",
        "provider-specific-identity-parser",
        "stable-provider-identity"
      ],
      missing: []
    });
  });

  it("keeps partial live facts ambiguous when no exact proof artifact exists", () => {
    expect(
      evaluateProviderExactIdentityProof("vercel", [
        {
          service: "vercel",
          environment: "preview",
          commandKind: "env.list",
          status: "success",
          exitCode: 0,
          durationMs: 5,
          stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
          stderrSummary: "",
          stdoutLines: 1,
          stderrLines: 0,
          stdoutBytes: 42,
          stderrBytes: 0,
          outputRedacted: true,
          liveIdentityFacts: {
            identityConfidence: "partial",
            facts: ["env-list-read", "expected-env-names", "preview-environment"]
          }
        }
      ])
    ).toEqual({
      proof: "unavailable",
      evaluator: "unavailable",
      labels: [],
      missing: getProviderIdentityReadPlan("vercel").missingUntilParsersExist
    });
  });

  it("aggregates sanitized identity candidate labels from successful matching-provider reads only", () => {
    const result = evaluateProviderIdentityCandidateProof("clerk", [
      {
        service: "clerk",
        environment: "preview",
        commandKind: "auth.apps.list",
        status: "success",
        exitCode: 0,
        durationMs: 5,
        stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
        stderrSummary: "",
        stdoutLines: 1,
        stderrLines: 0,
        stdoutBytes: 42,
        stderrBytes: 0,
        outputRedacted: true,
        identityCandidates: {
          kind: "provider-identity-candidates",
          evaluator: "provider-specific-identity-candidate-parser",
          labels: ["provider-resource-id", "stable-provider-identity", "provider-owner-identity"]
        }
      },
      {
        service: "vercel",
        environment: "preview",
        commandKind: "env.list",
        status: "success",
        exitCode: 0,
        durationMs: 5,
        stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
        stderrSummary: "",
        stdoutLines: 1,
        stderrLines: 0,
        stdoutBytes: 42,
        stderrBytes: 0,
        outputRedacted: true,
        identityCandidates: {
          kind: "provider-identity-candidates",
          evaluator: "provider-specific-identity-candidate-parser",
          labels: ["provider-environment-scope"]
        }
      }
    ]);

    expect(result).toEqual({
      proof: "ambiguous",
      evaluator: "provider-specific-identity-candidate-parser",
      labels: ["provider-owner-identity", "provider-resource-id", "stable-provider-identity"],
      missing: [
        "provider-specific-identity-parser",
        "ledger-comparable-identity",
        "manifest-resource-name-match",
        "ledger-external-id-match",
        "provider-environment-scope"
      ]
    });
    expect(JSON.stringify(result)).not.toContain("exact");
  });

  it("keeps provider-resource-id missing when Clerk candidates only prove stable owner environment labels", () => {
    const result = evaluateProviderIdentityCandidateProof("clerk", [
      {
        service: "clerk",
        environment: "preview",
        commandKind: "auth.apps.list",
        status: "success",
        exitCode: 0,
        durationMs: 5,
        stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
        stderrSummary: "",
        stdoutLines: 1,
        stderrLines: 0,
        stdoutBytes: 42,
        stderrBytes: 0,
        outputRedacted: true,
        identityCandidates: {
          kind: "provider-identity-candidates",
          evaluator: "provider-specific-identity-candidate-parser",
          labels: ["stable-provider-identity", "provider-owner-identity", "provider-environment-scope"]
        }
      }
    ]);

    expect(result).toEqual({
      proof: "ambiguous",
      evaluator: "provider-specific-identity-candidate-parser",
      labels: ["provider-environment-scope", "provider-owner-identity", "stable-provider-identity"],
      missing: [
        "provider-specific-identity-parser",
        "ledger-comparable-identity",
        "manifest-resource-name-match",
        "ledger-external-id-match",
        "provider-resource-id"
      ]
    });
  });

  it("uses Vercel candidates to remove only project-link and environment-scope missing labels", () => {
    const result = evaluateProviderIdentityCandidateProof("vercel", [
      {
        service: "vercel",
        environment: "preview",
        commandKind: "env.list",
        status: "success",
        exitCode: 0,
        durationMs: 5,
        stdoutSummary: "<redacted provider stdout: 2 lines, 90 bytes>",
        stderrSummary: "",
        stdoutLines: 2,
        stderrLines: 0,
        stdoutBytes: 90,
        stderrBytes: 0,
        outputRedacted: true,
        identityCandidates: {
          kind: "provider-identity-candidates",
          evaluator: "provider-specific-identity-candidate-parser",
          labels: ["provider-environment-scope", "provider-project-link-proof"]
        }
      }
    ]);

    expect(result).toEqual({
      proof: "ambiguous",
      evaluator: "provider-specific-identity-candidate-parser",
      labels: ["provider-environment-scope", "provider-project-link-proof"],
      missing: [
        "provider-specific-identity-parser",
        "stable-provider-identity",
        "ledger-comparable-identity",
        "manifest-resource-name-match",
        "ledger-external-id-match",
        "provider-owner-identity",
        "provider-resource-id"
      ]
    });
    expect(result.missing).not.toContain("provider-project-link-proof");
    expect(result.missing).not.toContain("provider-environment-scope");
  });

  it("uses Convex candidates to remove only environment-scope missing labels", () => {
    const result = evaluateProviderIdentityCandidateProof("convex", [
      {
        service: "convex",
        environment: "preview",
        commandKind: "env.list",
        status: "success",
        exitCode: 0,
        durationMs: 5,
        stdoutSummary: "<redacted provider stdout: 2 lines, 90 bytes>",
        stderrSummary: "",
        stdoutLines: 2,
        stderrLines: 0,
        stdoutBytes: 90,
        stderrBytes: 0,
        outputRedacted: true,
        identityCandidates: {
          kind: "provider-identity-candidates",
          evaluator: "provider-specific-identity-candidate-parser",
          labels: ["provider-environment-scope"]
        }
      }
    ]);

    expect(result).toEqual({
      proof: "ambiguous",
      evaluator: "provider-specific-identity-candidate-parser",
      labels: ["provider-environment-scope"],
      missing: [
        "provider-specific-identity-parser",
        "stable-provider-identity",
        "ledger-comparable-identity",
        "manifest-resource-name-match",
        "ledger-external-id-match",
        "provider-owner-identity",
        "provider-resource-id"
      ]
    });
    expect(result.missing).not.toContain("provider-environment-scope");
    expect(result.missing).not.toContain("provider-project-link-proof");
    expect(JSON.stringify(result)).not.toContain("exact");
  });

  it("uses EAS candidates to remove only environment-scope missing labels", () => {
    const result = evaluateProviderIdentityCandidateProof("eas", [
      {
        service: "eas",
        environment: "preview",
        commandKind: "mobile.env.list",
        status: "success",
        exitCode: 0,
        durationMs: 5,
        stdoutSummary: "<redacted provider stdout: 2 lines, 90 bytes>",
        stderrSummary: "",
        stdoutLines: 2,
        stderrLines: 0,
        stdoutBytes: 90,
        stderrBytes: 0,
        outputRedacted: true,
        identityCandidates: {
          kind: "provider-identity-candidates",
          evaluator: "provider-specific-identity-candidate-parser",
          labels: ["provider-environment-scope"]
        }
      }
    ]);

    expect(result).toEqual({
      proof: "ambiguous",
      evaluator: "provider-specific-identity-candidate-parser",
      labels: ["provider-environment-scope"],
      missing: [
        "provider-specific-identity-parser",
        "stable-provider-identity",
        "ledger-comparable-identity",
        "manifest-resource-name-match",
        "ledger-external-id-match",
        "provider-owner-identity",
        "provider-resource-id",
        "provider-project-link-proof"
      ]
    });
    expect(result.missing).not.toContain("provider-environment-scope");
    expect(result.missing).toContain("provider-project-link-proof");
    expect(JSON.stringify(result)).not.toContain("exact");
  });

  it("keeps identity candidates unavailable for failed or empty read results", () => {
    expect(evaluateProviderIdentityCandidateProof("clerk", [])).toEqual({
      proof: "unavailable",
      evaluator: "unavailable",
      labels: [],
      missing: getProviderIdentityReadPlan("clerk").missingUntilParsersExist
    });
    expect(
      evaluateProviderIdentityCandidateProof("clerk", [
        {
          service: "clerk",
          environment: "preview",
          commandKind: "auth.apps.list",
          status: "failed",
          exitCode: 1,
          durationMs: 5,
          stdoutSummary: "",
          stderrSummary: "<redacted provider stderr: 1 line, 11 bytes>",
          stdoutLines: 0,
          stderrLines: 1,
          stdoutBytes: 0,
          stderrBytes: 11,
          outputRedacted: true,
          failureClass: "auth",
          identityCandidates: {
            kind: "provider-identity-candidates",
            evaluator: "provider-specific-identity-candidate-parser",
            labels: ["stable-provider-identity"]
          }
        }
      ])
    ).toEqual({
      proof: "unavailable",
      evaluator: "unavailable",
      labels: [],
      missing: getProviderIdentityReadPlan("clerk").missingUntilParsersExist
    });
  });

  it("does not let identity candidate artifacts make exact identity proof exact", () => {
    const readResults = [
      {
        service: "clerk",
        environment: "preview",
        commandKind: "auth.apps.list",
        status: "success",
        exitCode: 0,
        durationMs: 5,
        stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
        stderrSummary: "",
        stdoutLines: 1,
        stderrLines: 0,
        stdoutBytes: 42,
        stderrBytes: 0,
        outputRedacted: true,
        identityCandidates: {
          kind: "provider-identity-candidates",
          evaluator: "provider-specific-identity-candidate-parser",
          labels: [
            "stable-provider-identity",
            "provider-owner-identity",
            "provider-resource-id",
            "provider-environment-scope"
          ]
        }
      }
    ] as const;

    expect(evaluateProviderIdentityCandidateProof("clerk", readResults).proof).toBe("ambiguous");
    expect(evaluateProviderExactIdentityProof("clerk", readResults)).toEqual({
      proof: "unavailable",
      evaluator: "unavailable",
      labels: [],
      missing: getProviderIdentityReadPlan("clerk").missingUntilParsersExist
    });
  });

  it("keeps exact-looking artifacts unavailable when any live read failed", () => {
    expect(
      evaluateProviderExactIdentityProof("clerk", [
        {
          service: "clerk",
          environment: "preview",
          commandKind: "config.pull",
          status: "failed",
          exitCode: 1,
          durationMs: 5,
          stdoutSummary: "",
          stderrSummary: "<redacted provider stderr: 1 line, 42 bytes>",
          stdoutLines: 0,
          stderrLines: 1,
          stdoutBytes: 0,
          stderrBytes: 42,
          outputRedacted: true,
          failureClass: "auth",
          exactIdentityProof: {
            kind: "provider-exact-identity-proof",
            evaluator: "provider-specific-identity-parser",
            labels: ["provider-specific-identity-parser", "stable-provider-identity"]
          }
        }
      ])
    ).toEqual({
      proof: "unavailable",
      evaluator: "unavailable",
      labels: [],
      missing: getProviderIdentityReadPlan("clerk").missingUntilParsersExist
    });
  });

  it("blocks exact identity when parser evidence or service-required labels are missing", () => {
    expect(
      evaluateProviderExactIdentityProof("eas", [
        {
          service: "eas",
          environment: "preview",
          commandKind: "mobile.env.list",
          status: "success",
          exitCode: 0,
          durationMs: 5,
          stdoutSummary: "<redacted provider stdout: 1 line, 42 bytes>",
          stderrSummary: "",
          stdoutLines: 1,
          stderrLines: 0,
          stdoutBytes: 42,
          stderrBytes: 0,
          outputRedacted: true,
          exactIdentityProof: {
            kind: "provider-exact-identity-proof",
            evaluator: "provider-specific-identity-parser",
            labels: ["stable-provider-identity", "ledger-comparable-identity"]
          }
        }
      ])
    ).toEqual({
      proof: "ambiguous",
      evaluator: "provider-exact-identity",
      labels: ["ledger-comparable-identity", "stable-provider-identity"],
      missing: [
        "provider-specific-identity-parser",
        "manifest-resource-name-match",
        "ledger-external-id-match",
        "provider-owner-identity",
        "provider-resource-id",
        "provider-project-link-proof",
        "provider-environment-scope",
        "stable-provider-identity",
        "ledger-comparable-identity"
      ]
    });
  });

  it("returns partial sanitized drift evidence for Vercel and EAS preview env-list facts", () => {
    for (const service of ["vercel", "eas"] as const) {
      expect(
        evaluateProviderDriftProof(service, [
          {
            service,
            environment: "preview",
            commandKind: service === "vercel" ? "env.list" : "mobile.env.list",
            status: "success",
            exitCode: 0,
            durationMs: 5,
            stdoutSummary: "<redacted provider stdout: 2 lines, 120 bytes>",
            stderrSummary: "",
            stdoutLines: 2,
            stderrLines: 0,
            stdoutBytes: 120,
            stderrBytes: 0,
            outputRedacted: true,
            liveIdentityFacts: {
              identityConfidence: "partial",
              facts: ["expected-env-names", "preview-environment", "env-list-read"]
            }
          }
        ])
      ).toEqual({
        proof: "partial",
        evaluator: "env-list-preview",
        evidence: ["env-list-read", "expected-env-names", "preview-environment"]
      });
    }
  });

  it("returns partial sanitized drift evidence for Clerk preview apps-list exact live coherence", () => {
    expect(
      evaluateProviderDriftProof("clerk", [
        {
          service: "clerk",
          environment: "preview",
          commandKind: "auth.apps.list",
          status: "success",
          exitCode: 0,
          durationMs: 5,
          stdoutSummary: "<redacted provider stdout: 1 lines, 180 bytes>",
          stderrSummary: "",
          stdoutLines: 1,
          stderrLines: 0,
          stdoutBytes: 180,
          stderrBytes: 0,
          outputRedacted: true,
          liveIdentityFacts: {
            identityConfidence: "partial",
            facts: ["apps-list-read", "expected-resource-shape", "preview-environment"]
          },
          exactIdentityProof: {
            kind: "provider-exact-identity-proof",
            evaluator: "provider-specific-identity-parser",
            labels: [
              "ledger-comparable-identity",
              "ledger-external-id-match",
              "manifest-resource-name-match",
              "provider-environment-scope",
              "provider-owner-identity",
              "provider-resource-id",
              "provider-specific-identity-parser",
              "stable-provider-identity"
            ],
            comparisons: [
              { label: "stable-provider-identity", outcome: "matched" },
              { label: "ledger-comparable-identity", outcome: "matched" },
              { label: "manifest-resource-name-match", outcome: "matched" },
              { label: "ledger-external-id-match", outcome: "matched" },
              { label: "provider-owner-identity", outcome: "matched" },
              { label: "provider-resource-id", outcome: "matched" },
              { label: "provider-environment-scope", outcome: "matched" }
            ]
          }
        }
      ])
    ).toEqual({
      proof: "partial",
      evaluator: "clerk-apps-list-preview",
      evidence: ["apps-list-read", "expected-resource-shape", "preview-environment"]
    });
  });

  it("returns partial sanitized drift evidence for Clerk preview config/env coherence only with exact apps-list identity", () => {
    const exactAppsListResult = {
      service: "clerk",
      environment: "preview",
      commandKind: "auth.apps.list",
      status: "success",
      exitCode: 0,
      durationMs: 5,
      stdoutSummary: "<redacted provider stdout: 1 lines, 180 bytes>",
      stderrSummary: "",
      stdoutLines: 1,
      stderrLines: 0,
      stdoutBytes: 180,
      stderrBytes: 0,
      outputRedacted: true,
      liveIdentityFacts: {
        identityConfidence: "partial",
        facts: ["apps-list-read", "expected-resource-shape", "preview-environment"]
      },
      exactIdentityProof: {
        kind: "provider-exact-identity-proof",
        evaluator: "provider-specific-identity-parser",
        labels: [
          "ledger-comparable-identity",
          "ledger-external-id-match",
          "manifest-resource-name-match",
          "provider-environment-scope",
          "provider-owner-identity",
          "provider-resource-id",
          "provider-specific-identity-parser",
          "stable-provider-identity"
        ],
        comparisons: [
          { label: "stable-provider-identity", outcome: "matched" },
          { label: "ledger-comparable-identity", outcome: "matched" },
          { label: "manifest-resource-name-match", outcome: "matched" },
          { label: "ledger-external-id-match", outcome: "matched" },
          { label: "provider-owner-identity", outcome: "matched" },
          { label: "provider-resource-id", outcome: "matched" },
          { label: "provider-environment-scope", outcome: "matched" }
        ]
      }
    } satisfies Parameters<typeof evaluateProviderDriftProof>[1][number];
    const envResult = {
      service: "clerk",
      environment: "preview",
      commandKind: "auth.env.pull",
      status: "success",
      exitCode: 0,
      durationMs: 5,
      stdoutSummary: "<redacted provider stdout: 1 lines, 140 bytes>",
      stderrSummary: "",
      stdoutLines: 1,
      stderrLines: 0,
      stdoutBytes: 140,
      stderrBytes: 0,
      outputRedacted: true,
      liveIdentityFacts: {
        identityConfidence: "partial",
        facts: ["clerk-env-key-presence", "provider-env-read", "preview-environment"]
      }
    } satisfies Parameters<typeof evaluateProviderDriftProof>[1][number];
    const configResult = {
      service: "clerk",
      environment: "preview",
      commandKind: "auth.config.pull",
      status: "success",
      exitCode: 0,
      durationMs: 5,
      stdoutSummary: "<redacted provider stdout: 1 lines, 260 bytes>",
      stderrSummary: "",
      stdoutLines: 1,
      stderrLines: 0,
      stdoutBytes: 260,
      stderrBytes: 0,
      outputRedacted: true,
      liveIdentityFacts: {
        identityConfidence: "partial",
        facts: [
          "clerk-billing-config-present",
          "clerk-organization-config-present",
          "clerk-redirect-config-present",
          "clerk-webhook-config-present",
          "provider-config-read",
          "preview-environment"
        ]
      }
    } satisfies Parameters<typeof evaluateProviderDriftProof>[1][number];

    expect(evaluateProviderDriftProof("clerk", [envResult, configResult, exactAppsListResult])).toEqual({
      proof: "partial",
      evaluator: "clerk-config-preview",
      evidence: [
        "apps-list-read",
        "clerk-billing-config-present",
        "clerk-env-key-presence",
        "clerk-organization-config-present",
        "clerk-redirect-config-present",
        "clerk-webhook-config-present",
        "expected-resource-shape",
        "preview-environment",
        "provider-config-read",
        "provider-env-read"
      ]
    });

    expect(evaluateProviderDriftProof("clerk", [envResult, configResult])).toEqual({ proof: "unavailable" });
  });

  it("keeps Clerk drift proof unavailable without strict exact apps-list live coherence", () => {
    const baseResult = {
      service: "clerk",
      environment: "preview",
      commandKind: "auth.apps.list",
      status: "success",
      exitCode: 0,
      durationMs: 5,
      stdoutSummary: "<redacted provider stdout: 1 lines, 180 bytes>",
      stderrSummary: "",
      stdoutLines: 1,
      stderrLines: 0,
      stdoutBytes: 180,
      stderrBytes: 0,
      outputRedacted: true,
      liveIdentityFacts: {
        identityConfidence: "partial",
        facts: ["apps-list-read", "expected-resource-shape", "preview-environment"]
      },
      exactIdentityProof: {
        kind: "provider-exact-identity-proof",
        evaluator: "provider-specific-identity-parser",
        labels: [
          "ledger-comparable-identity",
          "ledger-external-id-match",
          "manifest-resource-name-match",
          "provider-environment-scope",
          "provider-owner-identity",
          "provider-resource-id",
          "provider-specific-identity-parser",
          "stable-provider-identity"
        ],
        comparisons: [
          { label: "stable-provider-identity", outcome: "matched" },
          { label: "ledger-comparable-identity", outcome: "matched" },
          { label: "manifest-resource-name-match", outcome: "matched" },
          { label: "ledger-external-id-match", outcome: "matched" },
          { label: "provider-owner-identity", outcome: "matched" },
          { label: "provider-resource-id", outcome: "matched" },
          { label: "provider-environment-scope", outcome: "matched" }
        ]
      }
    } satisfies Parameters<typeof evaluateProviderDriftProof>[1][number];

    expect(evaluateProviderDriftProof("clerk", [{ ...baseResult, exactIdentityProof: undefined }])).toEqual({
      proof: "unavailable"
    });
    expect(evaluateProviderDriftProof("clerk", [{ ...baseResult, environment: "production" }])).toEqual({
      proof: "unavailable"
    });
    expect(evaluateProviderDriftProof("clerk", [{ ...baseResult, status: "failed", exitCode: 1 }])).toEqual({
      proof: "unavailable"
    });
    expect(
      evaluateProviderDriftProof("clerk", [
        baseResult,
        {
          ...baseResult,
          status: "failed",
          exitCode: 1,
          liveIdentityFacts: undefined,
          exactIdentityProof: undefined
        }
      ])
    ).toEqual({ proof: "unavailable" });
    expect(evaluateProviderDriftProof("clerk", [{ ...baseResult, outputRedacted: false }])).toEqual({
      proof: "unavailable"
    });
    expect(
      evaluateProviderDriftProof("clerk", [
        {
          ...baseResult,
          liveIdentityFacts: {
            identityConfidence: "partial",
            facts: ["apps-list-read", "preview-environment"]
          }
        }
      ])
    ).toEqual({ proof: "unavailable" });
    expect(
      evaluateProviderDriftProof("clerk", [
        {
          ...baseResult,
          exactIdentityProof: {
            ...baseResult.exactIdentityProof,
            comparisons: [
              { label: "stable-provider-identity", outcome: "matched" },
              { label: "ledger-comparable-identity", outcome: "matched" }
            ]
          }
        }
      ])
    ).toEqual({ proof: "unavailable" });
  });

  it("keeps drift proof unavailable when facts are incomplete or provider is unsupported", () => {
    const baseResult = {
      service: "vercel",
      environment: "preview",
      commandKind: "env.list",
      status: "success",
      exitCode: 0,
      durationMs: 5,
      stdoutSummary: "PUBLIC_API_URL https://secret.example.test",
      stderrSummary: "raw stderr",
      stdoutLines: 1,
      stderrLines: 1,
      stdoutBytes: 40,
      stderrBytes: 10,
      outputRedacted: true
    } as const;

    expect(evaluateProviderDriftProof("vercel", [baseResult])).toEqual({ proof: "unavailable" });
    expect(
      evaluateProviderDriftProof("vercel", [
        {
          ...baseResult,
          liveIdentityFacts: {
            identityConfidence: "partial",
            facts: ["expected-env-names", "env-list-read"]
          }
        }
      ])
    ).toEqual({ proof: "unavailable" });
    expect(
      evaluateProviderDriftProof("clerk", [
        {
          ...baseResult,
          service: "clerk",
          commandKind: "env.list",
          liveIdentityFacts: {
            identityConfidence: "partial",
            facts: ["expected-env-names", "preview-environment", "env-list-read"]
          }
        }
      ])
    ).toEqual({ proof: "unavailable" });
    expect(evaluateProviderDriftProof("convex", [])).toEqual({ proof: "unavailable" });
  });

  it("keeps drift proof unavailable for non-env-list results with env-list-like facts", () => {
    for (const service of ["vercel", "eas"] as const) {
      expect(
        evaluateProviderDriftProof(service, [
          {
            service,
            environment: "preview",
            commandKind: service === "vercel" ? "web.deploy" : "mobile.build",
            status: "success",
            exitCode: 0,
            durationMs: 5,
            stdoutSummary: "<redacted provider stdout: 2 lines, 120 bytes>",
            stderrSummary: "",
            stdoutLines: 2,
            stderrLines: 0,
            stdoutBytes: 120,
            stderrBytes: 0,
            outputRedacted: true,
            liveIdentityFacts: {
              identityConfidence: "partial",
              facts: ["expected-env-names", "preview-environment", "env-list-read"]
            }
          }
        ])
      ).toEqual({ proof: "unavailable" });
    }
  });

  it("keeps drift proof unavailable for unredacted or non-partial env-list facts", () => {
    const baseResult = {
      service: "vercel",
      environment: "preview",
      commandKind: "env.list",
      status: "success",
      exitCode: 0,
      durationMs: 5,
      stdoutSummary: "<redacted provider stdout: 2 lines, 120 bytes>",
      stderrSummary: "",
      stdoutLines: 2,
      stderrLines: 0,
      stdoutBytes: 120,
      stderrBytes: 0,
      outputRedacted: true,
      liveIdentityFacts: {
        identityConfidence: "partial",
        facts: ["expected-env-names", "preview-environment", "env-list-read"]
      }
    } satisfies Parameters<typeof evaluateProviderDriftProof>[1][number];

    expect(evaluateProviderDriftProof("vercel", [{ ...baseResult, outputRedacted: false }])).toEqual({
      proof: "unavailable"
    });
    expect(
      evaluateProviderDriftProof("vercel", [
        {
          ...baseResult,
          liveIdentityFacts: {
            identityConfidence: "none",
            facts: ["expected-env-names", "preview-environment", "env-list-read"]
          }
        }
      ])
    ).toEqual({ proof: "unavailable" });
  });
});
