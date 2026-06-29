import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, test } from "vitest";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(sourceDir, "../..");
const agentstackBin = join(repoRoot, "packages/agentstack/src/bin.js");
const agentstackPackageDir = join(repoRoot, "packages/agentstack");

let tempRoot: string | undefined;

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true });
    tempRoot = undefined;
  }
});

describe("Agentstack consumer executable workflow", () => {
  test("creates and operates a lean app through the package CLI only", async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "agentstack-consumer-"));

    const helpResult = await invokeAgentstackBin(["--help"], tempRoot);
    expect(helpResult.exitCode).toBe(0);
    expect(helpResult.stdout).toContain("agentstack create <app-name>");
    expect(helpResult.stdout).toContain("billing");

    const createResult = await invokeAgentstackBin(
      ["create", "acme-crm", "--package-spec", `link:${agentstackPackageDir}`],
      tempRoot
    );
    expect(createResult.exitCode).toBe(0);
    expect(createResult.stdout).toContain("Created acme-crm");

    const appDir = join(tempRoot, "acme-crm");
    await installLocalAgentstackPackage(appDir);

    const packageManifest = JSON.parse(await readFile(join(appDir, "package.json"), "utf8"));
    const generatedConfig = await readFile(join(appDir, "agentstack.config.ts"), "utf8");

    expect(packageManifest.dependencies).toMatchObject({ agentstack: `link:${agentstackPackageDir}` });
    expect(packageManifest.scripts).toMatchObject({
      validate: "agentstack validate",
      dev: "agentstack dev",
      "provider:bootstrap": "agentstack provider bootstrap",
      "provider:link": "agentstack provider link",
      "auth:user": "agentstack auth user",
      "billing:bootstrap": "agentstack billing bootstrap",
      "billing:fixture": "agentstack billing fixture",
      "billing:smoke": "agentstack billing smoke",
      "preview:deploy": "agentstack deploy --env preview",
      "preview:smoke": "agentstack smoke --env preview",
      "evidence:check": "agentstack evidence check"
    });
    expect(generatedConfig).toContain('import { defineAgentstackConfig } from "agentstack/config";');
    expect(generatedConfig).toContain('slug: "acme-crm"');
    expect(generatedConfig).toContain("billing:");
    expect(generatedConfig).toContain('"feature.auditLog"');
    expect(generatedConfig).toContain('providerFeature: "audit_log"');
    expect(generatedConfig).not.toContain("STRIPE_MODE");
    await expect(readFile(join(appDir, "docs/agentstack/saas-spine.md"), "utf8")).rejects.toThrow();
    await expect(readFile(join(appDir, "scripts/agentstack.mjs"), "utf8")).rejects.toThrow();
    await expect(readFile(join(appDir, "packages/domain/src/index.ts"), "utf8")).rejects.toThrow();
    await expect(readFile(join(appDir, "apps/web/src/index.ts"), "utf8")).resolves.toContain(
      "workspaceStatus"
    );
    await expect(readFile(join(appDir, "apps/mobile/src/index.ts"), "utf8")).resolves.toContain(
      "workspaceStatus"
    );
    await expect(readFile(join(appDir, "apps/convex/convex/workspaceStatus.ts"), "utf8")).resolves.toContain(
      "protectedStatus"
    );
    await expect(readFile(join(appDir, "apps/convex/convex/schema.ts"), "utf8")).resolves.toContain(
      "workspaceStatuses"
    );

    const validate = await runPackageScript("validate", [], appDir);
    expect(validate.exitCode).toBe(0);
    expect(validate.stdout).toContain("PASS validate");

    const billingBootstrapWithoutConfirm = await runPackageScript(
      "billing:bootstrap",
      ["--env", "preview"],
      appDir
    );
    expect(billingBootstrapWithoutConfirm.exitCode).toBe(1);
    expect(billingBootstrapWithoutConfirm.stdout).toContain("FAIL billing.bootstrap.confirmation-required");

    const billingFixtureWithoutConfirm = await runPackageScript(
      "billing:fixture",
      ["ensure", "--env", "preview", "--entitlement", "feature.auditLog"],
      appDir
    );
    expect(billingFixtureWithoutConfirm.exitCode).toBe(1);
    expect(billingFixtureWithoutConfirm.stdout).toContain("FAIL billing.fixture.confirmation-required");

    await mkdir(join(appDir, ".agentstack"), { recursive: true });
    await writeFile(
      join(appDir, ".agentstack", "m3-denied-dom.html"),
      [
        '<main data-agentstack-auth-state="signed-in">',
        '<section data-agentstack-protected-data-state="protected-data-loaded"></section>',
        '<section data-agentstack-entitlement-key="feature.auditLog"',
        ' data-agentstack-entitlement-state="denied"></section>',
        "</main>"
      ].join("\n"),
      "utf8"
    );
    const billingDeniedSmoke = await runPackageScript(
      "billing:smoke",
      ["--env", "preview", "--expected", "denied", "--dom-file", ".agentstack/m3-denied-dom.html"],
      appDir
    );
    expect(billingDeniedSmoke.exitCode).toBe(0);
    expect(billingDeniedSmoke.stdout).toContain("PASS billing smoke preview");

    await writeFile(
      join(appDir, ".agentstack", "m3-allowed-dom.html"),
      [
        '<main data-agentstack-auth-state="signed-in">',
        '<section data-agentstack-protected-data-state="protected-data-loaded"></section>',
        '<section data-agentstack-entitlement-key="feature.auditLog"',
        ' data-agentstack-entitlement-state="allowed"></section>',
        "</main>"
      ].join("\n"),
      "utf8"
    );
    const billingAllowedSmoke = await runPackageScript(
      "billing:smoke",
      ["--env", "preview", "--expected", "allowed", "--dom-file", ".agentstack/m3-allowed-dom.html"],
      appDir
    );
    expect(billingAllowedSmoke.exitCode).toBe(0);
    expect(billingAllowedSmoke.stdout).toContain("Entitlement state: allowed");

    const m3EvidenceMissing = await runPackageScript(
      "evidence:check",
      ["--env", "preview", "--milestone", "M3"],
      appDir
    );
    expect(m3EvidenceMissing.exitCode).toBe(1);
    expect(m3EvidenceMissing.stdout).toContain("Evidence: m3-evidence-check");

    const previewDeployPlan = await runPackageScript("preview:deploy", [], appDir);
    expect(previewDeployPlan.exitCode).toBe(0);
    expect(previewDeployPlan.stdout).toContain("PLAN deploy preview");
    expect(previewDeployPlan.stdout).toContain("Evidence: local-rehearsal");

    const previewDeployApply = await runPackageScript("preview:deploy", ["--apply"], appDir);
    expect(previewDeployApply.exitCode).toBe(0);
    expect(previewDeployApply.stdout).toContain("APPLIED deploy preview");
    await expect(readFile(join(appDir, ".agentstack/deployments/preview.json"), "utf8")).resolves.toContain(
      '"environment": "preview"'
    );
  }, 15000);
});

async function installLocalAgentstackPackage(appDir: string): Promise<void> {
  await mkdir(join(appDir, "node_modules", ".bin"), { recursive: true });
  await symlink(agentstackPackageDir, join(appDir, "node_modules", "agentstack"), "dir");
  await symlink(join(agentstackPackageDir, "src/bin.js"), join(appDir, "node_modules", ".bin", "agentstack"));
  await access(join(appDir, "node_modules", ".bin", "agentstack"), constants.X_OK);
}

async function invokeAgentstackBin(args: string[], cwd: string): Promise<CommandResult> {
  return await runCommand(process.execPath, [agentstackBin, ...args], cwd);
}

async function runPackageScript(script: string, args: string[], cwd: string): Promise<CommandResult> {
  return await runCommand("pnpm", ["run", script, ...args], cwd);
}

type CommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

async function runCommand(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return await new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN: "false",
        PATH: [join(cwd, "node_modules", ".bin"), process.env.PATH].filter(Boolean).join(":")
      }
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolvePromise({ exitCode, stdout, stderr });
    });
  });
}
