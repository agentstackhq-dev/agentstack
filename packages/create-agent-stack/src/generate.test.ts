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
  "docs/agentstack/workspace-status.md",
  "docs/provider-resource-ledger.md",
  "skills/agentstack/SKILL.md",
  "skills/agentstack/references/workflows.md",
  "skills/agentstack/references/guardrails.md",
  "skills/agentstack/references/observability.md",
  "packages/domain/package.json",
  "packages/domain/src/workspace-status.ts",
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
  "apps/mobile/App.tsx",
  "apps/mobile/eas.json",
  "apps/mobile/src/App.tsx",
  "apps/web/index.html",
  "apps/web/src/App.tsx",
  "apps/web/src/main.tsx",
  "apps/web/src/index.ts",
  "apps/mobile/src/index.ts",
  "convex/agentstack.ts",
  "convex/saasSpine.ts",
  "convex/schema.ts",
  "convex/workspaceStatus.ts",
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
      expect(manifest.env.custom.STRIPE_MODE.providerTargets).toEqual([
        {
          service: "convex",
          surfaces: ["convex"],
          environments: ["preview", "production"],
          source: "local-value"
        }
      ]);
      expect(packageManifest.packageManager).toBe("pnpm@9.15.4");
      expect(agents).toContain("Run `pnpm run validate` before completion for structural checks.");
      expect(agents).toContain("Run `pnpm run validate:quality` before completion when code changed");
      expect(gitignore).toContain(".agentstack/");
      expect(gitignore).toContain(".env.*");
      expect(gitignore).toContain("!.env.example");
      expect(packageManifest.scripts).toMatchObject({
        inspect: "node scripts/agentstack.mjs inspect --env preview",
        doctor: "node scripts/agentstack.mjs doctor --env preview",
        dev: "node scripts/agentstack.mjs dev --env preview",
        typecheck: "pnpm --filter @app/web build",
        test: "node scripts/agentstack.mjs theme validate",
        validate: "node scripts/agentstack.mjs validate",
        "validate:quality": "node scripts/agentstack.mjs validate --quality",
        "validate:live:preview": "node scripts/agentstack.mjs validate --live --env preview",
        "env:inspect": "node scripts/agentstack.mjs env inspect --env preview",
        "preview:plan": "node scripts/agentstack.mjs sync --env preview",
        "preview:apply": "node scripts/agentstack.mjs sync --env preview --apply",
        "preview:validate": "node scripts/agentstack.mjs validate --cloud --env preview",
        "preview:deploy": "node scripts/agentstack.mjs deploy --env preview",
        "preview:deploy:apply": "node scripts/agentstack.mjs deploy --env preview --apply",
        "provider:preview:plan": "node scripts/agentstack.mjs provider plan --env preview --all",
        "provider:preview:reconcile": "node scripts/agentstack.mjs provider reconcile --env preview --plan",
        "provider:clerk:preview": "node scripts/agentstack.mjs provider plan --service clerk --env preview",
        "provider:clerk:production": "node scripts/agentstack.mjs provider plan --service clerk --env production",
        "provider:convex:preview": "node scripts/agentstack.mjs provider plan --service convex --env preview",
        "provider:convex:production": "node scripts/agentstack.mjs provider plan --service convex --env production",
        "provider:vercel:preview": "node scripts/agentstack.mjs provider plan --service vercel --env preview",
        "provider:vercel:inspect:preview": "node scripts/agentstack.mjs provider inspect --service vercel --env preview",
        "provider:vercel:production": "node scripts/agentstack.mjs provider plan --service vercel --env production",
        "prod:prepare": "node scripts/agentstack.mjs prod prepare",
        "prod:provision": "node scripts/agentstack.mjs prod provision",
        "prod:provision:apply": "node scripts/agentstack.mjs prod provision --apply",
        "prod:validate": "node scripts/agentstack.mjs validate --release production",
        "prod:deploy": "node scripts/agentstack.mjs deploy --env production",
        "prod:deploy:apply": "node scripts/agentstack.mjs deploy --env production --apply --confirm-production",
        "mobile:build:development": "node scripts/agentstack.mjs build mobile --env development",
        "mobile:build:preview": "node scripts/agentstack.mjs build mobile --env preview",
        "mobile:build:preview:apply": "node scripts/agentstack.mjs build mobile --env preview --apply",
        "mobile:build:production": "node scripts/agentstack.mjs build mobile --env production",
        "theme:validate": "node scripts/agentstack.mjs theme validate",
        "skills:inspect": "node scripts/agentstack.mjs skills inspect",
        "observe:timeline": "node scripts/agentstack.mjs observe timeline --journey smoke --env preview",
        "telemetry:export:preview": "node scripts/agentstack.mjs observe export --env preview --format otlp-json",
        "telemetry:export:production": "node scripts/agentstack.mjs observe export --env production --format otlp-json"
      });
      expect(packageManifest.scripts).not.toHaveProperty("sync:preview");
      expect(packageManifest.scripts).not.toHaveProperty("sync:preview:apply");
      expect(packageManifest.scripts).not.toHaveProperty("mobile:build:plan");
      expect(packageManifest.scripts).not.toHaveProperty("mobile:build:apply");
      expect(packageManifest.scripts).not.toHaveProperty("validate:cloud");
      expect(packageManifest.devDependencies).toMatchObject({
        clerk: expect.any(String),
        convex: "^1.41.0",
        "eas-cli": "^20.3.0",
        vercel: "^54.14.5"
      });
      expect(packageManifest.scripts["provider:eas:preview"]).toBe(
        "node scripts/agentstack.mjs provider plan --service eas --env preview"
      );
      expect(packageManifest.scripts["provider:eas:production"]).toBe(
        "node scripts/agentstack.mjs provider plan --service eas --env production"
      );
      expect(packageManifest.scripts).toMatchObject({
        "provider:clerk:inventory:preview": "node scripts/agentstack.mjs provider inventory --service clerk --env preview",
        "provider:clerk:inventory:production": "node scripts/agentstack.mjs provider inventory --service clerk --env production",
        "provider:clerk:link:preview": "node scripts/agentstack.mjs provider link --service clerk --env preview --resource-type application --name acme-crm-preview",
        "provider:clerk:link:production": "node scripts/agentstack.mjs provider link --service clerk --env production --resource-type application --name acme-crm-production",
        "provider:clerk:proof:preview": "node scripts/agentstack.mjs provider proof --service clerk --env preview --resource-type application --name acme-crm-preview",
        "provider:convex:inventory:preview": "node scripts/agentstack.mjs provider inventory --service convex --env preview",
        "provider:convex:inventory:production": "node scripts/agentstack.mjs provider inventory --service convex --env production",
        "provider:convex:link:preview": "node scripts/agentstack.mjs provider link --service convex --env preview --resource-type deployment --name acme-crm-preview",
        "provider:convex:link:production": "node scripts/agentstack.mjs provider link --service convex --env production --resource-type deployment --name prod",
        "provider:convex:proof:preview": "node scripts/agentstack.mjs provider proof --service convex --env preview --resource-type deployment --name acme-crm-preview",
        "provider:vercel:inventory:preview": "node scripts/agentstack.mjs provider inventory --service vercel --env preview",
        "provider:vercel:inventory:production": "node scripts/agentstack.mjs provider inventory --service vercel --env production",
        "provider:vercel:link:preview": "node scripts/agentstack.mjs provider link --service vercel --env preview --resource-type project --name acme-crm",
        "provider:vercel:link:production": "node scripts/agentstack.mjs provider link --service vercel --env production --resource-type project --name acme-crm",
        "provider:vercel:proof:preview": "node scripts/agentstack.mjs provider proof --service vercel --env preview --resource-type project --name acme-crm",
        "provider:eas:inventory:preview": "node scripts/agentstack.mjs provider inventory --service eas --env preview",
        "provider:eas:inventory:production": "node scripts/agentstack.mjs provider inventory --service eas --env production",
        "provider:eas:link:preview": "node scripts/agentstack.mjs provider link --service eas --env preview --resource-type project --name acme-crm",
        "provider:eas:link:production": "node scripts/agentstack.mjs provider link --service eas --env production --resource-type project --name acme-crm",
        "provider:eas:proof:preview": "node scripts/agentstack.mjs provider proof --service eas --env preview --resource-type project --name acme-crm"
      });
      expectNoProviderAliasScripts(packageManifest.scripts);
      expectNoProviderAdoptScripts(packageManifest.scripts);
      expect(manifest.generated.requiredAnchors).toEqual(
        expect.arrayContaining([
          "apps/mobile/app.config.ts",
          "apps/mobile/eas.json",
          "docs/agentstack/mobile.md",
          "packages/domain/src/saas-spine.ts",
          "apps/web/src/index.ts",
          "apps/mobile/src/index.ts",
          "convex/agentstack.ts",
          "convex/saasSpine.ts",
          "docs/agentstack/saas-spine.md"
        ])
      );
      const mobilePackageManifest = JSON.parse(
        await readFile(join(targetDir, "apps/mobile/package.json"), "utf8")
      );
      expect(mobilePackageManifest.scripts).toMatchObject({
        dev: "expo start --lan",
        start: "expo start --lan",
        "dev-client": "expo start --dev-client --lan",
        "build:development": "node ../../scripts/agentstack.mjs build mobile --env development",
        "build:preview": "node ../../scripts/agentstack.mjs build mobile --env preview",
        "build:preview:apply": "node ../../scripts/agentstack.mjs build mobile --env preview --apply",
        "build:production": "node ../../scripts/agentstack.mjs build mobile --env production",
        "provider:eas:preview": "node ../../scripts/agentstack.mjs provider plan --service eas --env preview",
        "provider:eas:production": "node ../../scripts/agentstack.mjs provider plan --service eas --env production",
        "provider:eas:inventory:preview": "node ../../scripts/agentstack.mjs provider inventory --service eas --env preview",
        "provider:eas:inventory:production": "node ../../scripts/agentstack.mjs provider inventory --service eas --env production",
        "provider:eas:link:preview": "node ../../scripts/agentstack.mjs provider link --service eas --env preview --resource-type project --name acme-crm",
        "provider:eas:link:production": "node ../../scripts/agentstack.mjs provider link --service eas --env production --resource-type project --name acme-crm",
        "provider:eas:proof:preview": "node ../../scripts/agentstack.mjs provider proof --service eas --env preview --resource-type project --name acme-crm"
      });
      expectNoProviderAliasScripts(mobilePackageManifest.scripts);
      expectNoProviderAdoptScripts(mobilePackageManifest.scripts);
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
      const generatedEnvironmentDocs = await readFile(
        join(targetDir, "docs/agentstack/environments.md"),
        "utf8"
      );
      expect(generatedEnvironmentDocs).toContain("Evidence: local-inventory");
      expect(generatedEnvironmentDocs).toContain("Evidence: ledger-local-inventory");
      expect(generatedEnvironmentDocs).toContain("does not call provider CLIs");
      expect(generatedEnvironmentDocs).toContain("validate --live --env <preview|production>");
      expect(generatedEnvironmentDocs).toContain("Evidence: live-validation");
      expect(generatedEnvironmentDocs).toContain("Readiness: refused");
      expect(generatedEnvironmentDocs).toContain("Local mutation: .agentstack/provider-links.json");
      expect(generatedEnvironmentDocs).toContain("Provider mutation: none");
      expect(generatedEnvironmentDocs).toContain("Ledger mutation: none");
      expect(generatedEnvironmentDocs).toContain("Local adopt is the default source mode");
      expect(generatedEnvironmentDocs).toContain("FAIL provider.link.identity-ambiguous");
      expect(generatedEnvironmentDocs).toContain(
        "Successful structured Convex preview env-list evidence may reduce missing-proof guidance with sanitized `provider-environment-scope`"
      );
      expect(generatedEnvironmentDocs).toContain("Identity proof requirements:");
      expect(generatedEnvironmentDocs).toContain("There is no `--live` shorthand for adopt");
      expect(generatedEnvironmentDocs).toContain("not proof of external provider existence");
      expect(generatedEnvironmentDocs).toContain("ledger-gated through supported provider apply commands");
      const generatedPreviewDocs = await readFile(join(targetDir, "docs/agentstack/preview.md"), "utf8");
      expect(generatedPreviewDocs).toContain("provider inventory --service convex --env preview");
      expect(generatedPreviewDocs).toContain("provider link --service convex --env preview");
      expect(generatedPreviewDocs).toContain("provider adopt --service convex --env preview");
      expect(generatedPreviewDocs).toContain("does not mutate the root provider ledger");
      expect(generatedPreviewDocs).toContain("sanitized identity proof requirements");
      const generatedWorkflowDocs = await readFile(join(targetDir, "docs/agentstack/workflows.md"), "utf8");
      expect(generatedWorkflowDocs).toContain("simulator state");
      expect(generatedWorkflowDocs).toContain("not proof of external provider existence");
      expect(generatedWorkflowDocs).toContain("sanitized `missing=` identity proof labels");
      expect(generatedWorkflowDocs).toContain("pnpm run validate:live:preview");
      expect(generatedWorkflowDocs).toContain("live validation refuses readiness");
      const generatedValidationDocs = await readFile(join(targetDir, "docs/agentstack/validation.md"), "utf8");
      expect(generatedValidationDocs).toContain("pnpm run validate:live:preview");
      expect(generatedValidationDocs).toContain("Evidence: live-validation");
      expect(generatedValidationDocs).toContain("identity-ambiguous");
      await expect(readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8")).resolves.toContain(
        "## Ledger"
      );
      await expect(readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8")).resolves.toContain(
        "| id | provider | resource type | environment | owner account/project | name | external id/url | purpose | created by | created at | expected cleanup trigger/date | current status | cleanup command/procedure | cleaned at | evidence link/path | notes |"
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
      await expect(readFile(join(targetDir, "packages/domain/src/index.ts"), "utf8")).resolves.toContain(
        './workspace-status.js'
      );
      await expect(readFile(join(targetDir, "apps/web/src/index.ts"), "utf8")).resolves.toContain(
        "workspace-status"
      );
      await expect(readFile(join(targetDir, "apps/mobile/src/index.ts"), "utf8")).resolves.toContain(
        "mobileWorkspaceStatusAnchor"
      );
      await expect(readFile(join(targetDir, "apps/web/src/App.tsx"), "utf8")).resolves.toContain(
        "Workspace status"
      );
      await expect(readFile(join(targetDir, "apps/mobile/src/App.tsx"), "utf8")).resolves.toContain(
        "Workspace status"
      );
      await expect(readFile(join(targetDir, "apps/mobile/App.tsx"), "utf8")).resolves.toContain(
        './src/App'
      );
      await expect(readFile(join(targetDir, "convex/agentstack.ts"), "utf8")).resolves.toContain(
        "convexRuntime"
      );
      await expect(readFile(join(targetDir, "convex/schema.ts"), "utf8")).resolves.toContain(
        "workspaceStatuses"
      );
      await expect(readFile(join(targetDir, "convex/workspaceStatus.ts"), "utf8")).resolves.toContain(
        "checklistProgress"
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
        "createAppSpan"
      );
      await expect(readFile(join(targetDir, "packages/telemetry/src/index.ts"), "utf8")).resolves.toContain(
        "createAppJourney"
      );
      await expect(readFile(join(targetDir, "packages/telemetry/src/index.ts"), "utf8")).resolves.toContain(
        "redactAppTelemetryState"
      );
      await expect(readFile(join(targetDir, "packages/telemetry/src/index.ts"), "utf8")).resolves.toContain(
        "AppTelemetrySpanEnvelope"
      );
      await expect(readFile(join(targetDir, "packages/telemetry/src/index.ts"), "utf8")).resolves.toContain(
        "AppTelemetryJourneyEnvelope"
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
      await expect(readFile(join(targetDir, "packages/agentstack-runtime/src/index.ts"), "utf8")).resolves.toContain(
        "identify(identity"
      );
      await expect(readFile(join(targetDir, "packages/agentstack-runtime/src/index.ts"), "utf8")).resolves.toContain(
        "span(name"
      );
      await expect(readFile(join(targetDir, "packages/agentstack-runtime/src/index.ts"), "utf8")).resolves.toContain(
        "journey(journey"
      );
      await expect(readFile(join(targetDir, "packages/agentstack-runtime/src/index.ts"), "utf8")).resolves.toContain(
        "redact(state"
      );
      await expect(readFile(join(targetDir, "apps/web/src/index.ts"), "utf8")).resolves.toContain(
        "webWorkspaceStatusSpanAnchor"
      );
      await expect(readFile(join(targetDir, "apps/web/src/index.ts"), "utf8")).resolves.toContain(
        "webWorkspaceStatusJourneyAnchor"
      );
      await expect(readFile(join(targetDir, "apps/mobile/src/index.ts"), "utf8")).resolves.toContain(
        "mobileWorkspaceStatusSpanAnchor"
      );
      await expect(readFile(join(targetDir, "convex/agentstack.ts"), "utf8")).resolves.toContain(
        "convexWorkspaceStatusJourneyAnchor"
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
      await expect(runPackageScript(targetDir, "preview:validate", sourceCliEnv())).rejects.toMatchObject({
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
      await expect(runPackageScript(targetDir, "preview:validate", sourceCliEnv())).resolves.toBeDefined();
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
        join(targetDir, "packages/domain/src/workspace-status.ts"),
        join(targetDir, "convex/saasSpine.ts")
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

  test("generates telemetry and runtime anchors that typecheck in isolation", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      const files = [
        join(targetDir, "packages/telemetry/src/events.ts"),
        join(targetDir, "packages/telemetry/src/events/index.ts"),
        join(targetDir, "packages/telemetry/src/index.ts"),
        join(targetDir, "packages/agentstack-runtime/src/index.ts"),
        join(targetDir, "apps/web/src/index.ts"),
        join(targetDir, "apps/mobile/src/index.ts"),
        join(targetDir, "convex/agentstack.ts")
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
    ).resolves.toContain("Run `pnpm run validate` before completion for structural checks.");
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

function expectNoProviderAliasScripts(scripts: Record<string, string>): void {
  const staleAliases = ["import", "connect", "attach", "discover", "resources"];

  for (const scriptName of Object.keys(scripts)) {
    for (const alias of staleAliases) {
      expect(scriptName).not.toMatch(new RegExp(`(^|:)${alias}(:|$)`));
    }
  }

  for (const scriptCommand of Object.values(scripts)) {
    for (const alias of staleAliases) {
      expect(scriptCommand).not.toContain(` provider ${alias} `);
    }
  }
}

function expectNoProviderAdoptScripts(scripts: Record<string, string>): void {
  for (const scriptName of Object.keys(scripts)) {
    expect(scriptName).not.toMatch(/(^|:)adopt(:|$)/);
  }

  for (const scriptCommand of Object.values(scripts)) {
    expect(scriptCommand).not.toContain(" provider adopt ");
  }
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
