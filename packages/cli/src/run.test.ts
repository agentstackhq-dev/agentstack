import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultManifest, defaultThemeTokens } from "@agentstack/core";
import type { ProviderCommandExecutor } from "@agentstack/adapters";
import { createWideEvent, JsonlTelemetryStore } from "@agentstack/telemetry";
import { runAgentstack } from "./index.js";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const packageManifestPath = join(packageDir, "package.json");
const packageShimPath = join(packageDir, "src/bin.js");

let dir: string;
let output: string[];
let providerExecutions: Array<{ command: string; args: string[]; stdin?: string }>;
type CustomEnvProviderTarget = NonNullable<
  ReturnType<typeof createDefaultManifest>["env"]["custom"][string]["providerTargets"]
>[number];
const convexPreviewTarget: CustomEnvProviderTarget[] = [
  { service: "convex", surfaces: ["convex"], environments: ["preview"], source: "local-value" }
];
const convexPreviewProductionTargets: CustomEnvProviderTarget[] = [
  { service: "convex", surfaces: ["convex"], environments: ["preview", "production"], source: "local-value" }
];
const productionWebConvexTargets: CustomEnvProviderTarget[] = [
  { service: "vercel", surfaces: ["web"], environments: ["production"], source: "local-value" },
  { service: "convex", surfaces: ["convex"], environments: ["production"], source: "local-value" }
];
const previewWebConvexTargets: CustomEnvProviderTarget[] = [
  { service: "vercel", surfaces: ["web"], environments: ["preview"], source: "local-value" },
  { service: "convex", surfaces: ["convex"], environments: ["preview"], source: "local-value" }
];
const easPreviewTarget: CustomEnvProviderTarget[] = [
  { service: "eas", surfaces: ["mobile"], environments: ["preview"], source: "local-value" }
];
const vercelPreviewTarget: CustomEnvProviderTarget[] = [
  { service: "vercel", surfaces: ["web"], environments: ["preview"], source: "local-value" }
];
const clerkPreviewTarget: CustomEnvProviderTarget[] = [
  { service: "clerk", surfaces: ["web"], environments: ["preview"], source: "local-value" }
];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "agentstack-cli-"));
  output = [];
  providerExecutions = [];
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
  it("validates the generated theme token contract", async () => {
    const code = await runAgentstack(["theme", "validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS theme validate");
  });

  it("fails theme validation when a required token is missing", async () => {
    const tokens = JSON.parse(await readFile(join(dir, "packages/theme/tokens.json"), "utf8"));
    delete tokens.colors.focusRing;
    await writeFile(join(dir, "packages/theme/tokens.json"), `${JSON.stringify(tokens, null, 2)}\n`);

    const code = await runAgentstack(["theme", "validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL theme.tokens.missing");
    expect(output.join("\n")).toContain("Path: packages/theme/tokens.json:colors.focusRing");
  });

  it("reports malformed theme token JSON distinctly", async () => {
    await writeFile(join(dir, "packages/theme/tokens.json"), "{ nope", "utf8");

    const code = await runAgentstack(["theme", "validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL theme.tokens.invalid-json");
    expect(output.join("\n")).toContain("Path: packages/theme/tokens.json");
  });

  it("fails theme validation when the typed mirror can drift from token JSON", async () => {
    await writeFile(
      join(dir, "packages/theme/src/index.ts"),
      [
        "export const themeTokens = {",
        "  colors: { focusRing: \"#000000\" }",
        "} as const;",
        ""
      ].join("\n"),
      "utf8"
    );

    const code = await runAgentstack(["theme", "validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL theme.tokens.mirror-drift");
    expect(output.join("\n")).toContain("Path: packages/theme/src/index.ts");
  });

  it("includes theme diagnostics in local validation", async () => {
    const tokens = JSON.parse(await readFile(join(dir, "packages/theme/tokens.json"), "utf8"));
    tokens.spacing.md = "16px";
    await writeFile(join(dir, "packages/theme/tokens.json"), `${JSON.stringify(tokens, null, 2)}\n`);

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL theme.tokens.invalid");
  });

  it("blocks deploy when theme diagnostics fail", async () => {
    const tokens = JSON.parse(await readFile(join(dir, "packages/theme/tokens.json"), "utf8"));
    tokens.radius.md = "8px";
    await writeFile(join(dir, "packages/theme/tokens.json"), `${JSON.stringify(tokens, null, 2)}\n`);

    const code = await runAgentstack(["deploy", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL theme.tokens.invalid");
    expect(output.join("\n")).toContain("Path: packages/theme/tokens.json:radius.md");
    expect(output.join("\n")).not.toContain("PLAN deploy preview");
  });

  it("records command telemetry for successful theme validation", async () => {
    expect(
      await runAgentstack(["theme", "validate"], {
        cwd: dir,
        write: () => undefined
      })
    ).toBe(0);

    const code = await runAgentstack(
      ["observe", "timeline", "--env", "development", "--journey", "theming"],
      {
        cwd: dir,
        write: (line) => output.push(line)
      }
    );

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("agentstack.theme.validate.completed");
    expect(output.join("\n")).toContain("Summary: events=1 errors=0");
    expect(output.join("\n")).toContain("Risks:");
    expect(output.join("\n")).toContain("Next queries:");
  });

  it("records command telemetry when theme validation fails", async () => {
    await writeFile(join(dir, "packages/theme/tokens.json"), "{ nope", "utf8");

    expect(
      await runAgentstack(["theme", "validate"], {
        cwd: dir,
        write: () => undefined
      })
    ).toBe(1);

    const code = await runAgentstack(
      ["observe", "timeline", "--env", "development", "--journey", "theming"],
      {
        cwd: dir,
        write: (line) => output.push(line)
      }
    );

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("agentstack.theme.validate.completed");
    expect(output.join("\n")).toContain("status=fail");
  });

  it("validates a local project", async () => {
    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS validate");
  });

  it("inspects project lifecycle state", async () => {
    await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });

    const code = await runAgentstack(["inspect", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS inspect acme-crm");
    expect(output.join("\n")).toContain("Environment: preview");
    expect(output.join("\n")).toContain("Generated anchors:");
    expect(output.join("\n")).toContain(
      "Provider adapters: clerk:command-plan,convex:command-plan,vercel:command-plan,eas:command-plan"
    );
    expect(output.join("\n")).toContain("Provider operations: none");
    expect(output.join("\n")).toContain("Cloud missing: none");
  });

  it("prints provider operations for unsynced preview inspection", async () => {
    const code = await runAgentstack(["inspect", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("WARN inspect acme-crm");
    expect(output.join("\n")).toContain(
      "Provider adapters: clerk:command-plan,convex:command-plan,vercel:command-plan,eas:command-plan"
    );
    expect(output.join("\n")).toContain("preview.clerk.service.link");
    expect(output.join("\n")).toContain("preview.convex.service.link");
  });

  it("reports doctor failures with next commands", async () => {
    const code = await runAgentstack(["doctor", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output).toContain("FAIL doctor preview");
    expect(output.join("\n")).toContain("FAIL cloud.service.missing");
    expect(output.join("\n")).toContain("Next commands:");
    expect(output.join("\n")).toContain("agentstack sync --env preview --apply");
  });

  it("reports provider env diagnostics and sync repair command in doctor", async () => {
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });

    const code = await runAgentstack(["doctor", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cloud.env.missing");
    expect(output.join("\n")).toContain("agentstack sync --env preview --apply");
    expect(output.join("\n")).not.toContain("sk-local-provider-value");
  });

  it("prints dev preflight commands without starting servers", async () => {
    await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });

    const code = await runAgentstack(["dev", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS dev preflight preview");
    expect(output.join("\n")).toContain("pnpm --filter @app/web dev");
    expect(output.join("\n")).toContain("pnpm --filter @app/mobile dev");
  });

  it("prints development dev preflight without preview-only script names", async () => {
    await runAgentstack(["sync", "--env", "development", "--apply"], {
      cwd: dir,
      write: () => undefined
    });

    const code = await runAgentstack(["dev", "--env", "development"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS dev preflight development");
    expect(output.join("\n")).toContain("node scripts/agentstack.mjs sync --env development --apply");
    expect(output.join("\n")).not.toContain("sync:development:apply");
  });

  it("records lifecycle command telemetry", async () => {
    await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });

    expect(await runAgentstack(["inspect", "--env", "preview"], { cwd: dir, write: () => undefined })).toBe(0);
    expect(await runAgentstack(["doctor", "--env", "preview"], { cwd: dir, write: () => undefined })).toBe(0);
    expect(await runAgentstack(["dev", "--env", "preview"], { cwd: dir, write: () => undefined })).toBe(0);

    const code = await runAgentstack(
      ["observe", "timeline", "--env", "preview", "--journey", "agent-command"],
      {
        cwd: dir,
        write: (line) => output.push(line)
      }
    );

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("agentstack.inspect.completed");
    expect(output.join("\n")).toContain("agentstack.dev.preflight.completed");

    output = [];
    expect(
      await runAgentstack(
        ["observe", "timeline", "--env", "preview", "--journey", "validation"],
        {
          cwd: dir,
          write: (line) => output.push(line)
        }
      )
    ).toBe(0);
    expect(output.join("\n")).toContain("agentstack.doctor.completed");
  });

  it("inspects generated Agentstack guidance skills", async () => {
    const code = await runAgentstack(["skills", "inspect"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS skills inspect");
    expect(output.join("\n")).toContain("Guidance version: 2026-06-20");
    expect(output.join("\n")).toContain("skills/agentstack/SKILL.md");
    expect(output.join("\n")).toContain("No MCP dependency");

    output = [];
    expect(
      await runAgentstack(
        ["observe", "timeline", "--env", "development", "--journey", "agent-guidance"],
        {
          cwd: dir,
          write: (line) => output.push(line)
        }
      )
    ).toBe(0);
    expect(output.join("\n")).toContain("agentstack.skills.inspect.completed");
  });

  it("fails guidance skill inspection when a guidance anchor is missing", async () => {
    await rm(join(dir, "skills/agentstack/SKILL.md"), { force: true });

    const code = await runAgentstack(["skills", "inspect"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output).toContain("FAIL skills inspect");
    expect(output.join("\n")).toContain("- MISSING skills/agentstack/SKILL.md");

    output = [];
    expect(
      await runAgentstack(
        ["observe", "timeline", "--env", "development", "--journey", "agent-guidance"],
        {
          cwd: dir,
          write: (line) => output.push(line)
        }
      )
    ).toBe(0);
    expect(output.join("\n")).toContain("agentstack.skills.inspect.completed");
    expect(output.join("\n")).toContain("status=fail");
  });

  it("loads local custom env values during validation", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["convex"];
    manifest.env.custom.OPENAI_API_KEY = {
      surfaces: ["convex"],
      environments: ["preview"],
      required: true,
      secret: true,
      providerTargets: convexPreviewTarget
    };
    await writeFile(
      join(dir, "agentstack.config.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
    await mkdir(join(dir, ".agentstack"), { recursive: true });
    await writeFile(
      join(dir, ".agentstack", "env-values.json"),
      `${JSON.stringify({ preview: { convex: { OPENAI_API_KEY: "replace-me" } } }, null, 2)}\n`,
      "utf8"
    );

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS validate");
  });

  it("loads local custom env values during cloud validation", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["convex"];
    manifest.env.custom.OPENAI_API_KEY = {
      surfaces: ["convex"],
      environments: ["preview"],
      required: true,
      secret: true,
      providerTargets: convexPreviewTarget
    };
    await writeFile(
      join(dir, "agentstack.config.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
    await mkdir(join(dir, ".agentstack"), { recursive: true });
    await writeFile(
      join(dir, ".agentstack", "env-values.json"),
      `${JSON.stringify({ preview: { convex: { OPENAI_API_KEY: "replace-me" } } }, null, 2)}\n`,
      "utf8"
    );
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

  it("fails cloud validation on missing provider env before sync even when local values exist", async () => {
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });

    const code = await runAgentstack(["validate", "--cloud", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cloud.env.missing");
    expect(output.join("\n")).toContain("Path: preview.convex.convex.env.OPENAI_API_KEY");
    expect(output.join("\n")).not.toContain("sk-local-provider-value");
  });

  it("syncs provider env without printing or storing raw local values", async () => {
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });

    const code = await runAgentstack(["sync", "--env", "preview", "--apply"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("- set-env preview.convex.convex.OPENAI_API_KEY");
    expect(output.join("\n")).not.toContain("sk-local-provider-value");
    await expect(readFile(join(dir, ".agentstack", "local-cloud.json"), "utf8")).resolves.not.toContain(
      "sk-local-provider-value"
    );
  });

  it("blocks preview provider env sync apply when a required local value is missing", async () => {
    await writeProviderEnvManifest();

    const code = await runAgentstack(["sync", "--env", "preview", "--apply"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL env.custom.missing");
    expect(output.join("\n")).toContain("Path: preview.convex.OPENAI_API_KEY");
    expect(output.join("\n")).not.toContain("replace-me");
    expect(output.join("\n")).not.toContain("APPLIED preview");
    await expect(stat(join(dir, ".agentstack", "local-cloud.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("blocks preview provider env sync plan when a required local value is missing", async () => {
    await writeProviderEnvManifest();

    const code = await runAgentstack(["sync", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL env.custom.missing");
    expect(output.join("\n")).toContain("Path: preview.convex.OPENAI_API_KEY");
    expect(output.join("\n")).not.toContain("PLAN preview");
    expect(output.join("\n")).not.toContain("set-env");
  });

  it("blocks preview provider env sync apply when a local enum value is invalid", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["convex"];
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["convex"],
      environments: ["preview"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live",
      providerTargets: convexPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeLocalEnvValues({
      preview: { convex: { STRIPE_MODE: "bogus-mode" } }
    });

    const code = await runAgentstack(["sync", "--env", "preview", "--apply"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL env.custom.invalid-enum");
    expect(output.join("\n")).toContain("Path: preview.convex.STRIPE_MODE");
    expect(output.join("\n")).not.toContain("bogus-mode");
    expect(output.join("\n")).not.toContain("APPLIED preview");
    await expect(stat(join(dir, ".agentstack", "local-cloud.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("passes cloud validation after provider env sync", async () => {
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await runAgentstack(["sync", "--env", "preview", "--apply"], {
      cwd: dir,
      write: () => undefined
    });

    const code = await runAgentstack(["validate", "--cloud", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS validate --cloud");
    expect(output.join("\n")).not.toContain("sk-local-provider-value");
  });

  it("fails validation when local custom env values are invalid JSON", async () => {
    await mkdir(join(dir, ".agentstack"), { recursive: true });
    await writeFile(join(dir, ".agentstack", "env-values.json"), "{ nope", "utf8");

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL env.values.invalid-json");
    expect(output.join("\n")).toContain("Path: .agentstack/env-values.json");
  });

  it("fails validation when local custom env values have an invalid shape", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["convex"];
    manifest.env.custom.OPENAI_API_KEY = {
      surfaces: ["convex"],
      environments: ["preview"],
      required: true,
      secret: true,
      providerTargets: convexPreviewTarget
    };
    await writeFile(
      join(dir, "agentstack.config.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
    await mkdir(join(dir, ".agentstack"), { recursive: true });
    await writeFile(
      join(dir, ".agentstack", "env-values.json"),
      `${JSON.stringify({ preview: { convex: { OPENAI_API_KEY: true } } }, null, 2)}\n`,
      "utf8"
    );

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL env.values.invalid-shape");
    expect(output.join("\n")).toContain("Path: .agentstack/env-values.json");
    expect(output.join("\n")).toContain("preview.convex.OPENAI_API_KEY");
    expect(output.join("\n")).not.toContain("PASS validate");
  });

  it("fails production release validation before production cloud is synced", async () => {
    const code = await runAgentstack(["validate", "--release", "production"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cloud.service.missing");
    expect(output.join("\n")).toContain("Path: production.");
    expect(output.join("\n")).not.toContain("PASS validate --release production");
  });

  it("fails production release validation on missing production provider env before provision", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["web", "convex"],
      environments: ["production"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live",
      providerTargets: productionWebConvexTargets
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeLocalEnvValues({
      production: {
        web: { STRIPE_MODE: "live" },
        convex: { STRIPE_MODE: "live" }
      }
    });

    const code = await runAgentstack(["validate", "--release", "production"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cloud.env.missing");
    expect(output.join("\n")).toContain("Path: production.vercel.web.env.STRIPE_MODE");
    expect(output.join("\n")).not.toContain("live");
  });

  it("plans production provision without writing state and applies production provision", async () => {
    const planCode = await runAgentstack(["prod", "provision"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(planCode).toBe(0);
    expect(output).toContain("PLAN prod provision production");
    expect(output).toContain("Evidence: local-rehearsal");
    expect(output).toContain("- link production.clerk");
    await expect(stat(join(dir, ".agentstack", "local-cloud.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });

    output = [];
    const applyCode = await runAgentstack(["prod", "provision", "--apply"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(applyCode).toBe(0);
    expect(output).toContain("APPLIED prod provision production");
    expect(output).toContain("Evidence: local-rehearsal");
    expect(output).toContain("- link production.clerk");
    await expect(readFile(join(dir, ".agentstack", "local-cloud.json"), "utf8")).resolves.toContain(
      '"environment": "production"'
    );
  });

  it("blocks production provision apply when a required production provider env value is missing", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["web", "convex"],
      environments: ["production"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live",
      providerTargets: productionWebConvexTargets
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);

    const code = await runAgentstack(["prod", "provision", "--apply"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL env.custom.missing");
    expect(output.join("\n")).toContain("Path: production.web.STRIPE_MODE");
    expect(output.join("\n")).toContain("Path: production.convex.STRIPE_MODE");
    expect(output.join("\n")).not.toContain("APPLIED prod provision production");
    await expect(stat(join(dir, ".agentstack", "local-cloud.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("blocks production provision plan when a required production provider env value is missing", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["web", "convex"],
      environments: ["production"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live",
      providerTargets: productionWebConvexTargets
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);

    const code = await runAgentstack(["prod", "provision"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL env.custom.missing");
    expect(output.join("\n")).not.toContain("PLAN prod provision production");
  });

  it("passes production release validation after production provision apply", async () => {
    await runAgentstack(["prod", "provision", "--apply"], { cwd: dir, write: () => undefined });

    const code = await runAgentstack(["validate", "--release", "production"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS validate --release production");
  });

  it("prepares production before production cloud is synced", async () => {
    const beforeCode = await runAgentstack(["prod", "prepare"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(beforeCode).toBe(0);
    expect(output).toContain("PASS prod prepare production");
    expect(output.join("\n")).not.toContain("FAIL cloud.service.missing");
    expect(output.join("\n")).toContain("Next commands:");
    expect(output.join("\n")).toContain("agentstack prod provision --apply");
    expect(output.join("\n")).toContain("agentstack validate --release production");
  });

  it("fails production prepare when release policy is not locally ready", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.telemetry.environments.production.required = false;
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);

    const code = await runAgentstack(["prod", "prepare"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output).toContain("FAIL prod prepare production");
    expect(output.join("\n")).toContain("FAIL release.telemetry.production-required");
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

  it("fails validation on a raw secret-like value in source without printing the value", async () => {
    await mkdir(join(dir, "apps/web/src"), { recursive: true });
    await writeFile(
      join(dir, "apps/web/src/leak.ts"),
      'export const key = "sk_test_1234567890abcdefghijklmnop";\n',
      "utf8"
    );

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL source.secret.detected");
    expect(output.join("\n")).toContain("Path: apps/web/src/leak.ts");
    expect(output.join("\n")).toContain("Blocks: validate, validate --cloud, deploy");
    expect(output.join("\n")).not.toContain("sk_test_1234567890abcdefghijklmnop");
  });

  it("fails validation on an inline hyphenated OpenAI-style key without printing the value", async () => {
    await mkdir(join(dir, "apps/web/src"), { recursive: true });
    await writeFile(
      join(dir, "apps/web/src/hyphenated-leak.ts"),
      'const openaiKey = "sk-proj-1234567890abcdefghijklmnop";\n',
      "utf8"
    );

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL source.secret.detected");
    expect(output.join("\n")).toContain("Path: apps/web/src/hyphenated-leak.ts");
    expect(output.join("\n")).not.toContain("sk-proj-1234567890abcdefghijklmnop");
  });

  it("ignores secret-like local state under .agentstack during validation", async () => {
    await mkdir(join(dir, ".agentstack"), { recursive: true });
    await writeFile(
      join(dir, ".agentstack", "env-values.json"),
      `${JSON.stringify({ preview: { convex: { OPENAI_API_KEY: "sk_test_1234567890abcdefghijklmnop" } } }, null, 2)}\n`,
      "utf8"
    );

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS validate");
    expect(output.join("\n")).not.toContain("source.secret.detected");
  });

  it("fails validation on a raw secret-like value in .env without printing the value", async () => {
    await writeFile(
      join(dir, ".env"),
      "OPENAI_API_KEY=sk_test_1234567890abcdefghijklmnop\n",
      "utf8"
    );

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL source.secret.detected");
    expect(output.join("\n")).toContain("Path: .env");
    expect(output.join("\n")).not.toContain("sk_test_1234567890abcdefghijklmnop");
  });

  it("blocks deploy on a raw secret-like value in source without printing the value", async () => {
    await mkdir(join(dir, "apps/web/src"), { recursive: true });
    await writeFile(
      join(dir, "apps/web/src/leak.ts"),
      'export const key = "sk_test_1234567890abcdefghijklmnop";\n',
      "utf8"
    );

    const code = await runAgentstack(["deploy", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL source.secret.detected");
    expect(output.join("\n")).toContain("Path: apps/web/src/leak.ts");
    expect(output.join("\n")).toContain("Blocks: validate, validate --cloud, deploy");
    expect(output.join("\n")).not.toContain("sk_test_1234567890abcdefghijklmnop");
    expect(output.join("\n")).not.toContain("deploy.not-implemented");
  });

  it("requires production release readiness before planning production deploys", async () => {
    const code = await runAgentstack(["deploy", "--env", "production"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cloud.service.missing");
    expect(output.join("\n")).not.toContain("PLAN deploy production");
  });

  it("plans production deploy after release validation passes", async () => {
    await runAgentstack(["prod", "provision", "--apply"], { cwd: dir, write: () => undefined });

    const code = await runAgentstack(["deploy", "--env", "production"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS validate --release production");
    expect(output).toContain("PLAN deploy production");
    expect(output).toContain("- planned release production.vercel");
    await expect(stat(join(dir, ".agentstack", "deployments", "production.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("rejects prod as a production environment alias for sync", async () => {
    const code = await runAgentstack(["sync", "--env", "prod"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cli.option.invalid");
    expect(output.join("\n")).toContain("Expected one of: development, preview, production.");
    expect(output.join("\n")).not.toContain("PLAN production");
  });

  it("requires explicit confirmation before applying production deploys", async () => {
    await runAgentstack(["prod", "provision", "--apply"], { cwd: dir, write: () => undefined });

    const applyCode = await runAgentstack(["deploy", "--env", "production", "--apply"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(applyCode).toBe(1);
    expect(output.join("\n")).toContain("FAIL deploy.production-confirmation.required");
    expect(output.join("\n")).not.toContain("APPLIED deploy production");
  });

  it("applies production deploy with explicit confirmation", async () => {
    await runAgentstack(["prod", "provision", "--apply"], { cwd: dir, write: () => undefined });
    output = [];
    const applyCode = await runAgentstack(
      ["deploy", "--env", "production", "--apply", "--confirm-production"],
      {
        cwd: dir,
        write: (line) => output.push(line)
      }
    );

    expect(applyCode).toBe(0);
    expect(output).toContain("APPLIED deploy production");
    expect(output).toContain("- applied release production.vercel");
    await expect(readFile(join(dir, ".agentstack", "deployments", "production.json"), "utf8")).resolves.toContain(
      '"environment": "production"'
    );
  });

  it("rejects development deploy environments with an actionable diagnostic", async () => {
    const code = await runAgentstack(["deploy", "--env", "development"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL deploy.environment.unsupported");
    expect(output.join("\n")).toContain("Path: development");
    expect(output.join("\n")).toContain("Fix: Run agentstack deploy --env preview.");
    expect(output.join("\n")).not.toContain("PLAN deploy development");
  });

  it("plans preview deploy without writing a deployment artifact", async () => {
    const code = await runAgentstack(["deploy", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PLAN deploy preview");
    expect(output).toContain("Evidence: local-rehearsal");
    expect(output).toContain("- planned release preview.vercel");
    await expect(stat(join(dir, ".agentstack", "deployments", "preview.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("does not replan synced provider env resources during deploy", async () => {
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });

    const code = await runAgentstack(["deploy", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PLAN deploy preview");
    expect(output.join("\n")).not.toContain("sync preview.convex");
    expect(output.join("\n")).not.toContain("sk-local-provider-value");
  });

  it("applies preview deploy and writes a deployment artifact", async () => {
    const code = await runAgentstack(["deploy", "--env", "preview", "--apply"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("APPLIED deploy preview");
    expect(output).toContain("Evidence: local-rehearsal");
    expect(output).toContain("- applied release preview.vercel");
    await expect(readFile(join(dir, ".agentstack", "deployments", "preview.json"), "utf8")).resolves.toContain(
      '"environment": "preview"'
    );
  });

  it("records deployment telemetry when deploy completes", async () => {
    expect(
      await runAgentstack(["deploy", "--env", "preview", "--apply"], {
        cwd: dir,
        write: () => undefined
      })
    ).toBe(0);

    const code = await runAgentstack(
      ["observe", "timeline", "--env", "preview", "--journey", "deployment"],
      {
        cwd: dir,
        write: (line) => output.push(line)
      }
    );

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("agentstack.deploy.completed");
    expect(output.join("\n")).toContain("Summary: events=1 errors=0");
    expect(output.join("\n")).toContain("Next queries:");
  });

  it("plans a preview mobile build when EAS is linked", async () => {
    await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });

    const code = await runAgentstack(["build", "mobile", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PLAN mobile build preview");
    expect(output).toContain("Evidence: local-rehearsal");
    expect(output).toContain("- planned eas profile preview distribution internal development-client=no");
    await expect(stat(join(dir, ".agentstack", "builds", "mobile-preview.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("applies a preview mobile build and writes an artifact", async () => {
    await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });

    const code = await runAgentstack(["build", "mobile", "--env", "preview", "--apply"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("APPLIED mobile build preview");
    expect(output).toContain("Evidence: local-rehearsal");
    await expect(readFile(join(dir, ".agentstack", "builds", "mobile-preview.json"), "utf8")).resolves.toContain(
      '"profile": "preview"'
    );
  });

  it("requires EAS cloud state before mobile builds", async () => {
    const code = await runAgentstack(["build", "mobile", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cloud.service.missing");
    expect(output.join("\n")).toContain("Path: preview.eas");
    expect(output.join("\n")).toContain("Fix: Run agentstack sync --env preview --apply.");
  });

  it("requires synced EAS provider env resources before mobile builds", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["mobile"];
    manifest.env.custom.EXPO_PUBLIC_API_URL = {
      surfaces: ["mobile"],
      environments: ["preview"],
      required: true,
      secret: false,
      providerTargets: easPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeLocalEnvValues({
      preview: { mobile: { EXPO_PUBLIC_API_URL: "https://api.example.test" } }
    });
    await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });
    const state = JSON.parse(await readFile(join(dir, ".agentstack", "local-cloud.json"), "utf8")) as {
      envResources?: Array<{ service: string; name: string }>;
    };
    state.envResources = state.envResources?.filter((resource) => resource.name !== "EXPO_PUBLIC_API_URL");
    await writeFile(join(dir, ".agentstack", "local-cloud.json"), `${JSON.stringify(state, null, 2)}\n`);

    const code = await runAgentstack(["build", "mobile", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cloud.env.missing");
    expect(output.join("\n")).toContain("Path: preview.eas.mobile.env.EXPO_PUBLIC_API_URL");
    expect(output.join("\n")).not.toContain("https://api.example.test");
  });

  it("requires production confirmation before applying production mobile builds", async () => {
    await runAgentstack(["sync", "--env", "production", "--apply"], { cwd: dir, write: () => undefined });

    const code = await runAgentstack(["build", "mobile", "--env", "production", "--apply"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL mobile.build.production-confirmation.required");
    expect(output.join("\n")).not.toContain("APPLIED mobile build production");
  });

  it("records mobile build telemetry", async () => {
    await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });
    await runAgentstack(["build", "mobile", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });

    const code = await runAgentstack(
      ["observe", "timeline", "--env", "preview", "--journey", "mobile-build"],
      { cwd: dir, write: (line) => output.push(line) }
    );

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("agentstack.mobile.build.completed");
    expect(output.join("\n")).toContain("Summary: events=1 errors=0");
  });

  it("prints redacted Convex provider command plans", async () => {
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });

    const code = await runAgentstack(["provider", "plan", "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor()
    });

    expect(code).toBe(0);
    expect(output).toContain("PLAN provider convex preview");
    expect(output.join("\n")).toContain("Required env: CONVEX_DEPLOY_KEY");
    expect(output.join("\n")).toContain("pnpm exec convex deploy --preview-name acme-crm-preview");
    expect(output.join("\n")).toContain(
      "pnpm exec convex env --deployment <preview-deployment-name> set OPENAI_API_KEY"
    );
    expect(output.join("\n")).toContain("<secret from .agentstack/env-values.json>");
    expect(output.join("\n")).not.toContain("sk-local-provider-value");
    expect(providerExecutions).toHaveLength(0);
  });

  it("prints invalid ledger advisory for incomplete provider plan decisions", async () => {
    const secretLikeRowId = "sk-plan-incomplete-row-id-12345";
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await writeProviderLedger([
      `| ${secretLikeRowId} | convex | deployment | preview |  | acme-crm-preview |  | Preview backend | Agentstack | 2026-06-21 | Wave 0 complete | planned |  |  |  | |`
    ]);

    const code = await runAgentstack(["provider", "plan", "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor()
    });

    expect(code).toBe(0);
    expect(output).toContain("PLAN provider convex preview");
    expect(output).toContain("Ledger: invalid");
    expect(output.join("\n")).not.toContain(secretLikeRowId);
    expect(output.join("\n")).not.toContain("Ledger: blocked incomplete convex-preview");
  });

  it("prints provider plan ledger status without leaking planned row ids", async () => {
    const secretLikeRowId = "sk-plan-planned-row-id-12345";
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await writeProviderLedger([
      providerLedgerRow({
        id: secretLikeRowId,
        provider: "convex",
        resourceType: "deployment",
        environment: "preview",
        name: "acme-crm-preview",
        status: "planned",
        cleanupCommand: "pnpm exec convex deploy --preview-name acme-crm-preview",
        evidence: "docs/evidence/convex-preview.md"
      })
    ]);

    const code = await runAgentstack(["provider", "plan", "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor()
    });

    expect(code).toBe(0);
    expect(output).toContain("Ledger: planned");
    expect(output.join("\n")).not.toContain(secretLikeRowId);
  });

  it("prints provider plan blocked status without leaking row ids", async () => {
    const secretLikeRowId = "sk-plan-blocked-row-id-12345";
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await writeProviderLedger([
      providerLedgerRow({
        id: secretLikeRowId,
        provider: "convex",
        resourceType: "deployment",
        environment: "preview",
        name: "acme-crm-preview",
        status: "cleanup-pending",
        cleanupCommand: "pnpm exec convex deploy --preview-name acme-crm-preview",
        evidence: "docs/evidence/convex-preview.md"
      })
    ]);

    const code = await runAgentstack(["provider", "plan", "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor()
    });

    expect(code).toBe(0);
    expect(output).toContain("Ledger: blocked cleanup-pending");
    expect(output.join("\n")).not.toContain(secretLikeRowId);
  });

  it("prints explicit confirmation requirements for production Convex provider plans", async () => {
    const code = await runAgentstack(["provider", "plan", "--service", "convex", "--env", "production"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PLAN provider convex production");
    expect(output.join("\n")).toContain("Requires confirmation: yes");
    expect(output.join("\n")).toContain("- backend.deploy [requires-confirmation] pnpm exec convex deploy");
  });

  it("prints redacted Vercel provider command plans", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["web"];
    manifest.env.custom.PUBLIC_URL = {
      surfaces: ["web"],
      environments: ["preview"],
      required: true,
      secret: false,
      providerTargets: vercelPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeLocalEnvValues({
      preview: { web: { PUBLIC_URL: "https://preview.example.test" } }
    });

    const code = await runAgentstack(["provider", "plan", "--service", "vercel", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PLAN provider vercel preview");
    expect(output.join("\n")).toContain("Required env: VERCEL_TOKEN");
    expect(output.join("\n")).toContain("pnpm exec vercel deploy --target=preview");
    expect(output.join("\n")).toContain("pnpm exec vercel env add PUBLIC_URL preview");
    expect(output.join("\n")).toContain("<value from .agentstack/env-values.json>");
    expect(output.join("\n")).not.toContain("https://preview.example.test");
  });

  it("prints explicit confirmation requirements for production Vercel provider plans", async () => {
    const code = await runAgentstack(["provider", "plan", "--service", "vercel", "--env", "production"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PLAN provider vercel production");
    expect(output.join("\n")).toContain("Requires confirmation: yes");
    expect(output.join("\n")).toContain("- web.deploy [requires-confirmation] pnpm exec vercel --prod");
  });

  it("prints redacted EAS provider command plans", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["mobile"];
    manifest.env.custom.EXPO_PUBLIC_API_URL = {
      surfaces: ["mobile"],
      environments: ["preview"],
      required: true,
      secret: false,
      providerTargets: easPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeLocalEnvValues({
      preview: { mobile: { EXPO_PUBLIC_API_URL: "https://api.example.test" } }
    });

    const code = await runAgentstack(["provider", "plan", "--service", "eas", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PLAN provider eas preview");
    expect(output.join("\n")).toContain("Target: preview");
    expect(output.join("\n")).toContain("Required env: EXPO_TOKEN");
    expect(output.join("\n")).toContain("pnpm exec eas project:init --non-interactive");
    expect(output.join("\n")).toContain("pnpm exec eas env:list --environment preview");
    expect(output.join("\n")).toContain("pnpm exec eas build -p all -e preview --json --non-interactive");
    expect(output.join("\n")).toContain("EXPO_PUBLIC_API_URL: <value from .agentstack/env-values.json>");
    expect(output.join("\n")).not.toContain("https://api.example.test");
  });

  it("prints explicit confirmation requirements for production EAS provider plans", async () => {
    const code = await runAgentstack(["provider", "plan", "--service", "eas", "--env", "production"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PLAN provider eas production");
    expect(output.join("\n")).toContain("Requires confirmation: yes");
    expect(output.join("\n")).toContain(
      "- mobile.build [requires-confirmation] pnpm exec eas build -p all -e production --json --non-interactive"
    );
  });

  it("prints redacted Clerk provider command plans", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["web"];
    manifest.env.custom.CLERK_SECRET_KEY = {
      surfaces: ["web"],
      environments: ["preview"],
      required: true,
      secret: true,
      providerTargets: clerkPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeLocalEnvValues({
      preview: { web: { CLERK_SECRET_KEY: "sk_test_local_should_not_print" } }
    });

    const code = await runAgentstack(["provider", "plan", "--service", "clerk", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PLAN provider clerk preview");
    expect(output.join("\n")).toContain("Target: <clerk-development-application>");
    expect(output.join("\n")).toContain("pnpm exec clerk init -y");
    expect(output.join("\n")).toContain("pnpm exec clerk doctor --mode agent");
    expect(output.join("\n")).toContain("pnpm exec clerk env pull --mode agent");
    expect(output.join("\n")).toContain("CLERK_SECRET_KEY: <value from Clerk Dashboard / clerk env pull>");
    expect(output.join("\n")).not.toContain("sk_test_local_should_not_print");
  });

  it("prints explicit confirmation requirements for production Clerk provider plans", async () => {
    const code = await runAgentstack(["provider", "plan", "--service", "clerk", "--env", "production"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PLAN provider clerk production");
    expect(output.join("\n")).toContain("Required env: CLERK_SECRET_KEY");
    expect(output.join("\n")).toContain("Requires confirmation: yes");
    expect(output.join("\n")).toContain(
      "- auth.production.status [requires-confirmation] pnpm exec clerk deploy --mode agent"
    );
  });

  it("rejects provider plan for unsupported services", async () => {
    const code = await runAgentstack(["provider", "plan", "--service", "railway", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.service.unsupported");
  });

  it("inspects Convex preview without raw secrets", async () => {
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });

    const code = await runAgentstack(["provider", "inspect", "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor(
        "OPENAI_API_KEY=provider-owned-secret-value\nSTRIPE_SECRET_KEY=sk_live_not_known_locally"
      )
    });

    expect(code).toBe(0);
    expect(output).toContain("WARN provider inspect convex preview");
    expect(output).toContain("Evidence: live-read");
    expect(output).toContain("Mutation: none");
    expect(output.join("\n")).toContain("Target: <preview-deployment-name>");
    expect(output.join("\n")).toContain("Required env: CONVEX_DEPLOY_KEY");
    expect(output.join("\n")).toContain("Operations: 2");
    expect(output.join("\n")).toContain("Commands: 1");
    expect(output.join("\n")).toContain("Results: 1");
    expect(output.join("\n")).toContain("<redacted provider stdout: 2 lines, 86 bytes>");
    expect(output.join("\n")).not.toContain("sk-local-provider-value");
    expect(output.join("\n")).not.toContain("provider-owned-secret-value");
    expect(output.join("\n")).not.toContain("sk_live_not_known_locally");
    expect(providerExecutions.map((execution) => execution.args.join(" "))).toEqual([
      "exec convex env --deployment <preview-deployment-name> list"
    ]);
  });

  it("inspects Clerk preview with read-only commands and no mutation language", async () => {
    const code = await runAgentstack(["provider", "inspect", "--service", "clerk", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor(
        "CLERK_SECRET_KEY=provider-owned-secret-value\nSTRIPE_SECRET_KEY=sk_live_not_known_locally"
      )
    });

    expect(code).toBe(0);
    expect(output).toContain("WARN provider inspect clerk preview");
    expect(output).toContain("Evidence: live-read");
    expect(output).toContain("Mutation: none");
    expect(output.join("\n")).toContain("Commands: 3");
    expect(output.join("\n")).toContain("Results: 3");
    expect(providerExecutions.map((execution) => execution.args.join(" "))).toEqual([
      "exec clerk doctor --mode agent",
      "exec clerk env pull --mode agent",
      "exec clerk config pull --mode agent"
    ]);
    expect(output.join("\n")).not.toMatch(/\b(init|deploy|set|remove)\b/);
    expect(output.join("\n")).toContain("<redacted provider stdout: 2 lines, 88 bytes>");
    expect(output.join("\n")).not.toContain("provider-owned-secret-value");
    expect(output.join("\n")).not.toContain("sk_live_not_known_locally");
  });

  it("executes EAS preview inspect env-list only", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.surfaces = ["mobile"];
    manifest.env.custom.SENTRY_AUTH_TOKEN = {
      surfaces: ["mobile"],
      environments: ["preview"],
      required: true,
      secret: true,
      providerTargets: easPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeLocalEnvValues({
      preview: { mobile: { SENTRY_AUTH_TOKEN: "local-eas-secret" } }
    });

    const code = await runAgentstack(["provider", "inspect", "--service", "eas", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("SENTRY_AUTH_TOKEN=provider-eas-secret")
    });

    expect(code).toBe(0);
    expect(output).toContain("WARN provider inspect eas preview");
    expect(output).toContain("Evidence: live-read");
    expect(output).toContain("Mutation: none");
    expect(output.join("\n")).toContain("Target: preview");
    expect(output.join("\n")).toContain("Required env: EXPO_TOKEN");
    expect(output.join("\n")).toContain("Operations: 2");
    expect(output.join("\n")).toContain("Commands: 1");
    expect(output.join("\n")).toContain("Results: 1");
    expect(providerExecutions.map((execution) => execution.args.join(" "))).toEqual([
      "exec eas env:list --environment preview"
    ]);
    expect(output.join("\n")).not.toContain("local-eas-secret");
    expect(output.join("\n")).not.toContain("provider-eas-secret");
  });

  it("executes Vercel preview inspect env-list only", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["web"];
    manifest.env.custom.PUBLIC_API_URL = {
      surfaces: ["web"],
      environments: ["preview"],
      required: true,
      secret: true,
      providerTargets: vercelPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeLocalEnvValues({
      preview: { web: { PUBLIC_API_URL: "local-vercel-secret" } }
    });

    const vercelCode = await runAgentstack(
      ["provider", "inspect", "--service", "vercel", "--env", "preview"],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor(
          "PUBLIC_API_URL=provider-vercel-secret\nVERCEL_TOKEN=vercel-token-secret"
        )
      }
    );

    expect(vercelCode).toBe(0);
    expect(output).toContain("WARN provider inspect vercel preview");
    expect(output).toContain("Evidence: live-read");
    expect(output).toContain("Mutation: none");
    expect(output.join("\n")).toContain("Target: preview");
    expect(output.join("\n")).toContain("Required env: VERCEL_TOKEN");
    expect(output.join("\n")).toContain("Operations: 2");
    expect(output.join("\n")).toContain("Commands: 1");
    expect(output.join("\n")).toContain("Results: 1");
    expect(providerExecutions.map((execution) => execution.args.join(" "))).toEqual([
      "exec vercel env ls preview"
    ]);
    expect(providerExecutions.map((execution) => execution.args.join(" ")).join("\n")).not.toMatch(
      /\b(deploy|add|update|remove|rm)\b/
    );
    expect(output.join("\n")).toContain("<redacted provider stdout:");
    expect(output.join("\n")).not.toContain("local-vercel-secret");
    expect(output.join("\n")).not.toContain("provider-vercel-secret");
    expect(output.join("\n")).not.toContain("vercel-token-secret");
  });

  it("does not classify Vercel preview inspect executor failures as unsupported", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["web"];
    manifest.env.custom.PUBLIC_API_URL = {
      surfaces: ["web"],
      environments: ["preview"],
      required: true,
      secret: true,
      providerTargets: vercelPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeLocalEnvValues({
      preview: { web: { PUBLIC_API_URL: "local-vercel-secret" } }
    });

    const vercelCode = await runAgentstack(
      ["provider", "inspect", "--service", "vercel", "--env", "preview"],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: {
          async execute(command, args) {
            providerExecutions.push({ command, args });
            throw new Error("vercel cli unavailable: VERCEL_TOKEN=local-vercel-secret");
          }
        }
      }
    );

    expect(vercelCode).toBe(1);
    expect(output.join("\n")).not.toContain("provider.inspect.unsupported");
    expect(output.join("\n")).not.toContain("unsupported environment");
    expect(output.join("\n")).not.toContain("unsupported-environment");
    expect(output.join("\n")).toContain("FAIL provider.inspect.execution");
    expect(output.join("\n")).toContain("vercel cli unavailable");
    expect(output.join("\n")).not.toContain("local-vercel-secret");
    expect(providerExecutions.map((execution) => execution.args.join(" "))).toEqual([
      "exec vercel env ls preview"
    ]);
  });

  it("does not mutate the provider ledger during Vercel preview inspect", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["web"];
    manifest.env.custom.PUBLIC_API_URL = {
      surfaces: ["web"],
      environments: ["preview"],
      required: true,
      secret: true,
      providerTargets: vercelPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeLocalEnvValues({
      preview: { web: { PUBLIC_API_URL: "local-vercel-secret" } }
    });
    await writeProviderLedger([
      providerLedgerRow({
        id: "vercel-preview-web",
        provider: "vercel",
        resourceType: "project",
        environment: "preview",
        name: "acme-crm-preview",
        status: "planned",
        cleanupCommand: "vercel remove acme-crm-preview",
        evidence: "docs/evidence/vercel-preview.md"
      })
    ]);
    const ledgerPath = join(dir, "docs", "provider-resource-ledger.md");
    const before = await readFile(ledgerPath);

    const vercelCode = await runAgentstack(
      ["provider", "inspect", "--service", "vercel", "--env", "preview"],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor("PUBLIC_API_URL=provider-vercel-secret")
      }
    );

    expect(vercelCode).toBe(0);
    await expect(readFile(ledgerPath)).resolves.toEqual(before);
  });

  it("rejects Vercel production inspect without executing", async () => {
    const vercelCode = await runAgentstack(
      ["provider", "inspect", "--service", "vercel", "--env", "production"],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor()
      }
    );

    expect(vercelCode).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.inspect.unsupported");
    expect(output.join("\n")).toContain("Vercel runtime inspect supports preview env-list only");
    expect(providerExecutions).toEqual([]);
  });

  it("rejects development env for provider inspect and apply", async () => {
    const inspectCode = await runAgentstack(
      ["provider", "inspect", "--service", "convex", "--env", "development"],
      { cwd: dir, write: (line) => output.push(line), providerExecutor: createMockProviderExecutor() }
    );
    const applyCode = await runAgentstack(
      ["provider", "apply", "--service", "convex", "--env", "development"],
      { cwd: dir, write: (line) => output.push(line), providerExecutor: createMockProviderExecutor() }
    );

    expect(inspectCode).toBe(1);
    expect(applyCode).toBe(1);
    expect(output.join("\n")).toContain("FAIL cli.option.invalid");
    expect(output.join("\n")).toContain("Expected one of: preview, production.");
  });

  it("blocks Convex preview apply when the provider ledger is missing the deployment row", async () => {
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await writeProviderLedger([]);

    const code = await runAgentstack(["provider", "apply", "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("set OPENAI_API_KEY=sk-local-provider-value")
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.ledger.missing");
    expect(output.join("\n")).toContain("Path: docs/provider-resource-ledger.md");
    expect(output.join("\n")).toContain("Blocks: provider apply");
    expect(output.join("\n")).toContain("convex preview deployment acme-crm-preview");
    expect(providerExecutions).toHaveLength(0);
  });

  it("blocks Convex preview apply without leaking malformed provider ledger row contents", async () => {
    const secretLikeValue = "sk-test-no-leak-12345";
    const malformedRow = `| convex-preview | convex | deployment | preview | Platform | ${secretLikeValue} |`;
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await writeProviderLedger([malformedRow]);

    const code = await runAgentstack(["provider", "apply", "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("set OPENAI_API_KEY=sk-local-provider-value")
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.ledger.invalid");
    expect(output.join("\n")).not.toContain(secretLikeValue);
    expect(output.join("\n")).not.toContain(malformedRow);
    expect(providerExecutions).toHaveLength(0);
  });

  it("blocks Convex preview apply when the provider ledger row is cleanup-pending", async () => {
    const secretLikeRowId = "sk-apply-blocked-row-id-12345";
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await writeProviderLedger([
      providerLedgerRow({
        id: secretLikeRowId,
        provider: "convex",
        resourceType: "deployment",
        environment: "preview",
        name: "acme-crm-preview",
        status: "cleanup-pending",
        cleanupCommand: "pnpm exec convex deploy --preview-name acme-crm-preview",
        evidence: "docs/evidence/convex-preview.md"
      })
    ]);

    const code = await runAgentstack(["provider", "apply", "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("set OPENAI_API_KEY=sk-local-provider-value")
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.ledger.status-blocked");
    expect(output.join("\n")).toContain("Status: cleanup-pending");
    expect(output.join("\n")).toContain("Fix:");
    expect(output.join("\n")).not.toContain(secretLikeRowId);
    expect(providerExecutions).toHaveLength(0);
  });

  it("blocks Convex preview apply with human ledger field labels when the row is incomplete", async () => {
    const secretLikeRowId = "sk-apply-incomplete-row-id-12345";
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await writeProviderLedger([
      `| ${secretLikeRowId} | convex | deployment | preview |  | acme-crm-preview |  | Preview backend | Agentstack | 2026-06-21 | Wave 0 complete | planned |  |  |  | |`
    ]);

    const code = await runAgentstack(["provider", "apply", "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("set OPENAI_API_KEY=sk-local-provider-value")
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.ledger.incomplete");
    expect(output.join("\n")).toContain("owner account/project");
    expect(output.join("\n")).toContain("cleanup command/procedure");
    expect(output.join("\n")).toContain("evidence link/path");
    expect(output.join("\n")).not.toContain("ownerAccountOrProject");
    expect(output.join("\n")).not.toContain("cleanupCommandOrProcedure");
    expect(output.join("\n")).not.toContain("evidenceLinkOrPath");
    expect(output.join("\n")).not.toContain(secretLikeRowId);
    expect(providerExecutions).toHaveLength(0);
  });

  it("allows Convex preview apply when the provider ledger has a planned deployment row", async () => {
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await writeProviderLedger([
      providerLedgerRow({
        id: "convex-preview",
        provider: "convex",
        resourceType: "deployment",
        environment: "preview",
        name: "acme-crm-preview",
        status: "planned",
        cleanupCommand: "pnpm exec convex deploy --preview-name acme-crm-preview",
        evidence: "docs/evidence/convex-preview.md"
      })
    ]);

    const code = await runAgentstack(["provider", "apply", "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("set OPENAI_API_KEY=sk-local-provider-value")
    });

    expect(code).toBe(0);
    expect(output).toContain("APPLIED provider convex preview");
    expect(output.join("\n")).toContain("Evidence: live-mutation");
    expect(output.join("\n")).toContain("Mutation scope: bounded provider executor");
    expect(providerExecutions).toHaveLength(2);
  });

  it("allows Vercel preview deploy when the provider ledger has a planned project row", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.surfaces = ["web"];
    manifest.env.custom.API_TOKEN = {
      surfaces: ["web"],
      environments: ["preview"],
      required: true,
      secret: true,
      providerTargets: vercelPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeLocalEnvValues({
      preview: { web: { API_TOKEN: "local-vercel-secret" } }
    });
    await writeProviderLedger([
      providerLedgerRow({
        id: "vercel-preview",
        provider: "vercel",
        resourceType: "project",
        environment: "preview",
        name: "acme-crm",
        status: "planned",
        purpose: "Preview web app",
        cleanupCommand: "pnpm exec vercel deploy --target=preview",
        evidence: "docs/evidence/vercel-preview.md"
      })
    ]);

    const code = await runAgentstack(["provider", "apply", "--service", "vercel", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("deployed with API_TOKEN=provider-vercel-secret")
    });

    expect(code).toBe(0);
    expect(output).toContain("APPLIED provider vercel preview");
    expect(output.join("\n")).toContain("Evidence: live-mutation");
    expect(providerExecutions.map((execution) => execution.args.join(" "))).toEqual([
      "exec vercel deploy --target=preview"
    ]);
  });

  it("applies Convex preview through the injected executor with redacted output", async () => {
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await writeProviderLedger([
      providerLedgerRow({
        id: "convex-preview",
        provider: "convex",
        resourceType: "deployment",
        environment: "preview",
        name: "acme-crm-preview",
        status: "planned",
        cleanupCommand: "pnpm exec convex deploy --preview-name acme-crm-preview",
        evidence: "docs/evidence/convex-preview.md"
      })
    ]);

    const code = await runAgentstack(["provider", "apply", "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("set OPENAI_API_KEY=sk-local-provider-value")
    });

    expect(code).toBe(0);
    expect(output).toContain("APPLIED provider convex preview");
    expect(output.join("\n")).toContain("Commands: 2");
    expect(output.join("\n")).toContain("Results: 2");
    expect(output.join("\n")).toContain("<redacted provider stdout: 1 line, 42 bytes>");
    expect(output.join("\n")).not.toContain("sk-local-provider-value");
    expect(providerExecutions).toHaveLength(2);
    expect(providerExecutions[1]?.stdin).toBe("sk-local-provider-value");
  });

  it("applies Vercel preview deploy only through the injected executor with redacted output", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.surfaces = ["web"];
    manifest.env.custom.API_TOKEN = {
      surfaces: ["web"],
      environments: ["preview"],
      required: true,
      secret: true,
      providerTargets: vercelPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeLocalEnvValues({
      preview: { web: { API_TOKEN: "local-vercel-secret" } }
    });
    await writeProviderLedger([
      providerLedgerRow({
        id: "vercel-preview",
        provider: "vercel",
        resourceType: "project",
        environment: "preview",
        name: "acme-crm",
        status: "planned",
        purpose: "Preview web app",
        cleanupCommand: "pnpm exec vercel deploy --target=preview",
        evidence: "docs/evidence/vercel-preview.md"
      })
    ]);

    const code = await runAgentstack(["provider", "apply", "--service", "vercel", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("deployed with API_TOKEN=provider-vercel-secret")
    });

    expect(code).toBe(0);
    expect(output).toContain("APPLIED provider vercel preview");
    expect(output.join("\n")).toContain("Operations: 2");
    expect(output.join("\n")).toContain("Commands: 1");
    expect(output.join("\n")).toContain("Results: 1");
    expect(providerExecutions.map((execution) => execution.args.join(" "))).toEqual([
      "exec vercel deploy --target=preview"
    ]);
    expect(output.join("\n")).not.toContain("local-vercel-secret");
    expect(output.join("\n")).not.toContain("provider-vercel-secret");
  });

  it("rejects Clerk apply in this slice", async () => {
    const code = await runAgentstack(["provider", "apply", "--service", "clerk", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor()
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.apply.unsupported");
    expect(output.join("\n")).toContain("Fix:");
  });

  it("rejects EAS apply and Vercel production apply without executing", async () => {
    const easCode = await runAgentstack(["provider", "apply", "--service", "eas", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor()
    });
    const vercelProductionCode = await runAgentstack(
      ["provider", "apply", "--service", "vercel", "--env", "production", "--confirm-production"],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor()
      }
    );

    expect(easCode).toBe(1);
    expect(vercelProductionCode).toBe(1);
    expect(providerExecutions).toHaveLength(0);
    expect(output.join("\n")).toContain("EAS apply is not available in this slice");
    expect(output.join("\n")).toContain("Vercel runtime apply supports preview deploy only");
  });

  it("rejects production Convex apply without confirmation", async () => {
    const code = await runAgentstack(["provider", "apply", "--service", "convex", "--env", "production"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor()
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.production.confirmation-required");
    expect(output.join("\n")).toContain("Fix:");
    expect(providerExecutions).toHaveLength(0);
  });

  it("applies production Convex with confirmation through the executor and redacts output", async () => {
    await writeProviderLedger([
      providerLedgerRow({
        id: "convex-production",
        provider: "convex",
        resourceType: "deployment",
        environment: "production",
        name: "prod",
        status: "planned",
        purpose: "Production backend",
        cleanupCommand: "pnpm exec convex deploy --prod",
        evidence: "docs/evidence/convex-production.md"
      })
    ]);

    const code = await runAgentstack(
      ["provider", "apply", "--service", "convex", "--env", "production", "--confirm-production"],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor("deployed CONVEX_DEPLOY_KEY=prod_secret")
      }
    );

    expect(code).toBe(0);
    expect(output).toContain("APPLIED provider convex production");
    expect(output.join("\n")).toContain("Commands: 1");
    expect(output.join("\n")).toContain("Results: 1");
    expect(output.join("\n")).toContain("<redacted provider stdout: 1 line, 38 bytes>");
    expect(providerExecutions).toHaveLength(1);
  });

  it("records provider inspect and apply telemetry", async () => {
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await writeProviderLedger([
      providerLedgerRow({
        id: "convex-preview",
        provider: "convex",
        resourceType: "deployment",
        environment: "preview",
        name: "acme-crm-preview",
        status: "planned",
        cleanupCommand: "pnpm exec convex deploy --preview-name acme-crm-preview",
        evidence: "docs/evidence/convex-preview.md"
      })
    ]);

    expect(
      await runAgentstack(["provider", "inspect", "--service", "convex", "--env", "preview"], {
        cwd: dir,
        write: () => undefined,
        providerExecutor: createMockProviderExecutor()
      })
    ).toBe(0);
    expect(
      await runAgentstack(["provider", "apply", "--service", "convex", "--env", "preview"], {
        cwd: dir,
        write: () => undefined,
        providerExecutor: createMockProviderExecutor()
      })
    ).toBe(0);

    const code = await runAgentstack(["observe", "timeline", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("agentstack.provider.inspect.completed");
    expect(output.join("\n")).toContain("agentstack.provider.apply.completed");
  });

  it("renders provider inventory from ledger-local state without leaking row ids or external ids", async () => {
    const rowId = "row-secret-inventory-123";
    const externalId = "https://dashboard.convex.dev/d/acme-secret-preview";
    await writeProviderLedger([
      providerLedgerRow({
        id: rowId,
        provider: "convex",
        resourceType: "deployment",
        environment: "preview",
        name: "acme-crm-preview",
        status: "active",
        externalId,
        cleanupCommand: "delete through Convex dashboard",
        evidence: "docs/evidence/convex-preview.md"
      })
    ]);

    const code = await runAgentstack(["provider", "inventory", "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("live-read should not run")
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS provider inventory convex preview");
    expect(output).toContain("Evidence: ledger-local-inventory");
    expect(output).toContain("Mutation: none");
    expect(output.join("\n")).toContain(
      "Resource: convex preview deployment acme-crm-preview ledger=active local-link=missing external-id=redacted evidence=ledger"
    );
    expect(output.join("\n")).not.toContain(rowId);
    expect(output.join("\n")).not.toContain(externalId);
    expect(output.join("\n")).not.toContain("live-read");
    await expect(readFile(join(dir, ".agentstack", "events.jsonl"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    expect(providerExecutions).toHaveLength(0);
  });

  it("renders live provider inventory from read-only inspect results without writing local state", async () => {
    const rowId = "row-secret-live-inventory-123";
    const externalId = "https://dashboard.convex.dev/d/live-secret-preview";
    await writeProviderLedger([
      providerLedgerRow({
        id: rowId,
        provider: "convex",
        resourceType: "deployment",
        environment: "preview",
        name: "acme-crm-preview",
        status: "active",
        externalId,
        cleanupCommand: "delete through Convex dashboard",
        evidence: "docs/evidence/convex-preview.md"
      })
    ]);
    const ledgerPath = join(dir, "docs", "provider-resource-ledger.md");
    const ledgerBefore = await readFile(ledgerPath, "utf8");

    const code = await runAgentstack(["provider", "inventory", "--service", "convex", "--env", "preview", "--source", "live"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("LIVE_PROVIDER_ID=raw-secret-provider-id")
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS provider inventory convex preview");
    expect(output).toContain("Evidence: live-read-inventory");
    expect(output).toContain("Mutation: none");
    expect(output.join("\n")).toContain("Commands: 1");
    expect(output.join("\n")).toContain("Results: 1");
    expect(output.join("\n")).toContain("live=unknown identity=ambiguous identity-scope=none permission=read-ok drift=unknown");
    expect(output.join("\n")).not.toContain(rowId);
    expect(output.join("\n")).not.toContain(externalId);
    expect(output.join("\n")).not.toContain("raw-secret-provider-id");
    expect(providerExecutions.map((execution) => execution.args.join(" "))).toEqual([
      "exec convex env --deployment <preview-deployment-name> list"
    ]);
    await expect(readFile(join(dir, ".agentstack", "provider-links.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(readFile(join(dir, ".agentstack", "events.jsonl"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    expect(await readFile(ledgerPath, "utf8")).toBe(ledgerBefore);
  });

  it("renders sanitized partial Vercel preview live identity facts without leaking raw output", async () => {
    const code = await runAgentstack(["provider", "inventory", "--service", "vercel", "--env", "preview", "--source", "live"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor(
        [
          "name value environments",
          "NEXT_PUBLIC_APP_URL https://redacted.example.test preview",
          "API_TOKEN Encrypted preview",
          "Project: prj_secret"
        ].join("\n")
      )
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS provider inventory vercel preview");
    expect(output.join("\n")).toContain(
      "live=found identity=ambiguous identity-scope=partial permission=read-ok drift=unknown facts=env-list-read,expected-env-names,preview-environment"
    );
    expect(output.join("\n")).not.toContain("NEXT_PUBLIC_APP_URL");
    expect(output.join("\n")).not.toContain("API_TOKEN");
    expect(output.join("\n")).not.toContain("https://redacted.example.test");
    expect(output.join("\n")).not.toContain("prj_secret");
    expect(providerExecutions.map((execution) => execution.args.join(" "))).toEqual([
      "exec vercel env ls preview"
    ]);
  });

  it("renders sanitized partial EAS preview live identity facts without exact identity", async () => {
    const code = await runAgentstack(["provider", "inventory", "--service", "eas", "--env", "preview", "--source", "live"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor(
        "Environment: preview\nSENTRY_AUTH_TOKEN=secret-eas-token\nProject ID: eas-secret-project-id"
      )
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS provider inventory eas preview");
    expect(output.join("\n")).toContain(
      "live=found identity=ambiguous identity-scope=partial permission=read-ok drift=unknown facts=env-list-read,expected-env-names,preview-environment"
    );
    expect(output.join("\n")).not.toContain("SENTRY_AUTH_TOKEN");
    expect(output.join("\n")).not.toContain("secret-eas-token");
    expect(output.join("\n")).not.toContain("eas-secret-project-id");
    expect(output.join("\n")).not.toContain("identity=matched");
    expect(providerExecutions.map((execution) => execution.args.join(" "))).toEqual([
      "exec eas env:list --environment preview"
    ]);
  });

  it("supports --live as provider inventory shorthand", async () => {
    const code = await runAgentstack(["provider", "inventory", "--service", "eas", "--env", "preview", "--live"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("EXPO_TOKEN=secret-eas-token")
    });

    expect(code).toBe(0);
    expect(output).toContain("Evidence: live-read-inventory");
    expect(output.join("\n")).toContain("Commands: 1");
    expect(providerExecutions.map((execution) => execution.args.join(" "))).toEqual([
      "exec eas env:list --environment preview"
    ]);
    expect(output.join("\n")).not.toContain("secret-eas-token");
  });

  it("fails live provider inventory when a read-only provider command fails", async () => {
    const code = await runAgentstack(["provider", "inventory", "--service", "clerk", "--env", "preview", "--source", "live"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: {
        async execute(command, args) {
          providerExecutions.push({ command, args });
          return {
            exitCode: 1,
            stdout: "",
            stderr: "unauthorized CLERK_SECRET_KEY=sk_live_secret_should_not_leak",
            durationMs: 12
          };
        }
      }
    });

    expect(code).toBe(1);
    expect(output).toContain("FAIL provider inventory clerk preview");
    expect(output).not.toContain("PASS provider inventory clerk preview");
    expect(output).toContain("Evidence: live-read-inventory");
    expect(output).toContain("Mutation: none");
    expect(output.join("\n")).toContain("Commands: 3");
    expect(output.join("\n")).toContain("Results: 3");
    expect(output.join("\n")).toContain("Failed: 3");
    expect(output.join("\n")).toContain("live=auth-failed identity=ambiguous identity-scope=none permission=read-failed drift=unknown");
    expect(output.join("\n")).not.toContain("sk_live_secret_should_not_leak");
  });

  it("rejects unsupported provider inventory source values before executor use", async () => {
    const code = await runAgentstack(["provider", "inventory", "--service", "convex", "--env", "preview", "--source", "remote"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("live-read should not run")
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.inventory.validation");
    expect(output.join("\n")).toContain("Unsupported provider inventory source: remote");
    expect(providerExecutions).toHaveLength(0);
  });

  it("rejects live Vercel and EAS production inventory before executor use", async () => {
    for (const service of ["vercel", "eas"] as const) {
      output = [];
      providerExecutions = [];
      const code = await runAgentstack(["provider", "inventory", "--service", service, "--env", "production", "--source", "live"], {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor("live-read should not run")
      });

      expect(code).toBe(1);
      expect(output.join("\n")).toContain("FAIL provider.inventory.unsupported");
      expect(output.join("\n")).toContain(`${service === "vercel" ? "Vercel" : "EAS"} live inventory supports preview read-only inspect only`);
      expect(providerExecutions).toHaveLength(0);
    }
  });

  it("blocks provider inventory malformed ledger rows with inventory-specific diagnostics", async () => {
    const malformedValue = "malformed-inventory-row-value";
    const malformedRow = `| convex-preview | convex | deployment | preview | Platform | ${malformedValue} |`;
    await writeProviderLedger([malformedRow]);

    const code = await runAgentstack(["provider", "inventory", "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("live-read should not run")
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.ledger.invalid");
    expect(output.join("\n")).toContain("Blocks: provider inventory");
    expect(output.join("\n")).not.toContain("Blocks: provider apply");
    expect(output.join("\n")).not.toContain("before running provider apply");
    expect(output.join("\n")).not.toContain(malformedValue);
    expect(output.join("\n")).not.toContain(malformedRow);
    await expect(readFile(join(dir, ".agentstack", "events.jsonl"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    expect(providerExecutions).toHaveLength(0);
  });

  it("blocks provider inventory local validation failures without telemetry writes", async () => {
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await rm(join(dir, "convex/schema.ts"));

    const code = await runAgentstack(["provider", "inventory", "--service", "convex", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("live-read should not run")
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL template.anchor.missing");
    expect(output.join("\n")).toContain("Path: convex/schema.ts");
    await expect(readFile(join(dir, ".agentstack", "events.jsonl"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    expect(providerExecutions).toHaveLength(0);
  });

  it("links planned provider ledger rows into provider-links state only without leaking identifiers", async () => {
    const rowId = "row-link-secret-123";
    const externalId = "convex-preview-secret-external-id";
    await writeProviderLedger([
      providerLedgerRow({
        id: rowId,
        provider: "convex",
        resourceType: "deployment",
        environment: "preview",
        name: "acme-crm-preview",
        status: "planned",
        externalId,
        cleanupCommand: "delete through Convex dashboard",
        evidence: "docs/evidence/convex-preview.md"
      })
    ]);
    const ledgerBefore = await readFile(join(dir, "docs", "provider-resource-ledger.md"), "utf8");

    const code = await runAgentstack(
      [
        "provider",
        "link",
        "--service",
        "convex",
        "--env",
        "preview",
        "--resource-type",
        "deployment",
        "--name",
        "acme-crm-preview"
      ],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor("live-read should not run")
      }
    );

    expect(code).toBe(0);
    expect(output).toContain("LINKED provider convex preview");
    expect(output).toContain("Evidence: ledger-local-inventory");
    expect(output).toContain("Local mutation: .agentstack/provider-links.json");
    expect(output).toContain("Provider mutation: none");
    expect(output).toContain("Ledger mutation: none");
    expect(output.join("\n")).not.toContain(rowId);
    expect(output.join("\n")).not.toContain(externalId);
    expect(await readFile(join(dir, "docs", "provider-resource-ledger.md"), "utf8")).toBe(ledgerBefore);
    const linkState = await readFile(join(dir, ".agentstack", "provider-links.json"), "utf8");
    expect(linkState).toContain("acme-crm-preview");
    expect(linkState).not.toContain(rowId);
    expect(linkState).not.toContain(externalId);
    await expect(readFile(join(dir, ".agentstack", "events.jsonl"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    expect(providerExecutions).toHaveLength(0);
  });

  it("keeps default provider link local with explicit mutation boundaries and zero provider executors", async () => {
    await writeProviderLedger([
      providerLedgerRow({
        id: "row-convex-local-link-boundary",
        provider: "convex",
        resourceType: "deployment",
        environment: "preview",
        name: "acme-crm-preview",
        status: "active",
        externalId: "convex-preview-secret-external-id",
        cleanupCommand: "delete through Convex dashboard",
        evidence: "docs/evidence/convex-preview.md"
      })
    ]);

    const code = await runAgentstack(
      [
        "provider",
        "link",
        "--service",
        "convex",
        "--env",
        "preview",
        "--resource-type",
        "deployment",
        "--name",
        "acme-crm-preview"
      ],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor("live-read should not run")
      }
    );

    expect(code).toBe(0);
    expect(output).toContain("Evidence: ledger-local-inventory");
    expect(output).toContain("Local mutation: .agentstack/provider-links.json");
    expect(output).toContain("Provider mutation: none");
    expect(output).toContain("Ledger mutation: none");
    expect(providerExecutions).toHaveLength(0);
  });

  it("blocks provider link local validation failures without provider-links or telemetry writes", async () => {
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await rm(join(dir, "convex/schema.ts"));

    const code = await runAgentstack(
      [
        "provider",
        "link",
        "--service",
        "convex",
        "--env",
        "preview",
        "--resource-type",
        "deployment",
        "--name",
        "acme-crm-preview"
      ],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor("live-read should not run")
      }
    );

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL template.anchor.missing");
    expect(output.join("\n")).toContain("Path: convex/schema.ts");
    await expect(readFile(join(dir, ".agentstack", "provider-links.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(readFile(join(dir, ".agentstack", "events.jsonl"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    expect(providerExecutions).toHaveLength(0);
  });

  it("blocks provider link without a ledger row and does not write provider-links state", async () => {
    await writeProviderLedger([]);

    const code = await runAgentstack(
      [
        "provider",
        "link",
        "--service",
        "vercel",
        "--env",
        "preview",
        "--resource-type",
        "project",
        "--name",
        "acme-crm"
      ],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor("live-read should not run")
      }
    );

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.ledger.missing");
    expect(output.join("\n")).toContain("No provider ledger row matches vercel preview project acme-crm.");
    expect(output.join("\n")).toContain("Blocks: provider link");
    expect(output.join("\n")).not.toContain("Blocks: provider apply");
    expect(output.join("\n")).not.toContain("before running provider apply");
    await expect(readFile(join(dir, ".agentstack", "provider-links.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(readFile(join(dir, ".agentstack", "events.jsonl"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    expect(providerExecutions).toHaveLength(0);
  });

  it("rejects unsupported provider link source before executor use", async () => {
    const code = await runAgentstack(
      [
        "provider",
        "link",
        "--service",
        "convex",
        "--env",
        "preview",
        "--resource-type",
        "deployment",
        "--name",
        "acme-crm-preview",
        "--source",
        "remote"
      ],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor("live-read should not run")
      }
    );

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.link.validation");
    expect(providerExecutions).toHaveLength(0);

    output = [];
    providerExecutions = [];
    const shorthand = await runAgentstack(
      [
        "provider",
        "link",
        "--service",
        "convex",
        "--env",
        "preview",
        "--resource-type",
        "deployment",
        "--name",
        "acme-crm-preview",
        "--live"
      ],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor("live-read should not run")
      }
    );
    expect(shorthand).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.link.validation");
    expect(providerExecutions).toHaveLength(0);
  });

  it("fails provider link live confirmation on partial preview evidence without writing files", async () => {
    await writeProviderLedger([
      providerLedgerRow({
        id: "row-vercel-live-link-ambiguous",
        provider: "vercel",
        resourceType: "project",
        environment: "preview",
        name: "acme-crm",
        status: "active",
        externalId: "vercel-preview-secret-external-id",
        cleanupCommand: "delete through Vercel dashboard",
        evidence: "docs/evidence/vercel-preview.md"
      })
    ]);
    const ledgerBefore = await readFile(join(dir, "docs", "provider-resource-ledger.md"), "utf8");

    const code = await runAgentstack(
      [
        "provider",
        "link",
        "--service",
        "vercel",
        "--env",
        "preview",
        "--resource-type",
        "project",
        "--name",
        "acme-crm",
        "--source",
        "live"
      ],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor(
          [
            "name value environments",
            "NEXT_PUBLIC_APP_URL https://secret.example.test preview",
            "API_TOKEN Encrypted preview",
            "Project: prj_secret"
          ].join("\n")
        )
      }
    );

    expect(code).toBe(1);
    expect(output).toContain("FAIL provider.link.identity-ambiguous");
    expect(output).toContain("Evidence: live-read-inventory");
    expect(output).toContain("Local mutation: none");
    expect(output).toContain("Provider mutation: none");
    expect(output).toContain("Ledger mutation: none");
    expect(output.join("\n")).toContain("facts=env-list-read,expected-env-names,preview-environment");
    expect(output.join("\n")).not.toContain("NEXT_PUBLIC_APP_URL");
    expect(output.join("\n")).not.toContain("prj_secret");
    expect(providerExecutions.map((execution) => execution.args.join(" "))).toEqual(["exec vercel env ls preview"]);
    await expect(readFile(join(dir, ".agentstack", "provider-links.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(readFile(join(dir, ".agentstack", "events.jsonl"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(dir, ".agentstack", "local-cloud.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(join(dir, "docs", "provider-resource-ledger.md"), "utf8")).toBe(ledgerBefore);
  });

  it("blocks provider link live source on missing ledger before executor use", async () => {
    await writeProviderLedger([]);

    const code = await runAgentstack(
      [
        "provider",
        "link",
        "--service",
        "vercel",
        "--env",
        "preview",
        "--resource-type",
        "project",
        "--name",
        "acme-crm",
        "--source",
        "live"
      ],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor("live-read should not run")
      }
    );

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.ledger.missing");
    expect(providerExecutions).toHaveLength(0);
    await expect(readFile(join(dir, ".agentstack", "provider-links.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("rejects live Vercel and EAS production link before executor use", async () => {
    for (const service of ["vercel", "eas"] as const) {
      output = [];
      providerExecutions = [];
      const code = await runAgentstack(
        [
          "provider",
          "link",
          "--service",
          service,
          "--env",
          "production",
          "--resource-type",
          "project",
          "--name",
          "acme-crm",
          "--source",
          "live"
        ],
        {
          cwd: dir,
          write: (line) => output.push(line),
          providerExecutor: createMockProviderExecutor("live-read should not run")
        }
      );

      expect(code).toBe(1);
      expect(output.join("\n")).toContain("FAIL provider.link.unsupported");
      expect(providerExecutions).toHaveLength(0);
    }
  });

  it("prints provider adopt proposals without mutating ledger, provider-links, telemetry, or leaking external ids", async () => {
    const externalId = "sk_live_secret_adopt_123456";
    await writeProviderLedger([]);
    const ledgerBefore = await readFile(join(dir, "docs", "provider-resource-ledger.md"), "utf8");

    const code = await runAgentstack(
      [
        "provider",
        "adopt",
        "--service",
        "clerk",
        "--env",
        "production",
        "--resource-type",
        "application",
        "--name",
        "acme-crm",
        "--external-id",
        externalId,
        "--owner",
        "cardinal",
        "--purpose",
        "production auth application",
        "--created-by",
        "jc",
        "--created-at",
        "2026-06-21",
        "--cleanup",
        "delete through Clerk dashboard",
        "--cleanup-trigger",
        "project retirement",
        "--evidence",
        "docs/evidence/clerk-production.md",
        "--notes",
        "existing resource"
      ],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor("live-read should not run")
      }
    );

    expect(code).toBe(0);
    expect(output).toContain("PROPOSED provider adopt clerk production");
    expect(output).toContain("Evidence: local-inventory");
    expect(output).toContain("Local mutation: none");
    expect(output).toContain("Provider mutation: none");
    expect(output).toContain("Ledger mutation: none");
    expect(output.join("\n")).toContain("Provider ledger proposal");
    expect(output.join("\n")).toContain("external id/url: redacted");
    expect(output.join("\n")).not.toContain(externalId);
    expect(await readFile(join(dir, "docs", "provider-resource-ledger.md"), "utf8")).toBe(ledgerBefore);
    await expect(readFile(join(dir, ".agentstack", "provider-links.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(readFile(join(dir, ".agentstack", "events.jsonl"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    expect(providerExecutions).toHaveLength(0);
  });

  it("keeps default provider adopt local and print-only with explicit mutation boundaries", async () => {
    const code = await runAgentstack(
      [
        "provider",
        "adopt",
        "--service",
        "clerk",
        "--env",
        "production",
        "--resource-type",
        "application",
        "--name",
        "acme-crm",
        "--external-id",
        "sk_live_secret_adopt_123456",
        "--owner",
        "cardinal",
        "--purpose",
        "production auth application",
        "--created-by",
        "jc",
        "--created-at",
        "2026-06-21",
        "--cleanup",
        "delete through Clerk dashboard",
        "--cleanup-trigger",
        "project retirement",
        "--evidence",
        "docs/evidence/clerk-production.md"
      ],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor("live-read should not run")
      }
    );

    expect(code).toBe(0);
    expect(output).toContain("Evidence: local-inventory");
    expect(output).toContain("Local mutation: none");
    expect(output).toContain("Provider mutation: none");
    expect(output).toContain("Ledger mutation: none");
    expect(providerExecutions).toHaveLength(0);
  });

  it("fails provider adopt live confirmation on ambiguous evidence without proposal or writes", async () => {
    const code = await runAgentstack(
      ["provider", "adopt", "--service", "eas", "--env", "preview", "--source", "live"],
      {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor(
          "Environment: preview\nSENTRY_AUTH_TOKEN=secret-eas-token\nProject ID: eas-secret-project-id"
        )
      }
    );

    expect(code).toBe(1);
    expect(output).toContain("FAIL provider.adopt.identity-ambiguous");
    expect(output).toContain("Evidence: live-read-inventory");
    expect(output).toContain("Local mutation: none");
    expect(output).toContain("Provider mutation: none");
    expect(output).toContain("Ledger mutation: none");
    expect(output.join("\n")).not.toContain("Provider ledger proposal");
    expect(output.join("\n")).not.toContain("SENTRY_AUTH_TOKEN");
    expect(output.join("\n")).not.toContain("eas-secret-project-id");
    expect(providerExecutions.map((execution) => execution.args.join(" "))).toEqual(["exec eas env:list --environment preview"]);
    await expect(readFile(join(dir, ".agentstack", "provider-links.json"), "utf8")).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(readFile(join(dir, ".agentstack", "events.jsonl"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(dir, ".agentstack", "local-cloud.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("fails provider link and adopt live reads with redacted diagnostics and no writes", async () => {
    await writeProviderLedger([
      providerLedgerRow({
        id: "row-convex-live-read-failure",
        provider: "convex",
        resourceType: "deployment",
        environment: "preview",
        name: "acme-crm-preview",
        status: "active",
        externalId: "convex-preview-secret-external-id",
        cleanupCommand: "delete through Convex dashboard",
        evidence: "docs/evidence/convex-preview.md"
      })
    ]);

    for (const command of ["link", "adopt"] as const) {
      output = [];
      providerExecutions = [];
      const args =
        command === "link"
          ? [
              "provider",
              "link",
              "--service",
              "convex",
              "--env",
              "preview",
              "--resource-type",
              "deployment",
              "--name",
              "acme-crm-preview",
              "--source",
              "live"
            ]
          : ["provider", "adopt", "--service", "convex", "--env", "preview", "--source", "live"];
      const code = await runAgentstack(args, {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: {
          async execute(commandName, args) {
            providerExecutions.push({ command: commandName, args });
            return {
              exitCode: 1,
              stdout: "",
              stderr: "token sk_live_secret_read_failure NEXT_PUBLIC_APP_URL raw-provider-url",
              durationMs: 12
            };
          }
        }
      });

      expect(code).toBe(1);
      expect(output).toContain(`FAIL provider.${command}.live-read`);
      expect(output).toContain("Evidence: live-read-inventory");
      expect(output.join("\n")).not.toContain("sk_live_secret_read_failure");
      expect(output.join("\n")).not.toContain("NEXT_PUBLIC_APP_URL");
      expect(output.join("\n")).not.toContain("raw-provider-url");
      await expect(readFile(join(dir, ".agentstack", "provider-links.json"), "utf8")).rejects.toMatchObject({
        code: "ENOENT"
      });
      await expect(readFile(join(dir, ".agentstack", "events.jsonl"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    }
  });

  it("rejects unsupported provider adopt source and live production Vercel/EAS before executor use", async () => {
    const unsupported = await runAgentstack(["provider", "adopt", "--service", "clerk", "--env", "preview", "--source", "remote"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("live-read should not run")
    });
    expect(unsupported).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.adopt.validation");

    output = [];
    providerExecutions = [];
    const shorthand = await runAgentstack(["provider", "adopt", "--service", "clerk", "--env", "preview", "--live"], {
      cwd: dir,
      write: (line) => output.push(line),
      providerExecutor: createMockProviderExecutor("live-read should not run")
    });
    expect(shorthand).toBe(1);
    expect(output.join("\n")).toContain("FAIL provider.adopt.validation");
    expect(providerExecutions).toHaveLength(0);

    for (const service of ["vercel", "eas"] as const) {
      output = [];
      providerExecutions = [];
      const code = await runAgentstack(["provider", "adopt", "--service", service, "--env", "production", "--source", "live"], {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor("live-read should not run")
      });
      expect(code).toBe(1);
      expect(output.join("\n")).toContain("FAIL provider.adopt.unsupported");
      expect(providerExecutions).toHaveLength(0);
    }
  });

  it("rejects stale provider command aliases as unknown commands", async () => {
    for (const alias of ["import", "connect", "attach", "discover", "resources"]) {
      output = [];
      const code = await runAgentstack(["provider", alias], {
        cwd: dir,
        write: (line) => output.push(line),
        providerExecutor: createMockProviderExecutor("live-read should not run")
      });

      expect(code).toBe(1);
      expect(output).toEqual(["FAIL cli.unknown-command"]);
    }
    expect(providerExecutions).toHaveLength(0);
  });

  it("fails cloud validation when cloud state is missing", async () => {
    const code = await runAgentstack(["validate", "--cloud"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.slice(0, 2)).toEqual([
      "Evidence: local-rehearsal",
      "Scope: local-cloud state only; no live provider reads"
    ]);
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
    expect(output).toContain("Evidence: local-rehearsal");
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
    expect(output.slice(0, 2)).toEqual([
      "Evidence: local-rehearsal",
      "Scope: local-cloud state only; no live provider reads"
    ]);
    expect(output).toContain("PASS validate --cloud");
  });

  it("validates cloud state for an explicit environment", async () => {
    await runAgentstack(["sync", "--env", "production", "--apply"], {
      cwd: dir,
      write: () => undefined
    });

    const code = await runAgentstack(["validate", "--cloud", "--env", "production"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output.slice(0, 2)).toEqual([
      "Evidence: local-rehearsal",
      "Scope: local-cloud state only; no live provider reads"
    ]);
    expect(output).toContain("PASS validate --cloud");
    expect(output).toContain("Environment: production");
  });

  it("inspects environment service and env binding state", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["web", "convex"],
      environments: ["preview"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live",
      providerTargets: previewWebConvexTargets
    };
    await writeFile(
      join(dir, "agentstack.config.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
    await writeLocalEnvValues({
      preview: {
        web: { STRIPE_MODE: "sandbox" },
        convex: { STRIPE_MODE: "sandbox" }
      }
    });
    await runAgentstack(["sync", "--env", "preview", "--apply"], {
      cwd: dir,
      write: () => undefined
    });

    const code = await runAgentstack(["env", "inspect", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PASS env inspect preview");
    expect(output).toContain("- service clerk linked=yes");
    expect(output).toContain("- env web.STRIPE_MODE required=yes secret=no present=yes");
    expect(output).toContain("- env convex.STRIPE_MODE required=yes secret=no present=yes");
  });

  it("inspects provider env sync state without raw values", async () => {
    await writeProviderEnvManifest();
    await writeLocalEnvValues({
      preview: { convex: { OPENAI_API_KEY: "sk-local-provider-value" } }
    });
    await runAgentstack(["sync", "--env", "preview", "--apply"], {
      cwd: dir,
      write: () => undefined
    });

    const syncedCode = await runAgentstack(["env", "inspect", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(syncedCode).toBe(0);
    expect(output).toContain("- provider-env convex.convex.OPENAI_API_KEY synced=yes secret=yes");
    expect(output.join("\n")).not.toContain("sk-local-provider-value");

    await rm(join(dir, ".agentstack", "local-cloud.json"), { force: true });
    output = [];
    const missingCode = await runAgentstack(["env", "inspect", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(missingCode).toBe(0);
    expect(output).toContain("- provider-env convex.convex.OPENAI_API_KEY synced=no secret=yes");
    expect(output.join("\n")).not.toContain("sk-local-provider-value");
  });

  it("keeps same-provider env inspect sync state distinct by surface", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["web", "convex"];
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["web", "convex"],
      environments: ["preview"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live",
      providerTargets: [
        { service: "convex", surfaces: ["web"], environments: ["preview"], source: "local-value" },
        { service: "convex", surfaces: ["convex"], environments: ["preview"], source: "local-value" }
      ]
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await writeLocalEnvValues({
      preview: {
        web: { STRIPE_MODE: "sandbox" },
        convex: { STRIPE_MODE: "sandbox" }
      }
    });
    await runAgentstack(["sync", "--env", "preview", "--apply"], {
      cwd: dir,
      write: () => undefined
    });
    const state = JSON.parse(await readFile(join(dir, ".agentstack", "local-cloud.json"), "utf8")) as {
      envResources?: Array<{ surface: string; name: string }>;
    };
    state.envResources = state.envResources?.filter(
      (resource) => !(resource.surface === "convex" && resource.name === "STRIPE_MODE")
    );
    await writeFile(join(dir, ".agentstack", "local-cloud.json"), `${JSON.stringify(state, null, 2)}\n`);

    const code = await runAgentstack(["env", "inspect", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("- provider-env convex.web.STRIPE_MODE synced=yes secret=no");
    expect(output).toContain("- provider-env convex.convex.STRIPE_MODE synced=no secret=no");
    expect(output.join("\n")).not.toContain("- provider-env convex.STRIPE_MODE");
  });

  it("sets a declared custom env value and lets validation pass", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["convex"];
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["convex"],
      environments: ["preview"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live",
      providerTargets: convexPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);

    expect(await runAgentstack(["validate"], { cwd: dir, write: () => undefined })).toBe(1);
    const setCode = await runAgentstack(
      ["env", "set", "--env", "preview", "--surface", "convex", "--name", "STRIPE_MODE", "--value", "sandbox"],
      { cwd: dir, write: (line) => output.push(line), providerExecutor: createMockProviderExecutor() }
    );
    const values = JSON.parse(await readFile(join(dir, ".agentstack", "env-values.json"), "utf8"));

    expect(setCode).toBe(0);
    expect(output).toContain("PASS env set preview convex.STRIPE_MODE");
    expect(output.join("\n")).not.toContain("sandbox");
    expect(values.preview.convex.STRIPE_MODE).toBe("sandbox");
    expect(providerExecutions).toHaveLength(0);
    output = [];
    expect(await runAgentstack(["validate"], { cwd: dir, write: (line) => output.push(line) })).toBe(0);
    expect(output).toContain("PASS validate");
  });

  it("preserves existing local env values when setting another value", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["web", "convex"],
      environments: ["preview"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live",
      providerTargets: previewWebConvexTargets
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    await mkdir(join(dir, ".agentstack"), { recursive: true });
    await writeFile(
      join(dir, ".agentstack", "env-values.json"),
      `${JSON.stringify({ preview: { web: { STRIPE_MODE: "sandbox" } } }, null, 2)}\n`
    );

    expect(
      await runAgentstack(
        ["env", "set", "--env", "preview", "--surface", "convex", "--name", "STRIPE_MODE", "--value", "live"],
        { cwd: dir, write: () => undefined }
      )
    ).toBe(0);
    const values = JSON.parse(await readFile(join(dir, ".agentstack", "env-values.json"), "utf8"));

    expect(values.preview.web.STRIPE_MODE).toBe("sandbox");
    expect(values.preview.convex.STRIPE_MODE).toBe("live");
  });

  it("rejects undeclared and out-of-scope env set bindings", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["convex"],
      environments: ["preview"],
      required: true,
      secret: false,
      providerTargets: convexPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);

    expect(
      await runAgentstack(
        ["env", "set", "--env", "preview", "--surface", "convex", "--name", "NOPE", "--value", "x"],
        { cwd: dir, write: (line) => output.push(line) }
      )
    ).toBe(1);
    expect(output.join("\n")).toContain("FAIL env.custom.undeclared");
    output = [];

    expect(
      await runAgentstack(
        ["env", "set", "--env", "production", "--surface", "convex", "--name", "STRIPE_MODE", "--value", "x"],
        { cwd: dir, write: (line) => output.push(line) }
      )
    ).toBe(1);
    expect(output.join("\n")).toContain("FAIL env.custom.out-of-scope");
    output = [];

    expect(
      await runAgentstack(
        ["env", "set", "--env", "preview", "--surface", "web", "--name", "STRIPE_MODE", "--value", "x"],
        { cwd: dir, write: (line) => output.push(line) }
      )
    ).toBe(1);
    expect(output.join("\n")).toContain("FAIL env.custom.out-of-scope");
    await expect(stat(join(dir, ".agentstack", "env-values.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects invalid enum env values before writing", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.STRIPE_MODE = {
      surfaces: ["convex"],
      environments: ["preview"],
      required: true,
      secret: false,
      validate: "enum:sandbox,live",
      providerTargets: convexPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);

    const code = await runAgentstack(
      ["env", "set", "--env", "preview", "--surface", "convex", "--name", "STRIPE_MODE", "--value", "invalid"],
      { cwd: dir, write: (line) => output.push(line) }
    );

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL env.custom.invalid-enum");
    await expect(stat(join(dir, ".agentstack", "env-values.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not print or record secret env values", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.env.custom.OPENAI_API_KEY = {
      surfaces: ["convex"],
      environments: ["preview"],
      required: true,
      secret: true,
      providerTargets: convexPreviewTarget
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);

    expect(
      await runAgentstack(
        ["env", "set", "--env", "preview", "--surface", "convex", "--name", "OPENAI_API_KEY", "--value", "sk_live_secret"],
        { cwd: dir, write: (line) => output.push(line) }
      )
    ).toBe(0);
    expect(output.join("\n")).not.toContain("sk_live_secret");
    output = [];

    expect(
      await runAgentstack(["env", "inspect", "--env", "preview"], {
        cwd: dir,
        write: (line) => output.push(line)
      })
    ).toBe(0);
    expect(output.join("\n")).toContain("- env convex.OPENAI_API_KEY required=yes secret=yes present=yes");
    expect(output.join("\n")).not.toContain("sk_live_secret");
    output = [];

    expect(
      await runAgentstack(
        ["observe", "timeline", "--env", "preview", "--journey", "environment-sync"],
        { cwd: dir, write: (line) => output.push(line) }
      )
    ).toBe(0);
    expect(output.join("\n")).toContain("agentstack.env.set.completed");
    expect(output.join("\n")).not.toContain("sk_live_secret");
  });

  it("requires env set option values with actionable diagnostics", async () => {
    const code = await runAgentstack(
      ["env", "set", "--env", "preview", "--surface", "convex", "--name", "STRIPE_MODE"],
      { cwd: dir, write: (line) => output.push(line) }
    );

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cli.option.missing");
    expect(output.join("\n")).toContain("--value requires a value.");
    expect(output.join("\n")).toContain(
      "Fix: Run agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox."
    );
  });

  it("requires env inspect environment values with an actionable diagnostic", async () => {
    const code = await runAgentstack(["env", "inspect"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cli.option.missing");
    expect(output.join("\n")).toContain("--env requires a value.");
    expect(output.join("\n")).toContain("Fix: Run agentstack env inspect --env preview.");
  });

  it("adds a typed feature across selected surfaces and backend", async () => {
    const code = await runAgentstack(
      ["add", "feature", "Customer Invoices", "--surfaces", "web,mobile", "--backend", "convex"],
      {
        cwd: dir,
        write: (line) => output.push(line)
      }
    );

    expect(code).toBe(0);
    expect(output).toContain("CREATED feature customer-invoices");
    expect(output).toContain("- packages/domain/src/features/customer-invoices.ts");
    expect(output).toContain("- convex/features/customer-invoices.ts");
    expect(output).toContain("- apps/web/src/features/customer-invoices.ts");
    expect(output).toContain("- apps/mobile/src/features/customer-invoices.ts");
    await expect(
      readFile(join(dir, "packages/domain/src/features/customer-invoices.ts"), "utf8")
    ).resolves.toContain("customerInvoicesFeature");
    await expect(
      readFile(join(dir, "apps/web/src/features/customer-invoices.ts"), "utf8")
    ).resolves.toContain('surface: "web"');
    await expect(
      readFile(join(dir, "docs/agentstack/features/customer-invoices.md"), "utf8")
    ).resolves.toContain("# Customer Invoices Feature");
    const manifest = JSON.parse(await readFile(join(dir, "agentstack.config.json"), "utf8")) as {
      generated: { requiredAnchors: string[] };
    };
    expect(manifest.generated.requiredAnchors).toEqual(
      expect.arrayContaining([
        "packages/domain/src/features/customer-invoices.ts",
        "convex/features/customer-invoices.ts",
        "apps/web/src/features/customer-invoices.ts",
        "apps/mobile/src/features/customer-invoices.ts",
        "packages/telemetry/src/features/customer-invoices.ts",
        "docs/agentstack/features/customer-invoices.md"
      ])
    );
  });

  it("validates generated feature anchors after add feature", async () => {
    expect(
      await runAgentstack(
        ["add", "feature", "Invoices", "--surfaces", "web,mobile", "--backend", "convex"],
        { cwd: dir, write: () => undefined }
      )
    ).toBe(0);
    await rm(join(dir, "apps/web/src/features/invoices.ts"));

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL template.anchor.missing");
    expect(output.join("\n")).toContain("Path: apps/web/src/features/invoices.ts");
  });

  it("records command telemetry when adding a feature", async () => {
    expect(
      await runAgentstack(
        ["add", "feature", "Invoices", "--surfaces", "web", "--backend", "convex"],
        { cwd: dir, write: () => undefined }
      )
    ).toBe(0);

    const code = await runAgentstack(
      ["observe", "timeline", "--env", "development", "--journey", "feature-generation"],
      {
        cwd: dir,
        write: (line) => output.push(line)
      }
    );

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("agentstack.feature.added");
    expect(output.join("\n")).toContain("Summary: events=1 errors=0");
  });

  it("refuses to overwrite existing feature files", async () => {
    const argv = ["add", "feature", "Invoices", "--surfaces", "web,mobile", "--backend", "convex"];
    expect(await runAgentstack(argv, { cwd: dir, write: () => undefined })).toBe(0);

    const code = await runAgentstack(argv, {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL feature.file.exists");
    expect(output.join("\n")).toContain("Path: packages/domain/src/features/invoices.ts");
  });

  it("reports unsupported feature options with actionable diagnostics", async () => {
    const code = await runAgentstack(
      ["add", "feature", "Invoices", "--surfaces", "web,desktop", "--backend", "convex"],
      {
        cwd: dir,
        write: (line) => output.push(line)
      }
    );

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL feature.invalid");
    expect(output.join("\n")).toContain('Unsupported feature surface "desktop"');
    expect(output.join("\n")).toContain(
      "Fix: Run agentstack add feature invoices --surfaces web,mobile --backend convex."
    );
  });

  it("requires add feature option values with actionable diagnostics", async () => {
    const code = await runAgentstack(["add", "feature", "Invoices", "--surfaces", "web"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cli.option.missing");
    expect(output.join("\n")).toContain("--backend requires a value.");
  });

  it("adds a typed telemetry event and registers generated anchors", async () => {
    const code = await runAgentstack(
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
      { cwd: dir, write: (line) => output.push(line) }
    );

    expect(code).toBe(0);
    expect(output).toContain("CREATED event billing.subscription.updated");
    expect(output).toContain("- packages/telemetry/src/events/billing-subscription-updated.ts");
    expect(output).toContain("- docs/agentstack/events/billing-subscription-updated.md");
    await expect(
      readFile(join(dir, "packages/telemetry/src/events/billing-subscription-updated.ts"), "utf8")
    ).resolves.toContain('plan: "string"');
    await expect(
      readFile(join(dir, "packages/telemetry/src/events/billing-subscription-updated.ts"), "utf8")
    ).resolves.toContain("satisfies AppTelemetryDefinition");
    await expect(
      readFile(join(dir, "packages/telemetry/src/events/index.ts"), "utf8")
    ).resolves.toContain('export * from "./billing-subscription-updated.js";');
    const manifest = JSON.parse(await readFile(join(dir, "agentstack.config.json"), "utf8")) as {
      generated: { requiredAnchors: string[] };
    };
    expect(manifest.generated.requiredAnchors).toEqual(
      expect.arrayContaining([
        "packages/telemetry/src/events/billing-subscription-updated.ts",
        "packages/telemetry/src/events/index.ts",
        "docs/agentstack/events/billing-subscription-updated.md"
      ])
    );
  });

  it("preserves existing telemetry event barrel exports without duplicates", async () => {
    await mkdir(join(dir, "packages/telemetry/src/events"), { recursive: true });
    await writeFile(
      join(dir, "packages/telemetry/src/events/index.ts"),
      'export * from "./billing-subscription-updated.js";\nexport * from "./other-event.js";\n',
      "utf8"
    );

    const code = await runAgentstack(
      [
        "add",
        "event",
        "billing.subscription.updated",
        "--journey",
        "billing",
        "--surfaces",
        "web",
        "--state",
        "plan:string"
      ],
      { cwd: dir, write: (line) => output.push(line) }
    );

    expect(code).toBe(0);
    const barrel = await readFile(join(dir, "packages/telemetry/src/events/index.ts"), "utf8");
    expect(barrel.match(/billing-subscription-updated/g)).toHaveLength(1);
    expect(barrel).toContain('export * from "./other-event.js";');
  });

  it("refuses to overwrite existing telemetry event files", async () => {
    const argv = [
      "add",
      "event",
      "billing.subscription.updated",
      "--journey",
      "billing",
      "--surfaces",
      "web,convex",
      "--state",
      "plan:string"
    ];
    expect(await runAgentstack(argv, { cwd: dir, write: () => undefined })).toBe(0);

    const code = await runAgentstack(argv, {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL event.file.exists");
    expect(output.join("\n")).toContain("Path: packages/telemetry/src/events/billing-subscription-updated.ts");
  });

  it("reports invalid telemetry event options with actionable diagnostics", async () => {
    const code = await runAgentstack(
      [
        "add",
        "event",
        "Billing Updated",
        "--journey",
        "billing",
        "--surfaces",
        "web,desktop",
        "--state",
        "plan:string"
      ],
      { cwd: dir, write: (line) => output.push(line) }
    );

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL event.invalid");
    expect(output.join("\n")).toContain("lowercase dot-separated identifiers");
    expect(output.join("\n")).toContain(
      "Fix: Run agentstack add event billing.subscription.updated --journey billing --surfaces web,convex --state plan:string."
    );
  });

  it("records command telemetry when adding an event without raw secret output", async () => {
    expect(
      await runAgentstack(
        [
          "add",
          "event",
          "billing.subscription.updated",
          "--journey",
          "billing",
          "--surfaces",
          "web",
          "--state",
          "plan:string"
        ],
        { cwd: dir, write: () => undefined }
      )
    ).toBe(0);

    const code = await runAgentstack(
      ["observe", "timeline", "--env", "development", "--journey", "telemetry-generation"],
      { cwd: dir, write: (line) => output.push(line) }
    );

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("agentstack.event.added");
    expect(output.join("\n")).not.toContain("sk_live");
  });

  it("adds a typed billing plan across domain, Convex, web, mobile, telemetry, and docs", async () => {
    const code = await runAgentstack(
      ["add", "billing-plan", "Pro", "--entitlements", "feature.auditLog,feature.advancedReports", "--seats", "10"],
      { cwd: dir, write: (line) => output.push(line) }
    );

    expect(code).toBe(0);
    expect(output).toContain("CREATED billing-plan pro");
    expect(output).toContain("- packages/domain/src/billing-plans/pro.ts");
    expect(output).toContain("- packages/domain/src/billing-plans/index.ts");
    expect(output).toContain("- convex/billing-plans/pro.ts");
    expect(output).toContain("- apps/web/src/billing-plans/pro.ts");
    expect(output).toContain("- apps/mobile/src/billing-plans/pro.ts");
    expect(output).toContain("- packages/telemetry/src/billing-plans/pro.ts");
    expect(output).toContain("- docs/agentstack/billing-plans/pro.md");
    await expect(readFile(join(dir, "packages/domain/src/billing-plans/pro.ts"), "utf8")).resolves.toContain(
      "proBillingPlan"
    );
    await expect(readFile(join(dir, "packages/domain/src/billing-plans/index.ts"), "utf8")).resolves.toContain(
      'export * from "./pro.js";'
    );
    const manifest = JSON.parse(await readFile(join(dir, "agentstack.config.json"), "utf8")) as {
      generated: { requiredAnchors: string[] };
    };
    expect(manifest.generated.requiredAnchors).toEqual(
      expect.arrayContaining([
        "packages/domain/src/billing-plans/pro.ts",
        "packages/domain/src/billing-plans/index.ts",
        "convex/billing-plans/pro.ts",
        "apps/web/src/billing-plans/pro.ts",
        "apps/mobile/src/billing-plans/pro.ts",
        "packages/telemetry/src/billing-plans/pro.ts",
        "docs/agentstack/billing-plans/pro.md"
      ])
    );
  });

  it("validates generated billing plan anchors after add billing-plan", async () => {
    expect(
      await runAgentstack(
        ["add", "billing-plan", "Pro", "--entitlements", "feature.auditLog,feature.advancedReports", "--seats", "10"],
        { cwd: dir, write: () => undefined }
      )
    ).toBe(0);
    await rm(join(dir, "apps/web/src/billing-plans/pro.ts"));

    const code = await runAgentstack(["validate"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL template.anchor.missing");
    expect(output.join("\n")).toContain("Path: apps/web/src/billing-plans/pro.ts");
  });

  it("refuses to overwrite existing billing plan files", async () => {
    const argv = [
      "add",
      "billing-plan",
      "Pro",
      "--entitlements",
      "feature.auditLog,feature.advancedReports",
      "--seats",
      "10"
    ];
    expect(await runAgentstack(argv, { cwd: dir, write: () => undefined })).toBe(0);

    const code = await runAgentstack(argv, {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL billing-plan.file.exists");
    expect(output.join("\n")).toContain("Path: packages/domain/src/billing-plans/pro.ts");
  });

  it("reports invalid billing plan entitlements with actionable diagnostics", async () => {
    const code = await runAgentstack(
      ["add", "billing-plan", "Pro", "--entitlements", "Feature Audit", "--seats", "10"],
      { cwd: dir, write: (line) => output.push(line) }
    );

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL billing-plan.invalid");
    expect(output.join("\n")).toContain('Invalid entitlement key "Feature Audit".');
    expect(output.join("\n")).toContain(
      "Fix: Run agentstack add billing-plan pro --entitlements feature.auditLog,feature.advancedReports --seats 10."
    );
  });

  it("records command telemetry when adding a billing plan", async () => {
    expect(
      await runAgentstack(
        ["add", "billing-plan", "Pro", "--entitlements", "feature.auditLog,feature.advancedReports", "--seats", "10"],
        { cwd: dir, write: () => undefined }
      )
    ).toBe(0);

    const code = await runAgentstack(
      ["observe", "timeline", "--env", "development", "--journey", "billing"],
      { cwd: dir, write: (line) => output.push(line) }
    );

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("agentstack.billing-plan.added");
    expect(output.join("\n")).toContain("Summary: events=1 errors=0");
  });

  it("prints observed timelines in chronological order", async () => {
    const store = new JsonlTelemetryStore(join(dir, ".agentstack", "events.jsonl"));
    await store.append({
      ...createWideEvent("agentstack.sync.completed", {
        environment: "preview",
        surface: "cli",
        journey: "environment-sync",
        state: { token: "sk_live_secret" }
      }),
      timestamp: "2026-06-20T10:00:02.000Z"
    });
    await store.append({
      ...createWideEvent("agentstack.env.inspect.completed", {
        environment: "preview",
        surface: "cli",
        journey: "environment-sync",
        state: { status: "started" }
      }),
      timestamp: "2026-06-20T10:00:01.000Z"
    });

    const code = await runAgentstack(
      ["observe", "timeline", "--env", "preview", "--journey", "environment-sync"],
      {
        cwd: dir,
        write: (line) => output.push(line)
      }
    );

    expect(code).toBe(0);
    expect(output).toContain("PASS observe timeline 2");
    const rendered = output.join("\n");
    expect(
      rendered.indexOf("- 2026-06-20T10:00:01.000Z preview cli agentstack.env.inspect.completed")
    ).toBeLessThan(
      rendered.indexOf("- 2026-06-20T10:00:02.000Z preview cli agentstack.sync.completed")
    );
    expect(rendered).toContain("Summary: events=2 errors=0");
    expect(rendered).toContain("Risks:");
    expect(rendered).toContain("Next queries:");
    expect(rendered).not.toContain("sk_live_secret");
  });

  it("renders telemetry timeline inspections with summary risks next queries and no secrets", async () => {
    const store = new JsonlTelemetryStore(join(dir, ".agentstack", "events.jsonl"));
    await store.append({
      ...createWideEvent("billing.subscription.failed", {
        environment: "preview",
        surface: "web",
        journey: "billing",
        status: "error",
        correlationId: "",
        state: { stripeToken: "sk_live_secret" }
      }),
      timestamp: "2026-06-20T10:00:00.000Z"
    });

    const code = await runAgentstack(["observe", "timeline", "--env", "preview", "--journey", "billing"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    const rendered = output.join("\n");
    expect(code).toBe(0);
    expect(rendered).toContain("PASS observe timeline 1");
    expect(rendered).toContain("Summary: events=1 errors=1");
    expect(rendered).toContain("missing_correlation_context");
    expect(rendered).toContain("Next queries:");
    expect(rendered).not.toContain("sk_live_secret");
  });

  it("renders journey inspections with optional redacted state and correlation risks", async () => {
    const store = new JsonlTelemetryStore(join(dir, ".agentstack", "events.jsonl"));
    await store.append({
      ...createWideEvent("onboarding.started", {
        environment: "preview",
        surface: "web",
        journey: "onboarding",
        journeyId: "journey_onboarding",
        correlationId: "",
        state: { email: "buyer@example.com", step: "start" }
      }),
      timestamp: "2026-06-20T10:00:00.000Z"
    });

    const code = await runAgentstack(["observe", "journey", "--id", "journey_onboarding", "--include-state"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    const rendered = output.join("\n");
    expect(code).toBe(0);
    expect(rendered).toContain("PASS observe journey 1");
    expect(rendered).toContain('state={"email":"[redacted]","step":"start"}');
    expect(rendered).toContain("missing_correlation_context");
    expect(rendered).not.toContain("buyer@example.com");
  });

  it("renders journey inspections as parseable redacted JSON", async () => {
    const store = new JsonlTelemetryStore(join(dir, ".agentstack", "events.jsonl"));
    await store.append(
      createWideEvent("onboarding.started", {
        environment: "preview",
        surface: "web",
        journey: "onboarding",
        journeyId: "journey_json",
        state: { email: "buyer@example.com" }
      })
    );

    const code = await runAgentstack(["observe", "journey", "--id", "journey_json", "--format", "json"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    const rendered = output.join("\n");
    const inspection = JSON.parse(rendered);
    expect(code).toBe(0);
    expect(inspection.summary.eventCount).toBe(1);
    expect(rendered).toContain("[redacted]");
    expect(rendered).not.toContain("buyer@example.com");
  });

  it("renders error inspections as grouped text and parseable redacted JSON", async () => {
    const store = new JsonlTelemetryStore(join(dir, ".agentstack", "events.jsonl"));
    await store.append(
      createWideEvent("billing.subscription.failed", {
        environment: "production",
        surface: "convex",
        component: "convex:billing.applySubscriptionUpdate",
        status: "error",
        state: { stripeToken: "sk_live_secret", errorClass: "StripeCardError" }
      })
    );

    expect(
      await runAgentstack(["observe", "errors", "--env", "production", "--group-by", "component"], {
        cwd: dir,
        write: (line) => output.push(line)
      })
    ).toBe(0);
    expect(output.join("\n")).toContain("- component=convex:billing.applySubscriptionUpdate errors=1");

    output = [];
    const code = await runAgentstack(["observe", "errors", "--env", "production", "--format", "json"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    const rendered = output.join("\n");
    const inspection = JSON.parse(rendered);
    expect(code).toBe(0);
    expect(inspection.summary.errorCount).toBe(1);
    expect(rendered).toContain("[redacted]");
    expect(rendered).not.toContain("sk_live_secret");
  });

  it("reports compare inspection deltas for preview and production", async () => {
    const store = new JsonlTelemetryStore(join(dir, ".agentstack", "events.jsonl"));
    await store.append(
      createWideEvent("onboarding.started", {
        environment: "preview",
        surface: "web",
        journey: "onboarding"
      })
    );
    await store.append(
      createWideEvent("onboarding.started", {
        environment: "production",
        surface: "web",
        journey: "onboarding"
      })
    );
    await store.append(
      createWideEvent("onboarding.failed", {
        environment: "production",
        surface: "web",
        journey: "onboarding",
        status: "error"
      })
    );

    const code = await runAgentstack(["observe", "compare", "--env", "preview,production", "--journey", "onboarding"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    const rendered = output.join("\n");
    expect(code).toBe(0);
    expect(rendered).toContain("- preview events=1 errors=0 eventDelta=0 errorDelta=0");
    expect(rendered).toContain("- production events=2 errors=1 eventDelta=+1 errorDelta=+1");
  });

  it("records command telemetry for validation", async () => {
    await runAgentstack(["validate"], {
      cwd: dir,
      write: () => undefined
    });

    const code = await runAgentstack(
      ["observe", "timeline", "--env", "development", "--journey", "validation"],
      {
        cwd: dir,
        write: (line) => output.push(line)
      }
    );

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("agentstack.validate.completed");
    expect(output.join("\n")).toContain("Summary: events=1 errors=0");
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

  it("exports observed events as local OTLP JSON", async () => {
    const store = new JsonlTelemetryStore(join(dir, ".agentstack", "events.jsonl"));
    await store.append(
      createWideEvent("billing.subscription.updated", {
        environment: "preview",
        surface: "web",
        state: {
          status: "active",
          customerEmail: "buyer@example.com"
        }
      })
    );

    const code = await runAgentstack(
      ["observe", "export", "--env", "preview", "--format", "otlp-json"],
      {
        cwd: dir,
        write: (line) => output.push(line)
      }
    );

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("EXPORTED observe otlp-json preview 1");
    expect(output.join("\n")).toContain(".agentstack/exports/telemetry-preview-otlp.json");
    const artifact = await readFile(join(dir, ".agentstack", "exports", "telemetry-preview-otlp.json"), "utf8");
    const request = JSON.parse(artifact);
    const logRecords = request.resourceLogs[0].scopeLogs[0].logRecords;
    const attributes = logRecords[0].attributes;
    expect(logRecords).toHaveLength(1);
    expect(attributes).toContainEqual({
      key: "agentstack.state.customerEmail",
      value: { stringValue: "[redacted]" }
    });
    expect(artifact).not.toContain("buyer@example.com");
    expect(artifact).not.toContain("agentstack.observe.export.completed");
  });

  it("defaults observe export to local OTLP JSON", async () => {
    const store = new JsonlTelemetryStore(join(dir, ".agentstack", "events.jsonl"));
    await store.append(
      createWideEvent("agentstack.validate.completed", {
        environment: "preview",
        surface: "cli",
        journey: "validation",
        state: { diagnostics: 0 }
      })
    );

    const code = await runAgentstack(["observe", "export", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output.join("\n")).toContain("EXPORTED observe otlp-json preview 1");
  });

  it("rejects unsupported observe export formats", async () => {
    const code = await runAgentstack(["observe", "export", "--env", "preview", "--format", "csv"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL observe.export.format.unsupported");
  });

  it("inspects traces, journeys, errors, webhooks, components, and env comparisons", async () => {
    const store = new JsonlTelemetryStore(join(dir, ".agentstack", "events.jsonl"));
    await store.append({
      ...createWideEvent("onboarding.started", {
        environment: "preview",
        surface: "web",
        component: "web:onboarding",
        journey: "onboarding",
        traceId: "trace_onboarding",
        journeyId: "journey_onboarding",
        state: { step: "start", email: "buyer@example.com" }
      }),
      timestamp: "2026-06-20T10:00:00.000Z"
    });
    await store.append({
      ...createWideEvent("onboarding.completed", {
        environment: "production",
        surface: "web",
        component: "web:onboarding",
        journey: "onboarding",
        traceId: "trace_production",
        journeyId: "journey_production",
        state: { step: "complete" }
      }),
      timestamp: "2026-06-20T10:02:00.000Z"
    });
    await store.append({
      ...createWideEvent("billing.subscription.failed", {
        environment: "production",
        surface: "convex",
        component: "convex:billing.applySubscriptionUpdate",
        status: "error",
        traceId: "trace_billing",
        state: { errorClass: "StripeCardError", stripeToken: "sk_live_secret" }
      }),
      timestamp: "2026-06-20T10:03:00.000Z"
    });
    await store.append({
      ...createWideEvent("webhook.clerk.received", {
        environment: "production",
        surface: "clerk",
        component: "clerk:webhook",
        status: "ok",
        state: { provider: "clerk", eventType: "user.created", authorization: "Bearer secret" }
      }),
      timestamp: "2026-06-20T10:04:00.000Z"
    });

    expect(
      await runAgentstack(["observe", "trace", "--id", "trace_onboarding", "--env", "preview"], {
        cwd: dir,
        write: (line) => output.push(line)
      })
    ).toBe(0);
    expect(
      await runAgentstack(["observe", "journey", "--id", "journey_onboarding", "--include-state"], {
        cwd: dir,
        write: (line) => output.push(line)
      })
    ).toBe(0);
    expect(
      await runAgentstack(
        [
          "observe",
          "errors",
          "--env",
          "production",
          "--since",
          "2026-06-20T09:00:00.000Z",
          "--group-by",
          "component"
        ],
        { cwd: dir, write: (line) => output.push(line) }
      )
    ).toBe(0);
    expect(
      await runAgentstack(
        [
          "observe",
          "webhook",
          "clerk",
          "--env",
          "production",
          "--since",
          "2026-06-20T09:00:00.000Z"
        ],
        {
          cwd: dir,
          write: (line) => output.push(line)
        }
      )
    ).toBe(0);
    expect(
      await runAgentstack(
        ["observe", "component", "convex:billing.applySubscriptionUpdate", "--env", "production"],
        { cwd: dir, write: (line) => output.push(line) }
      )
    ).toBe(0);
    expect(
      await runAgentstack(
        ["observe", "compare", "--env", "preview,production", "--journey", "onboarding"],
        { cwd: dir, write: (line) => output.push(line) }
      )
    ).toBe(0);
    expect(
      await runAgentstack(
        [
          "observe",
          "query",
          "--env",
          "production",
          "--component",
          "convex:billing.applySubscriptionUpdate",
          "--error-class",
          "StripeCardError"
        ],
        { cwd: dir, write: (line) => output.push(line) }
      )
    ).toBe(0);

    const rendered = output.join("\n");
    expect(rendered).toContain("PASS observe trace 1");
    expect(rendered).toContain("PASS observe journey 1");
    expect(rendered).toContain("PASS observe errors 1");
    expect(rendered).toContain("- component=convex:billing.applySubscriptionUpdate errors=1");
    expect(rendered).toContain("PASS observe webhook clerk 1");
    expect(rendered).toContain("PASS observe component convex:billing.applySubscriptionUpdate 1");
    expect(rendered).toContain("PASS observe compare onboarding 2");
    expect(rendered).toContain("PASS observe query 1");
    expect(rendered).toContain("- preview events=1 errors=0 eventDelta=0 errorDelta=0");
    expect(rendered).toContain("- production events=1 errors=0 eventDelta=0 errorDelta=0");
    expect(rendered).toContain("[redacted]");
    expect(rendered).not.toContain("buyer@example.com");
    expect(rendered).not.toContain("sk_live_secret");

    output = [];
    expect(
      await runAgentstack(["observe", "query", "--event", "agentstack.observe.completed"], {
        cwd: dir,
        write: (line) => output.push(line)
      })
    ).toBe(0);
    expect(output).toContain("PASS observe query 7");
  });

  it("requires trace ids for observe trace with an actionable diagnostic", async () => {
    const code = await runAgentstack(["observe", "trace", "--env", "production"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cli.option.missing");
    expect(output.join("\n")).toContain("--id requires a value.");
    expect(output.join("\n")).toContain("Fix: Run agentstack observe trace --id trace_123 --env production.");
  });

  it("rejects empty observe compare environment lists", async () => {
    const code = await runAgentstack(
      ["observe", "compare", "--env", ",", "--journey", "onboarding"],
      {
        cwd: dir,
        write: (line) => output.push(line)
      }
    );

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL cli.option.invalid");
    expect(output.join("\n")).toContain("Expected comma-separated environments.");
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
    "scripts/agentstack.mjs",
    "docs/agentstack/saas-spine.md",
    "apps/web/package.json",
    "apps/web/src/index.ts",
    "apps/mobile/package.json",
    "apps/mobile/App.tsx",
    "apps/mobile/src/index.ts",
    "apps/mobile/app.config.ts",
    "apps/mobile/eas.json",
    "docs/agentstack/mobile.md",
    "docs/agentstack/skills.md",
    "skills/agentstack/SKILL.md",
    "skills/agentstack/references/workflows.md",
    "skills/agentstack/references/guardrails.md",
    "skills/agentstack/references/observability.md",
    "convex/schema.ts",
    "convex/agentstack.ts",
    "convex/saasSpine.ts",
    "packages/domain/src/index.ts",
    "packages/domain/src/saas-spine.ts",
    "packages/theme/package.json",
    "packages/theme/tokens.json",
    "packages/theme/src/index.ts",
    "packages/telemetry/src/events.ts"
  ];

  await Promise.all(
    anchors.map(async (anchor) => {
      await mkdir(dirname(join(dir, anchor)), { recursive: true });
      await writeFile(
        join(dir, anchor),
        readGeneratedAnchorFixture(anchor),
        "utf8"
      );
    })
  );
}

async function writeProviderEnvManifest(): Promise<void> {
  const manifest = createDefaultManifest("acme-crm");
  manifest.environments = ["preview"];
  manifest.surfaces = ["convex"];
  manifest.env.custom.OPENAI_API_KEY = {
    surfaces: ["convex"],
    environments: ["preview"],
    required: true,
    secret: true,
    providerTargets: convexPreviewTarget
  };
  await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function writeProviderLedger(rows: string[]): Promise<void> {
  await mkdir(join(dir, "docs"), { recursive: true });
  await writeFile(
    join(dir, "docs", "provider-resource-ledger.md"),
    [
      "# Provider Resource Ledger",
      "",
      "## Status Taxonomy",
      "",
      "| Status | Meaning |",
      "| --- | --- |",
      "| planned | Approved for bounded provider mutation. |",
      "| active | Existing provider resource under management. |",
      "| cleanup-pending | Resource must be cleaned before mutation. |",
      "",
      "## Required Fields",
      "",
      "| Field | Required for |",
      "| --- | --- |",
      "| Owner | planned, active |",
      "| Purpose | planned, active |",
      "| Cleanup Command/Procedure | planned, active |",
      "| Evidence Link/Path | planned, active |",
      "",
      "## Ledger",
      "",
      "| id | provider | resource type | environment | owner account/project | name | external id/url | purpose | created by | created at | expected cleanup trigger/date | current status | cleanup command/procedure | cleaned at | evidence link/path | notes |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
      ...rows,
      ""
    ].join("\n"),
    "utf8"
  );
}

function providerLedgerRow(input: {
  id: string;
  provider: string;
  resourceType: string;
  environment: string;
  name: string;
  status: string;
  owner?: string;
  externalId?: string;
  purpose?: string;
  createdBy?: string;
  createdAt?: string;
  expectedCleanup?: string;
  cleanupCommand: string;
  evidence: string;
}): string {
  return [
    input.id,
    input.provider,
    input.resourceType,
    input.environment,
    input.owner ?? "Platform",
    input.name,
    input.externalId ?? "",
    input.purpose ?? "Preview backend",
    input.createdBy ?? "Agentstack",
    input.createdAt ?? "2026-06-21",
    input.expectedCleanup ?? "Wave 0 complete",
    input.status,
    input.cleanupCommand,
    "",
    input.evidence,
    ""
  ].join(" | ").replace(/^/, "| ").replace(/$/, " |");
}

async function writeLocalEnvValues(values: unknown): Promise<void> {
  await mkdir(join(dir, ".agentstack"), { recursive: true });
  await writeFile(
    join(dir, ".agentstack", "env-values.json"),
    `${JSON.stringify(values, null, 2)}\n`,
    "utf8"
  );
}

function createMockProviderExecutor(stdout = "ok"): ProviderCommandExecutor {
  return {
    async execute(command, args, options) {
      providerExecutions.push({ command, args, stdin: options.stdin });
      return {
        exitCode: 0,
        stdout,
        stderr: "",
        durationMs: 12
      };
    }
  };
}

function readGeneratedAnchorFixture(anchor: string): string {
  if (anchor === "packages/theme/tokens.json") {
    return `${JSON.stringify(defaultThemeTokens, null, 2)}\n`;
  }

  if (anchor === "packages/theme/src/index.ts") {
    return [
      'import themeTokensJson from "../tokens.json";',
      "",
      "export const themeTokens = themeTokensJson;",
      ""
    ].join("\n");
  }

  return "{}\n";
}
