import { describe, expect, it } from "vitest";
import {
  evaluateProviderDriftProof,
  getProviderProofContract,
  providerProofServices,
  type ProviderProofRequirementLabel
} from "./provider-proof-contracts.js";

const sanitizedLabelPattern = /^[a-z][a-z0-9-]*$/;

describe("provider proof contracts", () => {
  it("keeps exact live identity unavailable for every provider", () => {
    for (const service of providerProofServices) {
      const contract = getProviderProofContract(service);

      expect(contract.service).toBe(service);
      expect(contract.liveIdentityConfidence).toBe("none");
      expect(contract.exactIdentityAvailable).toBe(false);
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
