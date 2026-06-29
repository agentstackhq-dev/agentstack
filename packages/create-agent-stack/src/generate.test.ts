import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { generateProject } from "./generate.js";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(sourceDir, "..");
const repoRoot = resolve(packageRoot, "../..");
const rootTemplateDir = join(repoRoot, "templates/b2b-saas");
const packageTemplateDir = join(packageRoot, "templates/b2b-saas");
const templateTokens = ["__APP_SLUG__", "__APP_NAME__"];
const execFileAsync = promisify(execFile);

describe("generateProject", () => {
  test("generates the M2 lean package-driven app surface", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      const files = await listFiles(targetDir);
      const packageManifest = JSON.parse(await readFile(join(targetDir, "package.json"), "utf8"));
      const config = await readFile(join(targetDir, "agentstack.config.ts"), "utf8");
      const agents = await readFile(join(targetDir, "AGENTS.md"), "utf8");

      expect(files).toEqual(
        expect.arrayContaining([
          "AGENTS.md",
          ".gitignore",
          "package.json",
          "agentstack.config.ts",
          "apps/web/package.json",
          "apps/mobile/package.json",
          "apps/convex/package.json",
          "apps/convex/convex/billing.ts",
          "apps/convex/convex/http.ts"
        ])
      );
      expect(files).not.toEqual(
        expect.arrayContaining([
          "agentstack.config.json",
          "docs/provider-resource-ledger.md",
          "docs/validation-hypothesis.md",
          "scripts/agentstack.mjs",
          "scripts/m1-providers-bootstrap.mjs",
          "skills/agentstack/SKILL.md",
          "convex/schema.ts",
          "vercel.json",
          "pnpm-workspace.yaml"
        ])
      );
      expect(files.some((file) => file.startsWith("docs/"))).toBe(false);
      expect(files.some((file) => file.startsWith("scripts/"))).toBe(false);
      expect(files.some((file) => file.startsWith("skills/"))).toBe(false);
      expect(files.some((file) => file.startsWith("packages/"))).toBe(false);
      expect(files.some((file) => file.startsWith("convex/"))).toBe(false);

      expect(packageManifest.dependencies).toMatchObject({
        agentstack: expect.any(String)
      });
      expect(packageManifest.scripts).toMatchObject({
        validate: "agentstack validate",
        dev: "agentstack dev",
        "provider:bootstrap": "agentstack provider bootstrap",
        "provider:link": "agentstack provider link",
        "auth:user": "agentstack auth user",
        "preview:deploy": "agentstack deploy --env preview",
        "preview:smoke": "agentstack smoke --env preview",
        "evidence:check": "agentstack evidence check",
        "billing:bootstrap": "agentstack billing bootstrap",
        "billing:fixture": "agentstack billing fixture",
        "billing:smoke": "agentstack billing smoke"
      });
      expect(Object.values(packageManifest.scripts).join("\n")).not.toContain("scripts/");
      expect(Object.keys(packageManifest.scripts).some((script) => script.startsWith("m1:"))).toBe(false);

      expect(config).toContain('import { defineAgentstackConfig } from "agentstack/config";');
      expect(config).toContain("export default defineAgentstackConfig");
      expect(config).toContain('slug: "acme-crm"');
      expect(config).toContain("billing:");
      expect(config).toContain('"feature.auditLog"');
      expect(config).toContain('providerFeature: "audit_log"');
      expect(config).not.toContain("STRIPE_MODE");
      expect(agents).toContain("Use package-owned Agentstack CLI help instead of generated runbooks.");
      expect(agents).toContain("pnpm run billing:bootstrap");
      expect(agents).toContain("pnpm run billing:fixture");
      expect(agents).toContain("pnpm run billing:smoke");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("can generate an installable local package dependency for live consumer validation", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({
        name: "acme-crm",
        targetDir,
        packageSpec: "link:<agentstack-repo>/packages/agentstack"
      });

      const packageManifest = JSON.parse(await readFile(join(targetDir, "package.json"), "utf8"));
      expect(packageManifest.dependencies.agentstack).toBe(
        "link:<agentstack-repo>/packages/agentstack"
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("direct create-agent-stack bin accepts a local Agentstack package spec", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-bin-"));
    const packageSpec = "link:<agentstack-repo>/packages/agentstack";

    try {
      await execFileAsync(resolve(repoRoot, "node_modules/.bin/tsx"), [
        join(packageRoot, "src/bin.ts"),
        "acme-crm",
        "--package-spec",
        packageSpec
      ], {
        cwd: tempRoot
      });

      const packageManifest = JSON.parse(await readFile(join(tempRoot, "acme-crm", "package.json"), "utf8"));
      expect(packageManifest.dependencies.agentstack).toBe(packageSpec);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("replaces app tokens in config and self-contained app code", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await expect(readFile(join(targetDir, "agentstack.config.ts"), "utf8")).resolves.toContain(
        'name: "Acme Crm"'
      );
      await expect(readFile(join(targetDir, "apps/web/src/workspaceStatus.ts"), "utf8")).resolves.toContain(
        'workspaceName: "Acme Crm"'
      );
      await expect(readFile(join(targetDir, "apps/convex/convex/workspaceStatus.ts"), "utf8")).resolves.toContain(
        'workspaceName: "Acme Crm"'
      );
      const schema = await readFile(join(targetDir, "apps/convex/convex/schema.ts"), "utf8");
      expect(schema).toContain("billingWebhookEvents");
      expect(schema).toContain("billingEntitlements");
      expect(schema).toContain("billingPrincipals");
      await expect(readFile(join(targetDir, "apps/mobile/app.config.ts"), "utf8")).resolves.toContain(
        "agentstackConfig.app.slug"
      );

      const webApp = await readFile(join(targetDir, "apps/web/src/App.tsx"), "utf8");
      expect(webApp).toContain("@clerk/react");
      expect(webApp).toContain("useConvexAuth");
      expect(webApp).toContain("anyApi.workspaceStatus.protectedStatus");
      expect(webApp).toContain('data-agentstack-auth-state');
      expect(webApp).toContain('data-agentstack-protected-data-state');
      expect(webApp).toContain('data-agentstack-protected-workspace-id');
      expect(webApp).toContain("anyApi.billing.protectedEntitlementGate");
      expect(webApp).toContain('data-agentstack-entitlement-key');
      expect(webApp).toContain('data-agentstack-entitlement-state');
      expect(webApp).toContain("feature.auditLog");

      await expectNoTemplateTokens(targetDir);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("keeps root and package-local templates identical", async () => {
    expect(await readFiles(rootTemplateDir)).toEqual(await readFiles(packageTemplateDir));
  });

  test("rejects project names without a usable slug", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));

    try {
      await expect(generateProject({ name: "///", targetDir: join(tempRoot, "bad") })).rejects.toThrow(
        "Project name must contain at least one letter or number."
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});

async function expectNoTemplateTokens(targetDir: string): Promise<void> {
  const files = await readFiles(targetDir);
  for (const [file, content] of Object.entries(files)) {
    for (const token of templateTokens) {
      expect(content, `${file} still contains ${token}`).not.toContain(token);
    }
  }
}

async function listFiles(directory: string): Promise<string[]> {
  const files = await readFiles(directory);
  return Object.keys(files).sort();
}

async function readFiles(directory: string): Promise<Record<string, string>> {
  const entries = await readdir(directory);
  const files: Record<string, string> = {};

  await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry);
      const entryStat = await stat(path);

      if (entryStat.isDirectory()) {
        const childFiles = await readFiles(path);
        for (const [childPath, childContent] of Object.entries(childFiles)) {
          files[join(entry, childPath)] = childContent;
        }
        return;
      }

      if (entryStat.isFile()) {
        files[relative(directory, path)] = await readFile(path, "utf8");
      }
    })
  );

  return Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right)));
}
