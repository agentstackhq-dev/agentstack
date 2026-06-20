import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    const manifest = JSON.parse(await readFile(join(appDir, "agentstack.config.json"), "utf8"));

    expect(manifest.generated.requiredAnchors).toEqual(
      expect.arrayContaining([
        "packages/domain/src/saas-spine.ts",
        "convex/saasSpine.ts",
        "docs/agentstack/saas-spine.md"
      ])
    );
    await expect(readFile(join(appDir, "packages/domain/src/saas-spine.ts"), "utf8")).resolves.toContain(
      "agentstackBillingPlans"
    );
    await expect(readFile(join(appDir, "packages/domain/src/saas-spine.ts"), "utf8")).resolves.toContain(
      "planHasEntitlement"
    );
    await expect(readFile(join(appDir, "packages/domain/src/index.ts"), "utf8")).resolves.toContain(
      './saas-spine.js'
    );
    await expect(readFile(join(appDir, "convex/saasSpine.ts"), "utf8")).resolves.toContain(
      "agentstackSaasTables"
    );
    await expect(readFile(join(appDir, "convex/saasSpine.ts"), "utf8")).resolves.toContain(
      "clerkWebhookTypes"
    );
    await expect(readFile(join(appDir, "docs/agentstack/saas-spine.md"), "utf8")).resolves.toContain(
      "Core SaaS Spine"
    );

    expect(await runAgentstack(["theme", "validate"], { cwd: appDir, write })).toBe(0);
    expect(
      await runAgentstack(
        ["add", "feature", "invoices", "--surfaces", "web,mobile", "--backend", "convex"],
        { cwd: appDir, write }
      )
    ).toBe(0);
    expect(
      await runAgentstack(
        [
          "add",
          "event",
          "billing.subscription.updated",
          "--journey",
          "billing",
          "--surfaces",
          "web,convex",
          "--state",
          "plan:string,seatCount:number"
        ],
        { cwd: appDir, write }
      )
    ).toBe(0);
    await expect(readFile(join(appDir, "apps/web/src/features/invoices.ts"), "utf8")).resolves.toContain(
      "invoicesWebFeature"
    );
    await expect(
      readFile(join(appDir, "packages/telemetry/src/events/billing-subscription-updated.ts"), "utf8")
    ).resolves.toContain("billing.subscription.updated");
    const manifestPath = join(appDir, "agentstack.config.json");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["convex"],
      environments: ["preview"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live"
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    expect(await runAgentstack(["validate"], { cwd: appDir, write })).toBe(1);
    expect(
      await runAgentstack(
        ["env", "set", "--env", "preview", "--surface", "convex", "--name", "STRIPE_MODE", "--value", "sandbox"],
        { cwd: appDir, write }
      )
    ).toBe(0);
    expect(await runAgentstack(["validate"], { cwd: appDir, write })).toBe(0);
    expect(await runAgentstack(["env", "inspect", "--env", "preview"], { cwd: appDir, write })).toBe(0);
    expect(await runAgentstack(["validate", "--cloud", "--env", "preview"], { cwd: appDir, write })).toBe(1);
    expect(await runAgentstack(["sync", "--env", "preview"], { cwd: appDir, write })).toBe(0);
    expect(await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: appDir, write })).toBe(0);
    expect(await runAgentstack(["validate", "--cloud", "--env", "preview"], { cwd: appDir, write })).toBe(0);
    expect(await runAgentstack(["deploy", "--env", "preview"], { cwd: appDir, write })).toBe(0);
    expect(await runAgentstack(["deploy", "--env", "preview", "--apply"], { cwd: appDir, write })).toBe(0);
    await expect(readFile(join(appDir, ".agentstack/deployments/preview.json"), "utf8")).resolves.toContain(
      '"environment": "preview"'
    );
    expect(await runAgentstack(["build", "mobile", "--env", "preview"], { cwd: appDir, write })).toBe(0);
    expect(
      await runAgentstack(["build", "mobile", "--env", "preview", "--apply"], { cwd: appDir, write })
    ).toBe(0);
    await expect(readFile(join(appDir, ".agentstack/builds/mobile-preview.json"), "utf8")).resolves.toContain(
      '"environment": "preview"'
    );

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
    expect(
      await runAgentstack(
        ["observe", "timeline", "--env", "preview", "--journey", "deployment"],
        { cwd: appDir, write }
      )
    ).toBe(0);
    expect(
      await runAgentstack(
        ["observe", "timeline", "--env", "preview", "--journey", "mobile-build"],
        { cwd: appDir, write }
      )
    ).toBe(0);
    expect(
      await runAgentstack(
        ["observe", "timeline", "--env", "development", "--journey", "telemetry-generation"],
        { cwd: appDir, write }
      )
    ).toBe(0);

    const renderedOutput = output.join("\n");
    expect(renderedOutput).toContain("PASS theme validate");
    expect(renderedOutput).toContain("CREATED feature invoices");
    expect(renderedOutput).toContain("CREATED event billing.subscription.updated");
    expect(renderedOutput).toContain("PASS env set preview convex.STRIPE_MODE");
    expect(renderedOutput).toContain("PASS env inspect preview");
    expect(renderedOutput).toContain("PLAN preview");
    expect(renderedOutput).toContain("APPLIED preview");
    expect(renderedOutput).toContain("PLAN deploy preview");
    expect(renderedOutput).toContain("APPLIED deploy preview");
    expect(renderedOutput).toContain("PLAN mobile build preview");
    expect(renderedOutput).toContain("APPLIED mobile build preview");
    expect(renderedOutput).toContain("Environment: preview");
    expect(renderedOutput).toContain("onboarding.step.completed");
    expect(renderedOutput).toContain("agentstack.validate.completed");
    expect(renderedOutput).toContain("agentstack.deploy.completed");
    expect(renderedOutput).toContain("agentstack.mobile.build.completed");
    expect(renderedOutput).toContain("agentstack.event.added");
    expect(renderedOutput).toContain("[redacted]");
  });
});
