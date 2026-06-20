import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { generateProject } from "./generate.js";

const require = createRequire(import.meta.url);
const sourceDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(sourceDir, "..");
const repoRoot = resolve(packageRoot, "../..");
const packageManifestPath = join(packageRoot, "package.json");
const rootTemplateDir = join(repoRoot, "templates/b2b-saas");
const packageTemplateDir = join(packageRoot, "templates/b2b-saas");
const templateTokens = ["__APP_SLUG__", "__APP_NAME__"];
const execFileAsync = promisify(execFile);
const generatedAnchorFiles = [
  ".env.example",
  "docs/agentstack/auth.md",
  "docs/agentstack/billing.md",
  "docs/agentstack/local-development.md",
  "docs/agentstack/mobile.md",
  "docs/agentstack/preview.md",
  "docs/agentstack/saas-spine.md",
  "docs/agentstack/skills.md",
  "skills/agentstack/SKILL.md",
  "skills/agentstack/references/workflows.md",
  "skills/agentstack/references/guardrails.md",
  "skills/agentstack/references/observability.md",
  "packages/config/package.json",
  "packages/config/src/index.ts",
  "packages/telemetry/package.json",
  "packages/telemetry/src/events.ts",
  "packages/telemetry/src/events/index.ts",
  "packages/telemetry/src/index.ts",
  "packages/theme/package.json",
  "packages/theme/tokens.json",
  "packages/theme/src/index.ts",
  "packages/ui/package.json",
  "packages/ui/src/index.ts",
  "packages/agentstack-runtime/package.json",
  "packages/agentstack-runtime/src/index.ts",
  "apps/mobile/app.config.ts",
  "apps/mobile/eas.json",
  "apps/web/src/index.ts",
  "apps/mobile/src/index.ts",
  "convex/agentstack.ts",
  "convex/saasSpine.ts",
  "packages/domain/src/saas-spine.ts"
];

