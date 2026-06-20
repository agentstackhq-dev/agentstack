import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultManifest } from "@agentstack/core";
import { LocalCloudAdapter } from "./local-cloud.js";

let dir: string;

const statePath = () => join(dir, ".agentstack", "local-cloud.json");

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentstack-cloud-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("local-cloud adapter", () => {
  it("plans preview deploy release steps without writing a deployment artifact", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    const plan = await adapter.deploy(manifest, "preview", { apply: false });

    expect(plan.applied).toBe(false);
    expect(plan.steps.map((step) => `${step.status} ${step.action} ${step.environment}.${step.service}`)).toContain(
      "planned release preview.vercel"
    );
    await expect(stat(join(dir, ".agentstack", "deployments", "preview.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("plans a preview mobile build without writing an artifact", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const plan = await adapter.mobileBuild(createDefaultManifest("acme-crm"), "preview", {
      apply: false
    });

    expect(plan).toMatchObject({
      environment: "preview",
      profile: "preview",
      service: "eas",
      applied: false,
      artifactPath: ".agentstack/builds/mobile-preview.json"
    });
    await expect(stat(join(dir, ".agentstack", "builds", "mobile-preview.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("applies a preview mobile build by writing a local artifact", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const plan = await adapter.mobileBuild(createDefaultManifest("acme-crm"), "preview", {
      apply: true
    });

    const artifact = JSON.parse(await readFile(join(dir, ".agentstack", "builds", "mobile-preview.json"), "utf8"));

    expect(plan.applied).toBe(true);
    expect(artifact).toMatchObject({
      environment: "preview",
      profile: "preview",
      service: "eas",
      applied: true
    });
  });

  it("passes production build confirmation through the core contract", async () => {
    const adapter = new LocalCloudAdapter(dir);

    await expect(
      adapter.mobileBuild(createDefaultManifest("acme-crm"), "production", { apply: true })
    ).rejects.toThrow("mobile.build.production-confirmation.required");
    await expect(
      adapter.mobileBuild(createDefaultManifest("acme-crm"), "production", {
        apply: true,
        confirmProduction: true
      })
    ).resolves.toMatchObject({ environment: "production", profile: "production", applied: true });
  });

  it("applies preview deploy by reconciling services and writing a deployment artifact", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    const plan = await adapter.deploy(manifest, "preview", { apply: true });
    const artifact = JSON.parse(
      await readFile(join(dir, ".agentstack", "deployments", "preview.json"), "utf8")
    ) as {
      environment: string;
      applied: boolean;
      steps: Array<{ action: string; environment: string; service: string; status: string }>;
    };
    const state = JSON.parse(await readFile(statePath(), "utf8")) as {
      services: Array<{ environment: string; service: string; linked: boolean }>;
    };

    expect(plan.applied).toBe(true);
    expect(plan.artifactPath).toBe(".agentstack/deployments/preview.json");
    expect(plan.steps.map((step) => `${step.status} ${step.action} ${step.environment}.${step.service}`)).toContain(
      "applied release preview.vercel"
    );
    expect(artifact.environment).toBe("preview");
    expect(artifact.applied).toBe(true);
    expect(artifact.steps.map((step) => `${step.status} ${step.action} ${step.environment}.${step.service}`)).toContain(
      "applied release preview.vercel"
    );
    expect(state.services.filter((service) => service.environment === "preview" && service.linked)).toHaveLength(4);
  });

  it("requires explicit production confirmation for deploy apply and writes the artifact when confirmed", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    await adapter.sync(manifest, "production", { apply: true });

    await expect(adapter.deploy(manifest, "production", { apply: true })).rejects.toThrow(
      "Production local-cloud mutations require explicit confirmation."
    );

    const plan = await adapter.deploy(manifest, "production", {
      apply: true,
      confirmProduction: true
    });

    expect(plan).toMatchObject({
      environment: "production",
      applied: true,
      artifactPath: ".agentstack/deployments/production.json"
    });
    await expect(stat(join(dir, ".agentstack", "deployments", "production.json"))).resolves.toBeTruthy();
  });

  it("keeps deploy apply idempotent and reconciles stale local-cloud services", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    await mkdir(join(dir, ".agentstack"), { recursive: true });
    await writeFile(
      statePath(),
      `${JSON.stringify(
        {
          services: [
            { environment: "preview", service: "legacy", linked: true, env: {} },
            { environment: "preview", service: "clerk", linked: true, env: {} }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const firstPlan = await adapter.deploy(manifest, "preview", { apply: true });
    const secondPlan = await adapter.deploy(manifest, "preview", { apply: true });
    const state = JSON.parse(await readFile(statePath(), "utf8")) as {
      services: Array<{ environment: string; service: string; linked: boolean }>;
    };

    expect(firstPlan.steps.map((step) => `${step.status} ${step.action} ${step.environment}.${step.service}`)).toContain(
      "applied sync preview.legacy"
    );
    expect(secondPlan.steps.map((step) => `${step.status} ${step.action} ${step.environment}.${step.service}`)).not.toContain(
      "applied sync preview.legacy"
    );
    expect(state.services.filter((service) => service.environment === "preview")).toHaveLength(4);
    expect(state.services.map((service) => service.service)).not.toContain("legacy");
    expect(new Set(state.services.map((service) => `${service.environment}.${service.service}`)).size).toBe(
      state.services.length
    );
  });

  it("inspects expected, linked, missing, and stale service resources for an environment", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    await mkdir(join(dir, ".agentstack"), { recursive: true });
    await writeFile(
      statePath(),
      `${JSON.stringify(
        {
          services: [
            {
              environment: "preview",
              service: "clerk",
              linked: true,
              env: {}
            },
            {
              environment: "preview",
              service: "legacy" as never,
              linked: true,
              env: {}
            },
            {
              environment: "production",
              service: "convex",
              linked: true,
              env: {}
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const report = await adapter.inspect(manifest, "preview");

    expect(report.environment).toBe("preview");
    expect(report.expected.map((resource) => resource.service)).toEqual(["clerk", "convex", "vercel", "eas"]);
    expect(report.linked.map((resource) => resource.service)).toEqual(["clerk"]);
    expect(report.missing.map((resource) => resource.service)).toEqual(["convex", "vercel", "eas"]);
    expect(report.stale.map((resource) => resource.service)).toEqual(["legacy"]);
  });

  it("plans service lifecycle changes from an inspect report", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    await mkdir(join(dir, ".agentstack"), { recursive: true });
    await writeFile(
      statePath(),
      `${JSON.stringify(
        {
          services: [
            {
              environment: "preview",
              service: "clerk",
              linked: true,
              env: {}
            },
            {
              environment: "preview",
              service: "legacy" as never,
              linked: true,
              env: {}
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const report = await adapter.inspect(manifest, "preview");
    const plan = adapter.plan(report);

    expect(plan).toEqual({
      environment: "preview",
      changes: [
        { action: "link", environment: "preview", service: "convex" },
        { action: "link", environment: "preview", service: "vercel" },
        { action: "link", environment: "preview", service: "eas" },
        { action: "unlink", environment: "preview", service: "legacy" }
      ]
    });
  });

  it("requires explicit production apply acknowledgement for lifecycle application", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");
    const plan = adapter.plan(await adapter.inspect(manifest, "production"));

    await expect(adapter.apply(plan)).rejects.toThrow("Production local-cloud mutations require explicit confirmation.");
    await expect(adapter.apply(plan, { confirmProduction: true })).resolves.toEqual({
      environment: "production",
      changes: plan.changes,
      applied: true
    });
  });

  it("detects missing managed service state", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const diagnostics = await adapter.validate(createDefaultManifest("acme-crm"), "preview");

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("cloud.service.missing");
  });

  it("reconciles preview service state", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    await adapter.sync(manifest, "preview", { apply: true });
    const diagnostics = await adapter.validate(manifest, "preview");

    expect(diagnostics).toEqual([]);
  });

  it("detects and syncs missing provider env resources without storing raw values", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["web", "convex"],
      environments: ["preview"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live"
    };
    const envValues = {
      preview: {
        web: { STRIPE_MODE: "sandbox" },
        convex: { STRIPE_MODE: "sandbox" }
      }
    };

    const beforeSync = await adapter.validate(manifest, "preview", { envValues });

    expect(beforeSync).toContainEqual(
      expect.objectContaining({
        severity: "fail",
        code: "cloud.env.missing",
        path: "preview.vercel.env.STRIPE_MODE",
        fix: "Run agentstack sync --env preview --apply."
      })
    );
    expect(beforeSync).toContainEqual(
      expect.objectContaining({
        severity: "fail",
        code: "cloud.env.missing",
        path: "preview.convex.env.STRIPE_MODE"
      })
    );

    const syncPlan = await adapter.sync(manifest, "preview", { apply: true, envValues });
    const stateText = await readFile(statePath(), "utf8");
    const state = JSON.parse(stateText) as {
      envResources?: Array<{ environment: string; service: string; name: string; valueHash?: string }>;
    };
    const afterSync = await adapter.validate(manifest, "preview", { envValues });

    expect(syncPlan.changes).toContain("set-env preview.vercel.STRIPE_MODE");
    expect(syncPlan.changes).toContain("set-env preview.convex.STRIPE_MODE");
    expect(state.envResources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          environment: "preview",
          service: "vercel",
          name: "STRIPE_MODE",
          valueHash: expect.any(String)
        })
      ])
    );
    expect(stateText).not.toContain("sandbox");
    expect(afterSync).toEqual([]);
  });

  it("does not plan provider env resource sets when required values are missing", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["web"],
      environments: ["preview"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live"
    };

    const plan = await adapter.sync(manifest, "preview", { apply: false, envValues: {} });

    expect(plan.changes).not.toContain("set-env preview.vercel.STRIPE_MODE");
  });

  it("does not persist provider env resources when required values are missing", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["web"],
      environments: ["preview"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live"
    };

    await adapter.sync(manifest, "preview", { apply: true, envValues: {} });

    const state = JSON.parse(await readFile(statePath(), "utf8")) as {
      envResources?: Array<{ environment: string; service: string; name: string; valueHash?: string }>;
    };
    expect(state.envResources ?? []).not.toContainEqual(
      expect.objectContaining({
        environment: "preview",
        service: "vercel",
        name: "STRIPE_MODE"
      })
    );
  });

  it("detects stale provider env resources and plans remove-env", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    await mkdir(join(dir, ".agentstack"), { recursive: true });
    await writeFile(
      statePath(),
      `${JSON.stringify(
        {
          services: [],
          envResources: [
            {
              environment: "preview",
              surface: "web",
              service: "vercel",
              kind: "envVar",
              name: "LEGACY_FLAG",
              required: false,
              secret: false,
              valueHash: "legacy"
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const diagnostics = await adapter.validate(manifest, "preview");
    const plan = await adapter.sync(manifest, "preview", { apply: false });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        severity: "fail",
        code: "cloud.env.stale",
        path: "preview.vercel.env.LEGACY_FLAG"
      })
    );
    expect(plan.changes).toContain("remove-env preview.vercel.LEGACY_FLAG");
  });

  it("detects drifted provider env resource hashes until sync apply updates them", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["web"],
      environments: ["preview"],
      required: true,
      secret: true,
      validate: "enum:sandbox,live"
    };
    const firstValues = { preview: { web: { STRIPE_MODE: "sandbox" } } };
    const secondValues = { preview: { web: { STRIPE_MODE: "live" } } };

    await adapter.sync(manifest, "preview", { apply: true, envValues: firstValues });

    const drifted = await adapter.validate(manifest, "preview", { envValues: secondValues });
    const driftPlan = await adapter.sync(manifest, "preview", { apply: false, envValues: secondValues });

    expect(drifted).toContainEqual(
      expect.objectContaining({
        severity: "fail",
        code: "cloud.env.drift",
        path: "preview.vercel.env.STRIPE_MODE"
      })
    );
    expect(driftPlan.changes).toContain("set-env preview.vercel.STRIPE_MODE");

    await adapter.sync(manifest, "preview", { apply: true, envValues: secondValues });

    const stateText = await readFile(statePath(), "utf8");
    expect(await adapter.validate(manifest, "preview", { envValues: secondValues })).toEqual([]);
    expect(stateText).not.toContain("sandbox");
    expect(stateText).not.toContain("live");
  });

  it("does not replan synced env resources during deploy when current values are unavailable", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["web"],
      environments: ["preview"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live"
    };

    await adapter.sync(manifest, "preview", {
      apply: true,
      envValues: { preview: { web: { STRIPE_MODE: "sandbox" } } }
    });

    const plan = await adapter.deploy(manifest, "preview", { apply: false });

    expect(plan.steps.map((step) => `${step.status} ${step.action} ${step.environment}.${step.service}`)).not.toContain(
      "planned sync preview.vercel"
    );
  });

  it("detects stale linked services disabled in the manifest for the selected environment", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    await adapter.sync(manifest, "preview", { apply: true });
    await adapter.sync(manifest, "production", { apply: true });
    manifest.services.clerk.enabled = false;

    const previewDiagnostics = await adapter.validate(manifest, "preview");
    const productionDiagnostics = await adapter.validate(manifest, "production");

    expect(previewDiagnostics).toContainEqual(
      expect.objectContaining({
        severity: "fail",
        code: "cloud.service.stale",
        path: "preview.clerk"
      })
    );
    expect(previewDiagnostics.find((diagnostic) => diagnostic.path === "preview.clerk")?.fix).toContain(
      "agentstack sync --env preview --apply"
    );
    expect(productionDiagnostics.map((diagnostic) => diagnostic.path)).not.toContain("preview.clerk");
  });

  it("reconciles stale linked services disabled in the manifest for the selected environment", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    await adapter.sync(manifest, "preview", { apply: true });
    await adapter.sync(manifest, "production", { apply: true });
    manifest.services.clerk.enabled = false;

    const staleDiagnostics = await adapter.validate(manifest, "preview");
    const plan = await adapter.sync(manifest, "preview", { apply: true });
    const diagnostics = await adapter.validate(manifest, "preview");
    const state = JSON.parse(await readFile(statePath(), "utf8")) as {
      services: Array<{ environment: string; service: string; linked: boolean }>;
    };

    expect(staleDiagnostics.map((diagnostic) => diagnostic.code)).toContain("cloud.service.stale");
    expect(plan.changes).toContain("unlink preview.clerk");
    expect(diagnostics).toEqual([]);
    expect(
      state.services.some(
        (service) => service.environment === "preview" && service.service === "clerk" && service.linked
      )
    ).toBe(false);
    expect(
      state.services.some(
        (service) => service.environment === "production" && service.service === "clerk" && service.linked
      )
    ).toBe(true);
  });

  it("plans stale linked service reconciliation without writing state when apply is false", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    await adapter.sync(manifest, "preview", { apply: true });
    manifest.services.clerk.enabled = false;

    const plan = await adapter.sync(manifest, "preview", { apply: false });
    const diagnostics = await adapter.validate(manifest, "preview");
    const state = JSON.parse(await readFile(statePath(), "utf8")) as {
      services: Array<{ environment: string; service: string; linked: boolean }>;
    };

    expect(plan).toEqual({
      environment: "preview",
      changes: ["unlink preview.clerk"],
      applied: false
    });
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain("cloud.service.stale");
    expect(
      state.services.some(
        (service) => service.environment === "preview" && service.service === "clerk" && service.linked
      )
    ).toBe(true);
  });

  it("reconciles existing unlinked service state", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    await mkdir(join(dir, ".agentstack"), { recursive: true });
    await writeFile(
      statePath(),
      `${JSON.stringify(
        {
          services: [
            {
              environment: "preview",
              service: "clerk",
              linked: false,
              env: {}
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const plan = await adapter.sync(manifest, "preview", { apply: true });
    const diagnostics = await adapter.validate(manifest, "preview");

    expect(plan.changes).toContain("link preview.clerk");
    expect(diagnostics).toEqual([]);
  });

  it("plans changes without writing state when apply is false", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    const plan = await adapter.sync(manifest, "preview", { apply: false });

    expect(plan).toEqual({
      environment: "preview",
      changes: ["link preview.clerk", "link preview.convex", "link preview.vercel", "link preview.eas"],
      applied: false
    });
    await expect(stat(statePath())).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not duplicate services when applied repeatedly", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");

    await adapter.sync(manifest, "preview", { apply: true });
    const plan = await adapter.sync(manifest, "preview", { apply: true });
    const state = JSON.parse(await readFile(statePath(), "utf8")) as {
      services: Array<{ environment: string; service: string }>;
    };

    expect(plan.changes).toEqual([]);
    expect(state.services.filter((service) => service.environment === "preview")).toHaveLength(4);
    expect(new Set(state.services.map((service) => `${service.environment}.${service.service}`)).size).toBe(
      state.services.length
    );
  });

  it("does not write disabled services", async () => {
    const adapter = new LocalCloudAdapter(dir);
    const manifest = createDefaultManifest("acme-crm");
    manifest.services.clerk.enabled = false;

    await adapter.sync(manifest, "preview", { apply: true });
    const state = JSON.parse(await readFile(statePath(), "utf8")) as {
      services: Array<{ service: string }>;
    };

    expect(state.services.map((service) => service.service)).toEqual(["convex", "vercel", "eas"]);
  });
});
