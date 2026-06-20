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
