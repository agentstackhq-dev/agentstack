import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultManifest } from "@agentstack/core";
import { LocalCloudAdapter } from "./local-cloud.js";

let dir: string;

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
});
