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

    const createResult = await invokeAgentstackBin(["create", "acme-crm"], tempRoot);
    expect(createResult.exitCode).toBe(0);
    expect(createResult.stdout).toContain("Created acme-crm");

    const appDir = join(tempRoot, "acme-crm");
    await installLocalAgentstackPackage(appDir);

    const packageManifest = JSON.parse(await readFile(join(appDir, "package.json"), "utf8"));
    const configPath = join(appDir, "agentstack.config.ts");
    const generatedConfig = await readFile(configPath, "utf8");

    expect(packageManifest.dependencies).toMatchObject({ agentstack: expect.any(String) });
    expect(packageManifest.scripts).toMatchObject({
      validate: "agentstack validate",
      dev: "agentstack dev",
      "provider:bootstrap": "agentstack provider bootstrap",
      "provider:link": "agentstack provider link",
      "auth:user": "agentstack auth user",
      "preview:deploy": "agentstack deploy --env preview",
      "preview:smoke": "agentstack smoke --env preview",
      "evidence:check": "agentstack evidence check"
    });
    expect(generatedConfig).toContain('import { defineAgentstackConfig } from "agentstack/config";');
    expect(generatedConfig).toContain('slug: "acme-crm"');
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
    await writeFile(configPath, generatedConfig.replace("required: false", "required: true"));

    const firstValidate = await runPackageScript("validate", [], appDir);
    expect(firstValidate.exitCode).toBe(1);
    expect(firstValidate.stdout).toContain("FAIL env.custom.missing");

    const setPreviewEnv = await invokeAgentstackBin(
      ["env", "set", "--env", "preview", "--surface", "convex", "--name", "STRIPE_MODE", "--value", "sandbox"],
      appDir
    );
    expect(setPreviewEnv.exitCode).toBe(0);
    expect(setPreviewEnv.stdout).toContain("PASS env set preview convex.STRIPE_MODE");

    const setProductionEnv = await invokeAgentstackBin(
      ["env", "set", "--env", "production", "--surface", "convex", "--name", "STRIPE_MODE", "--value", "live"],
      appDir
    );
    expect(setProductionEnv.exitCode).toBe(0);
    expect(setProductionEnv.stdout).toContain("PASS env set production convex.STRIPE_MODE");

    const validate = await runPackageScript("validate", [], appDir);
    expect(validate.exitCode).toBe(0);
    expect(validate.stdout).toContain("PASS validate");

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
  });
});

async function installLocalAgentstackPackage(appDir: string): Promise<void> {
  const agentstackPackageDir = join(repoRoot, "packages/agentstack");
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
