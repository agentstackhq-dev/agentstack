import { createDefaultManifest } from "@agentstack/core";
import { describe, expect, it } from "vitest";

import {
  createProviderOperationPlan,
  getEnabledProviderAdapterDefinitions,
  providerAdapterDefinitions
} from "./provider-operations.js";

const report = {
  environment: "preview" as const,
  expected: [],
  linked: [],
  missing: [{ environment: "preview" as const, service: "convex", linked: true, env: {} }],
  stale: [{ environment: "preview" as const, service: "legacy", linked: true, env: {} }],
  expectedEnv: [],
  syncedEnv: [],
  missingEnv: [
    {
      environment: "preview" as const,
      service: "vercel",
      surface: "web" as const,
      kind: "envVar" as const,
      name: "STRIPE_MODE",
      required: true,
      secret: false,
      valueHash: "hash",
      rawValue: "raw-secret",
      synced: false
    },
    {
      environment: "preview" as const,
      service: "clerk",
      surface: "web" as const,
      kind: "envVar" as const,
      name: "CLERK_WEBHOOK_SECRET",
      required: true,
      secret: true,
      synced: false
    }
  ],
  staleEnv: [
    {
      environment: "preview" as const,
      service: "convex",
      surface: "convex" as const,
      kind: "envVar" as const,
      name: "LEGACY_FLAG",
      required: false,
      secret: false,
      valueHash: "stale-hash",
      synced: true
    }
  ],
  driftedEnv: [
    {
      environment: "preview" as const,
      service: "eas",
      surface: "mobile" as const,
      kind: "envVar" as const,
      name: "API_URL",
      required: true,
      secret: false,
      valueHash: "drifted-hash",
      synced: false
    }
  ]
};

describe("provider operations", () => {
  it("defines provider adapter capabilities for the default services", () => {
    expect(Object.keys(providerAdapterDefinitions)).toEqual(["clerk", "convex", "vercel", "eas"]);
    expect(providerAdapterDefinitions.clerk.realAdapterStatus).toBe("command-plan");
    expect(providerAdapterDefinitions.convex.realAdapterStatus).toBe("command-plan");
    expect(providerAdapterDefinitions.vercel.realAdapterStatus).toBe("command-plan");
    expect(providerAdapterDefinitions.eas.realAdapterStatus).toBe("contract-only");
    expect(providerAdapterDefinitions.clerk.capabilities).toEqual(
      expect.arrayContaining([
        "service.lifecycle",
        "auth.sync",
        "billing.sync",
        "webhook.sync",
        "env.sync"
      ])
    );
    expect(providerAdapterDefinitions.convex.capabilities).toEqual(
      expect.arrayContaining(["service.lifecycle", "env.sync", "backend.deploy"])
    );
    expect(providerAdapterDefinitions.vercel.capabilities).toEqual(
      expect.arrayContaining(["service.lifecycle", "env.sync", "web.deploy"])
    );
    expect(providerAdapterDefinitions.eas.capabilities).toEqual(
      expect.arrayContaining(["service.lifecycle", "env.sync", "mobile.build"])
    );
  });

  it("filters provider adapter definitions to enabled services", () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.services.eas.enabled = false;

    expect(getEnabledProviderAdapterDefinitions(manifest).map((definition) => definition.service)).toEqual([
      "clerk",
      "convex",
      "vercel"
    ]);
  });

  it("plans provider operations for missing, stale, and env drift resources without leaking hashes", () => {
    const plan = createProviderOperationPlan(report);

    expect(plan.operations.map((operation) => operation.kind)).toEqual([
      "service.link",
      "service.unlink",
      "env.set",
      "env.set",
      "env.set",
      "env.remove"
    ]);
    expect(plan.operations).toContainEqual(
      expect.objectContaining({
        id: "preview.vercel.env.set.web.STRIPE_MODE",
        service: "vercel",
        scope: "web",
        target: "env:STRIPE_MODE",
        source: "env.missing",
        secret: false,
        requiresConfirmation: false
      })
    );
    expect(plan.operations).toContainEqual(
      expect.objectContaining({
        id: "preview.clerk.env.set.web.CLERK_WEBHOOK_SECRET",
        service: "clerk",
        scope: "web",
        target: "env:CLERK_WEBHOOK_SECRET",
        source: "env.missing",
        secret: true,
        requiresConfirmation: false
      })
    );
    expect(plan.operations).toContainEqual(
      expect.objectContaining({
        id: "preview.eas.env.set.mobile.API_URL",
        source: "env.drifted"
      })
    );
    expect(plan.operations).toContainEqual(
      expect.objectContaining({
        id: "preview.convex.env.remove.convex.LEGACY_FLAG",
        source: "env.stale"
      })
    );
    expect(JSON.stringify(plan)).not.toContain("hash");
    expect(JSON.stringify(plan)).not.toContain("stale-hash");
    expect(JSON.stringify(plan)).not.toContain("drifted-hash");
    expect(JSON.stringify(plan)).not.toContain("raw-secret");
  });

  it("marks production operations as requiring confirmation", () => {
    const plan = createProviderOperationPlan({ ...report, environment: "production" });

    expect(plan.operations.every((operation) => operation.requiresConfirmation)).toBe(true);
  });
});
