import { describe, expect, it } from "vitest";
import {
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
});
