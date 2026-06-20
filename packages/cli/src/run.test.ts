import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultManifest } from "@agentstack/core";
import { createWideEvent, JsonlTelemetryStore } from "@agentstack/telemetry";
import { runAgentstack } from "./index.js";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const packageManifestPath = join(packageDir, "package.json");
const packageShimPath = join(packageDir, "src/bin.js");

let dir: string;
let output: string[];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentstack-cli-"));
  output = [];
  const manifest = createDefaultManifest("acme-crm");
  await writeFile(
    join(dir, "agentstack.config.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  await writeGeneratedAnchors();
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("runAgentstack", () => {
  it("validates a local project", async () => {
    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS validate");
  });

  it("fails local validation when a required generated anchor is missing", async () => {
    await rm(join(dir, "apps/web/package.json"));

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL template.anchor.missing");
    expect(output.join("\n")).toContain("Path: apps/web/package.json");
  });

  it("fails local validation when a required generated anchor is a directory", async () => {
    await rm(join(dir, "apps/web/package.json"));
    await mkdir(join(dir, "apps/web/package.json"));

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL template.anchor.missing");
    expect(output.join("\n")).toContain("Path: apps/web/package.json");
  });

  it("fails local validation when the root package anchor is missing", async () => {
    await rm(join(dir, "package.json"));

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL template.anchor.missing");
    expect(output.join("\n")).toContain("Path: package.json");
  });

  it("fails local validation when the workspace anchor is missing", async () => {
    await rm(join(dir, "pnpm-workspace.yaml"));

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL template.anchor.missing");
    expect(output.join("\n")).toContain("Path: pnpm-workspace.yaml");
  });

  it("reports a missing manifest config as a required generated anchor", async () => {
    await rm(join(dir, "agentstack.config.json"));

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL template.anchor.missing");
    expect(output.join("\n")).toContain("Path: agentstack.config.json");
  });

  it("reports a manifest config directory as a required generated anchor", async () => {
    await rm(join(dir, "agentstack.config.json"));
    await mkdir(join(dir, "agentstack.config.json"));

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL template.anchor.missing");
    expect(output.join("\n")).toContain("Path: agentstack.config.json");
  });

  it("fails local validation when a required generated docs anchor is missing", async () => {
    await rm(join(dir, "docs/agentstack/theming.md"));

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL template.anchor.missing");
    expect(output.join("\n")).toContain("Path: docs/agentstack/theming.md");
  });

  it("fails cloud validation when cloud state is missing", async () => {
    const code = await runAgentstack(["validate", "--cloud"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cloud.service.missing");
  });

  it("stops cloud validation when local validation fails", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.telemetry.redaction.forbidRawSecrets = false;
    await writeFile(
      join(dir, "agentstack.config.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );

    const code = await runAgentstack(["validate", "--cloud"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL telemetry.redaction.disabled");
    expect(output.join("\n")).not.toContain("cloud.service.missing");
  });

  it("applies preview cloud sync", async () => {
    const code = await runAgentstack(["sync", "--env", "preview", "--apply"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("APPLIED preview");
  });

  it("prints a success line when cloud validation passes", async () => {
    await runAgentstack(["init", "cloud"], {
      cwd: dir,
      write: () => undefined
    });

    const code = await runAgentstack(["validate", "--cloud"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS validate --cloud");
  });

  it("queries observed events with redacted sensitive telemetry", async () => {
    const store = new JsonlTelemetryStore(join(dir, ".agentstack", "events.jsonl"));
    await store.append(
      createWideEvent("billing.subscription.updated", {
        environment: "preview",
        surface: "web",
        state: {
          status: "active",
          customerEmail: "buyer@example.com",
          stripeToken: "tok_live_secret"
        }
      })
    );
    await store.append(
      createWideEvent("auth.session.created", {
        environment: "preview",
        surface: "web",
        state: { status: "ignored" }
      })
    );

    const code = await runAgentstack(
      ["observe", "query", "--env", "preview", "--event", "billing.*"],
      {
        cwd: dir,
        write: (line) => output.push(line)
      }
    );

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("billing.subscription.updated");
    expect(output.join("\n")).toContain("[redacted]");
  });

  it("rejects invalid observe environment filters", async () => {
    const code = await runAgentstack(["observe", "query", "--env", "nope"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cli.option.invalid");
    expect(output.join("\n")).toContain("Invalid --env value: nope");
  });

  it("rejects invalid observe surface filters", async () => {
    const code = await runAgentstack(["observe", "query", "--surface", "nope"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cli.option.invalid");
    expect(output.join("\n")).toContain("Invalid --surface value: nope");
  });

  it("requires observe event filter values", async () => {
    const code = await runAgentstack(["observe", "query", "--event"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cli.option.missing");
    expect(output.join("\n")).toContain("--event requires a value.");
  });

  it("requires sync environment values with an actionable diagnostic", async () => {
    const code = await runAgentstack(["sync", "--apply"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cli.option.missing");
    expect(output.join("\n")).toContain("--env requires a value.");
    expect(output.join("\n")).toContain("Expected one of: development, preview, production.");
    expect(output.join("\n")).toContain("Fix: Run agentstack sync --env preview --apply.");
  });
});

describe("package metadata", () => {
  it("exposes a self-contained Node shim for the installed agentstack bin", async () => {
    const packageManifest = JSON.parse(
      await readFile(packageManifestPath, "utf8")
    );

    expect(packageManifest.bin.agentstack).toBe("src/bin.js");
    expect(packageManifest.dependencies).toHaveProperty("tsx");
    await expect(stat(packageShimPath)).resolves.toMatchObject({
      isFile: expect.any(Function)
    });
  });
});

async function writeGeneratedAnchors(): Promise<void> {
  const anchors = [
    "AGENTS.md",
    "package.json",
    "pnpm-workspace.yaml",
    "docs/agentstack/workflows.md",
    "docs/agentstack/validation.md",
    "docs/agentstack/observability.md",
    "docs/agentstack/environments.md",
    "docs/agentstack/generated-boundaries.md",
    "docs/agentstack/release.md",
    "docs/agentstack/theming.md",
    "apps/web/package.json",
    "apps/mobile/package.json",
    "convex/schema.ts",
    "packages/domain/src/index.ts",
    "packages/theme/src/index.ts",
    "packages/telemetry/src/events.ts"
  ];

  await Promise.all(
    anchors.map(async (anchor) => {
      await mkdir(dirname(join(dir, anchor)), { recursive: true });
      await writeFile(join(dir, anchor), "{}\n", "utf8");
    })
  );
}
