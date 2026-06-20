import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultManifest } from "@agentstack/core";
import { createWideEvent, JsonlTelemetryStore } from "@agentstack/telemetry";
import { runAgentstack } from "./index.js";

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
