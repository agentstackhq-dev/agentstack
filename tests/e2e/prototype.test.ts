import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { generateProject } from "../../packages/create-agent-stack/src/generate.js";
import { runAgentstack } from "../../packages/cli/src/run.js";
import { createWideEvent, JsonlTelemetryStore } from "../../packages/telemetry/src/index.js";

let tempRoot: string | undefined;

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
    tempRoot = undefined;
  }
});

describe("Agentstack executable prototype workflow", () => {
  test("generates, validates, inspects env state, syncs cloud, and observes telemetry", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "agentstack-prototype-"));
    const appDir = join(tempRoot, "acme-crm");
    const output: string[] = [];
    const write = (line: string) => output.push(line);

    await generateProject({ name: "acme-crm", targetDir: appDir });

    expect(await runAgentstack(["validate"], { cwd: appDir, write })).toBe(0);
    expect(await runAgentstack(["env", "inspect", "--env", "preview"], { cwd: appDir, write })).toBe(0);
    expect(await runAgentstack(["validate", "--cloud", "--env", "preview"], { cwd: appDir, write })).toBe(1);
    expect(await runAgentstack(["sync", "--env", "preview"], { cwd: appDir, write })).toBe(0);
    expect(await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: appDir, write })).toBe(0);
    expect(await runAgentstack(["validate", "--cloud", "--env", "preview"], { cwd: appDir, write })).toBe(0);

    const store = new JsonlTelemetryStore(join(appDir, ".agentstack", "events.jsonl"));
    await store.append(
      createWideEvent("onboarding.step.completed", {
        environment: "preview",
        surface: "web",
        journey: "onboarding",
        state: {
          step: "invite-team",
          userEmail: "buyer@example.com"
        }
      })
    );

    expect(
      await runAgentstack(
        ["observe", "query", "--env", "preview", "--journey", "onboarding"],
        { cwd: appDir, write }
      )
    ).toBe(0);

    expect(
      await runAgentstack(
        ["observe", "timeline", "--env", "preview", "--journey", "validation"],
        { cwd: appDir, write }
      )
    ).toBe(0);

    const renderedOutput = output.join("\n");
    expect(renderedOutput).toContain("PASS env inspect preview");
    expect(renderedOutput).toContain("PLAN preview");
    expect(renderedOutput).toContain("APPLIED preview");
    expect(renderedOutput).toContain("Environment: preview");
    expect(renderedOutput).toContain("onboarding.step.completed");
    expect(renderedOutput).toContain("agentstack.validate.completed");
    expect(renderedOutput).toContain("[redacted]");
  });
});