describe("generateProject", () => {
  test("generates a B2B SaaS project with app tokens replaced", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      const manifest = JSON.parse(
        await readFile(join(targetDir, "agentstack.config.json"), "utf8")
      );
      const agents = await readFile(join(targetDir, "AGENTS.md"), "utf8");
      const gitignore = await readFile(join(targetDir, ".gitignore"), "utf8");
      const packageManifest = JSON.parse(
        await readFile(join(targetDir, "package.json"), "utf8")
      );

      expect(manifest.app.slug).toBe("acme-crm");
      expect(packageManifest.packageManager).toBe("pnpm@9.15.4");
      expect(agents).toContain("Run `pnpm run validate` before completion.");
      expect(gitignore).toContain(".agentstack/");
      expect(gitignore).toContain(".env.*");
      expect(gitignore).toContain("!.env.example");
      expect(packageManifest.scripts).toMatchObject({
        inspect: "node scripts/agentstack.mjs inspect --env preview",
        doctor: "node scripts/agentstack.mjs doctor --env preview",
        dev: "node scripts/agentstack.mjs dev --env preview",
        "env:inspect": "node scripts/agentstack.mjs env inspect --env preview",
        "preview:plan": "node scripts/agentstack.mjs sync --env preview",
        "preview:apply": "node scripts/agentstack.mjs sync --env preview --apply",
        "preview:validate": "node scripts/agentstack.mjs validate --cloud --env preview",
        "preview:deploy": "node scripts/agentstack.mjs deploy --env preview",
        "preview:deploy:apply": "node scripts/agentstack.mjs deploy --env preview --apply",
        "prod:prepare": "node scripts/agentstack.mjs prod prepare",
        "prod:provision": "node scripts/agentstack.mjs prod provision",
        "prod:provision:apply": "node scripts/agentstack.mjs prod provision --apply",
        "prod:validate": "node scripts/agentstack.mjs validate --release prod",
        "prod:deploy": "node scripts/agentstack.mjs deploy --env production",
        "prod:deploy:apply": "node scripts/agentstack.mjs deploy --env production --apply --confirm-production",
        "mobile:build:development": "node scripts/agentstack.mjs build mobile --env development",
        "mobile:build:preview": "node scripts/agentstack.mjs build mobile --env preview",
        "mobile:build:preview:apply": "node scripts/agentstack.mjs build mobile --env preview --apply",
        "mobile:build:production": "node scripts/agentstack.mjs build mobile --env production",
        "mobile:build:plan": "node scripts/agentstack.mjs build mobile --env preview",
        "mobile:build:apply": "node scripts/agentstack.mjs build mobile --env preview --apply",
        "theme:validate": "node scripts/agentstack.mjs theme validate",
        "skills:inspect": "node scripts/agentstack.mjs skills inspect",
        "sync:preview": "node scripts/agentstack.mjs sync --env preview",
        "sync:preview:apply": "node scripts/agentstack.mjs sync --env preview --apply",
        "observe:timeline": "node scripts/agentstack.mjs observe timeline --journey smoke --env preview",
        "telemetry:export:preview": "node scripts/agentstack.mjs observe export --env preview --format otlp-json",
        "telemetry:export:production": "node scripts/agentstack.mjs observe export --env production --format otlp-json"
      });
      expect(manifest.generated.requiredAnchors).toEqual(
        expect.arrayContaining([
          "apps/mobile/app.config.ts",
          "apps/mobile/eas.json",
          "docs/agentstack/mobile.md",
          "packages/domain/src/saas-spine.ts",
          "convex/saasSpine.ts",
          "docs/agentstack/saas-spine.md"
        ])
      );
      const mobilePackageManifest = JSON.parse(
        await readFile(join(targetDir, "apps/mobile/package.json"), "utf8")
      );
      expect(mobilePackageManifest.scripts).toMatchObject({
        "dev-client": "node ../../scripts/agentstack.mjs build mobile --env development",
        "build:development": "node ../../scripts/agentstack.mjs build mobile --env development",
        "build:preview": "node ../../scripts/agentstack.mjs build mobile --env preview",
        "build:preview:apply": "node ../../scripts/agentstack.mjs build mobile --env preview --apply",
        "build:production": "node ../../scripts/agentstack.mjs build mobile --env production"
      });
      await expect(readFile(join(targetDir, "apps/mobile/eas.json"), "utf8")).resolves.toContain(
        '"developmentClient": true'
      );
      await expect(readFile(join(targetDir, "apps/mobile/eas.json"), "utf8")).resolves.toContain(
        '"version": ">= 20.0.0"'
      );
      await expect(readFile(join(targetDir, "apps/mobile/app.config.ts"), "utf8")).resolves.toContain(
        "slug: agentstackConfig.app.slug"
      );
      await expect(readFile(join(targetDir, "docs/agentstack/mobile.md"), "utf8")).resolves.toContain(
        "local mobile build rehearsal"
      );
      await expect(readFile(join(targetDir, "docs/agentstack/saas-spine.md"), "utf8")).resolves.toContain(
        "Core SaaS Spine"
      );
      await expect(readFile(join(targetDir, "docs/agentstack/skills.md"), "utf8")).resolves.toContain(
        "agentstack skills inspect"
      );
      await expect(readFile(join(targetDir, "skills/agentstack/SKILL.md"), "utf8")).resolves.toContain(
        "No MCP dependency"
      );
      await expect(readFile(join(targetDir, "docs/agentstack/preview.md"), "utf8")).resolves.toContain(
        "local preview deploy rehearsal"
      );
      await expect(readFile(join(targetDir, "packages/domain/src/saas-spine.ts"), "utf8")).resolves.toContain(
        "agentstackBillingPlans"
      );
      await expect(readFile(join(targetDir, "packages/domain/src/saas-spine.ts"), "utf8")).resolves.toContain(
        "planHasEntitlement"
      );
      await expect(readFile(join(targetDir, "packages/domain/src/index.ts"), "utf8")).resolves.toContain(
        './saas-spine.js'
      );
      await expect(readFile(join(targetDir, "convex/saasSpine.ts"), "utf8")).resolves.toContain(
        "agentstackSaasTables"
      );
      await expect(readFile(join(targetDir, "convex/saasSpine.ts"), "utf8")).resolves.toContain(
        "clerkWebhookTypes"
      );
      await expect(readFile(join(targetDir, "packages/telemetry/package.json"), "utf8")).resolves.toContain(
        "@app/telemetry"
      );
      await expect(readFile(join(targetDir, "packages/telemetry/src/index.ts"), "utf8")).resolves.toContain(
        "createAppEvent"
      );
      await expect(readFile(join(targetDir, "packages/telemetry/src/index.ts"), "utf8")).resolves.toContain(
        "AppTelemetryState"
      );
      await expect(readFile(join(targetDir, "packages/telemetry/src/index.ts"), "utf8")).resolves.toContain(
        "JsonValue"
      );
      await expect(readFile(join(targetDir, "packages/telemetry/src/index.ts"), "utf8")).resolves.toContain(
        'T extends "json" ? JsonValue'
      );
      await expect(readFile(join(targetDir, "packages/telemetry/src/events/index.ts"), "utf8")).resolves.toContain(
        "../events.js"
      );
      await expect(readFile(join(targetDir, "packages/theme/tokens.json"), "utf8")).resolves.toContain(
        '"focusRing"'
      );
      await expect(readFile(join(targetDir, "packages/theme/package.json"), "utf8")).resolves.toContain(
        "@app/theme"
      );
      await expect(readFile(join(targetDir, "packages/theme/src/index.ts"), "utf8")).resolves.toContain(
        "../tokens.json"
      );
      await expect(readFile(join(targetDir, "packages/ui/src/index.ts"), "utf8")).resolves.toContain(
        "uiPrimitives"
      );
      expect(manifest.generated.requiredAnchors).toEqual(
        expect.arrayContaining([
          "apps/mobile/app.config.ts",
          "apps/mobile/eas.json",
          "docs/agentstack/mobile.md",
          "packages/telemetry/package.json",
          "packages/telemetry/src/events.ts",
          "packages/telemetry/src/events/index.ts",
          "packages/telemetry/src/index.ts",
          "packages/theme/package.json",
          "packages/theme/tokens.json"
        ])
      );
      await expect(readFile(join(targetDir, "apps/web/src/index.ts"), "utf8")).resolves.toContain(
        "createAppTelemetry"
      );
      await expectGeneratedAnchors(targetDir);
      await expectNoTemplateTokens(targetDir);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("generates package scripts that execute from the generated project", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await expect(runPackageScript(targetDir, "validate", sourceCliEnv())).resolves.toContain(
        "PASS validate"
      );
      await expect(runPackageScript(targetDir, "validate:cloud", sourceCliEnv())).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL cloud.service.missing")
      });
      await expect(runPackageScript(targetDir, "init:cloud", sourceCliEnv())).resolves.toContain(
        "APPLIED preview"
      );
      await expect(runPackageScript(targetDir, "preview:deploy", sourceCliEnv())).resolves.toContain(
        "PLAN deploy preview"
      );
      await expect(runPackageScript(targetDir, "preview:deploy:apply", sourceCliEnv())).resolves.toContain(
        "APPLIED deploy preview"
      );
      const cloudState = JSON.parse(
        await readFile(join(targetDir, ".agentstack/local-cloud.json"), "utf8")
      );
      expect(cloudState.services).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ environment: "preview", service: "clerk", linked: true }),
          expect.objectContaining({ environment: "preview", service: "convex", linked: true }),
          expect.objectContaining({ environment: "preview", service: "vercel", linked: true }),
          expect.objectContaining({ environment: "preview", service: "eas", linked: true })
        ])
      );
      await expect(readFile(join(targetDir, ".agentstack/deployments/preview.json"), "utf8")).resolves.toContain(
        '"environment": "preview"'
      );
      await expect(runPackageScript(targetDir, "validate:cloud", sourceCliEnv())).resolves.toBeDefined();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("generated validate delegates to the real manifest schema", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      const manifestPath = join(targetDir, "agentstack.config.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      delete manifest.env.custom;
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

      await expect(runPackageScript(targetDir, "validate", sourceCliEnv())).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL manifest.invalid")
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("generates SaaS spine files that typecheck in isolation", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      const files = [
        join(targetDir, "packages/domain/src/index.ts"),
        join(targetDir, "packages/domain/src/saas-spine.ts"),
        join(targetDir, "convex/saasSpine.ts"),
        join(targetDir, "convex/schema.ts")
      ];

      await expect(
        execFileAsync(
          "pnpm",
          [
            "exec",
            "tsc",
            "--strict",
            "--module",
            "NodeNext",
            "--moduleResolution",
            "NodeNext",
            "--target",
            "ES2022",
            "--skipLibCheck",
            "--noEmit",
            ...files
          ],
          { cwd: repoRoot }
        )
      ).resolves.toBeDefined();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("does not embed local source paths when generating outside the repo", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-outside-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      const files = await listFiles(targetDir);
      const generatedContent = await Promise.all(
        files.map((file) => readFile(join(targetDir, file), "utf8"))
      );

      for (const content of generatedContent) {
        expect(content).not.toContain("<user-home>/");
        expect(content).not.toContain("__AGENTSTACK_");
      }
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("rejects names that cannot produce a slug", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "invalid");

    try {
      await expect(generateProject({ name: "!!!", targetDir })).rejects.toThrow(
        "Project name must contain at least one letter or number."
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("packaged template", () => {
  test("includes key files in the package-local template directory", async () => {
    await expect(stat(packageTemplateDir)).resolves.toMatchObject({
      isDirectory: expect.any(Function)
    });
    await expect(
      readFile(join(packageTemplateDir, "agentstack.config.json"), "utf8")
    ).resolves.toContain("__APP_SLUG__");
    await expect(
      readFile(join(packageTemplateDir, "AGENTS.md"), "utf8")
    ).resolves.toContain("Run `pnpm run validate` before completion.");
    await Promise.all(
      generatedAnchorFiles.map(async (file) => {
        await expect(stat(join(packageTemplateDir, file))).resolves.toMatchObject({
          isFile: expect.any(Function)
        });
      })
    );
  });

  test("keeps repo-root and package-local templates identical", async () => {
    const rootFiles = await listFiles(rootTemplateDir);
    const packageFiles = await listFiles(packageTemplateDir);

    expect(packageFiles).toEqual(rootFiles);

    await Promise.all(
      rootFiles.map(async (file) => {
        await expect(readFile(join(packageTemplateDir, file), "utf8")).resolves.toBe(
          await readFile(join(rootTemplateDir, file), "utf8")
        );
      })
    );
  });
});

describe("package metadata", () => {
  test("does not depend on unpublished workspace packages at runtime", async () => {
    const packageManifest = JSON.parse(
      await readFile(packageManifestPath, "utf8")
    );

    expect(packageManifest.dependencies).not.toHaveProperty("@agentstack/core");
    expect(packageManifest.bin["create-agent-stack"]).toBe("src/bin.js");
  });
});

async function expectNoTemplateTokens(directory: string): Promise<void> {
  const files = await listFiles(directory);

  await Promise.all(
    files.map(async (file) => {
      const content = await readFile(join(directory, file), "utf8");
      for (const token of templateTokens) {
        expect(content).not.toContain(token);
      }
    })
  );
}

async function expectGeneratedAnchors(directory: string): Promise<void> {
  await Promise.all(
    generatedAnchorFiles.map(async (file) => {
      await expect(stat(join(directory, file))).resolves.toMatchObject({
        isFile: expect.any(Function)
      });
    })
  );
}

function sourceCliEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    AGENTSTACK_CLI_BIN: join(repoRoot, "packages/cli/src/bin.ts"),
    AGENTSTACK_TSX_BIN: require.resolve("tsx/cli")
  };
}

async function runPackageScript(
  cwd: string,
  script: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<string> {
  const { stdout, stderr } = await execFileAsync("pnpm", ["run", script], { cwd, env });
  return `${stdout}${stderr}`;
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry);
      const entryStat = await stat(path);

      if (entryStat.isDirectory()) {
        return (await listFiles(path)).map((file) => join(entry, file));
      }

      if (entryStat.isFile()) {
        return [relative(directory, path)];
      }

      return [];
    })
  );

  return files.flat().sort();
}
