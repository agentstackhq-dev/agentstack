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
