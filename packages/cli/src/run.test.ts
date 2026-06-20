import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultManifest, defaultThemeTokens } from "@agentstack/core";
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
    expect(output.join("\n")).toContain('"diagnostics":0');
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
    expect(output.join("\n")).toContain('"status":"fail"');
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
    expect(output.join("\n")).toContain("Cloud missing: none");
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
    expect(output.join("\n")).toContain('"status":"fail"');
  });

  it("loads local custom env values during validation", async () => {
    const manifest = createDefaultManifest("acme-crm");
    manifest.environments = ["preview"];
    manifest.surfaces = ["convex"];
    manifest.env.custom.OPENAI_API_KEY = {
      surfaces: ["convex"],
      environments: ["preview"],
      required: true,
      secret: true
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
      secret: true
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
      secret: true
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

  it("rejects non-preview deploy environments with an actionable diagnostic", async () => {
    const code = await runAgentstack(["deploy", "--env", "production"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(1);
    expect(output.join("\n")).toContain("FAIL deploy.environment.unsupported");
    expect(output.join("\n")).toContain("Path: production");
    expect(output.join("\n")).toContain("Fix: Run agentstack deploy --env preview.");
    expect(output.join("\n")).not.toContain("PLAN deploy production");

    output = [];
    const applyCode = await runAgentstack(["deploy", "--env", "production", "--apply"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(applyCode).toBe(1);
    expect(output.join("\n")).toContain("FAIL deploy.environment.unsupported");
    expect(output.join("\n")).not.toContain("APPLIED deploy production");
  });

  it("plans preview deploy without writing a deployment artifact", async () => {
    const code = await runAgentstack(["deploy", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PLAN deploy preview");
    expect(output).toContain("- planned release preview.vercel");
    await expect(stat(join(dir, ".agentstack", "deployments", "preview.json"))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });

  it("applies preview deploy and writes a deployment artifact", async () => {
    const code = await runAgentstack(["deploy", "--env", "preview", "--apply"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("APPLIED deploy preview");
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
    expect(output.join("\n")).toContain('"applied":true');
    expect(output.join("\n")).toContain('"services":["clerk","convex","vercel","eas"]');
  });

  it("plans a preview mobile build when EAS is linked", async () => {
    await runAgentstack(["sync", "--env", "preview", "--apply"], { cwd: dir, write: () => undefined });

    const code = await runAgentstack(["build", "mobile", "--env", "preview"], {
      cwd: dir,
      write: (line) => output.push(line)
    });

    expect(code).toBe(0);
    expect(output).toContain("PLAN mobile build preview");
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
    expect(output.join("\n")).toContain('"profile":"preview"');
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
      validate: "enum:sandbox,live"
    };
    await writeFile(
      join(dir, "agentstack.config.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8"
    );
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
    expect(output).toContain("- env web.STRIPE_MODE required=yes secret=no present=no");
    expect(output).toContain("- env convex.STRIPE_MODE required=yes secret=no present=no");
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
      validate: "enum:sandbox,live"
    };
    await writeFile(join(dir, "agentstack.config.json"), `${JSON.stringify(manifest, null, 2)}\n`);

    expect(await runAgentstack(["validate"], { cwd: dir, write: () => undefined })).toBe(1);
    const setCode = await runAgentstack(
      ["env", "set", "--env", "preview", "--surface", "convex", "--name", "STRIPE_MODE", "--value", "sandbox"],
      { cwd: dir, write: (line) => output.push(line) }
    );
    const values = JSON.parse(await readFile(join(dir, ".agentstack", "env-values.json"), "utf8"));

    expect(setCode).toBe(0);
    expect(output).toContain("PASS env set preview convex.STRIPE_MODE");
    expect(output.join("\n")).not.toContain("sandbox");
    expect(values.preview.convex.STRIPE_MODE).toBe("sandbox");
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
      validate: "enum:sandbox,live"
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
      secret: false
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
      validate: "enum:sandbox,live"
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
      secret: true
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
    expect(output.join("\n")).toContain('"feature":"invoices"');
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
    expect(output.join("\n")).toContain('"event":"billing.subscription.updated"');
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
    expect(output.join("\n")).toContain('"billingPlan":"pro"');
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
    expect(output.indexOf("2026-06-20T10:00:01.000Z preview cli agentstack.env.inspect.completed")).toBeLessThan(
      output.indexOf("2026-06-20T10:00:02.000Z preview cli agentstack.sync.completed")
    );
    expect(output.join("\n")).toContain("[redacted]");
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
    expect(output.join("\n")).toContain('"diagnostics":0');
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
    expect(rendered).toContain("group component convex:billing.applySubscriptionUpdate events=1");
    expect(rendered).toContain("PASS observe webhook clerk 1");
    expect(rendered).toContain("PASS observe component convex:billing.applySubscriptionUpdate 1");
    expect(rendered).toContain("PASS observe compare onboarding 2");
    expect(rendered).toContain("PASS observe query 1");
    expect(rendered).toContain("preview events=1 errors=0");
    expect(rendered).toContain("production events=1 errors=0");
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
    "docs/agentstack/saas-spine.md",
    "apps/web/package.json",
    "apps/mobile/package.json",
    "apps/mobile/app.config.ts",
    "apps/mobile/eas.json",
    "docs/agentstack/mobile.md",
    "docs/agentstack/skills.md",
    "skills/agentstack/SKILL.md",
    "skills/agentstack/references/workflows.md",
    "skills/agentstack/references/guardrails.md",
    "skills/agentstack/references/observability.md",
    "convex/schema.ts",
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
