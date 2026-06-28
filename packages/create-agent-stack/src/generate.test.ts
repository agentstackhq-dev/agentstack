import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
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
  "docs/milestones/M1-preview-e2e.md",
  "docs/milestones/evidence/M1-preview-e2e/.gitkeep",
  "docs/milestones/evidence/M1-preview-e2e/README.md",
  "docs/milestones/evidence/M1-preview-e2e/runbook.md",
  "docs/provider-resource-ledger.md",
  "docs/validation-hypothesis.md",
  "scripts/m1-evidence-check.mjs",
  "scripts/m1-auth-user.mjs",
  "scripts/m1-ledger-record.mjs",
  "scripts/m1-providers-bootstrap.mjs",
  "scripts/m1-providers-link.mjs",
  "scripts/m1-preview-deploy.mjs",
  "scripts/m1-preview-smoke.mjs",
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
  "convex/auth.config.ts",
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
      const webPackageManifest = JSON.parse(
        await readFile(join(targetDir, "apps/web/package.json"), "utf8")
      );
      const envExample = await readFile(join(targetDir, ".env.example"), "utf8");

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
      expect(envExample).toContain("VITE_CLERK_PUBLISHABLE_KEY=pk_test_replace_me");
      expect(envExample).toContain("VITE_CONVEX_URL=<convex-url>");
      expect(envExample).toContain("CLERK_JWT_ISSUER_DOMAIN=https://replace-me.clerk.accounts.dev");
      expect(envExample).not.toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
      expect(envExample).not.toContain("NEXT_PUBLIC_CONVEX_URL");
      expect(webPackageManifest.dependencies).toMatchObject({
        "@clerk/react": expect.any(String),
        convex: expect.any(String)
      });
      expect(webPackageManifest.dependencies["@clerk/react"]).toMatch(/^\^6\./);
      expect(agents).toContain("Run `pnpm run validate` before completion for structural checks.");
      expect(agents).toContain("docs/validation-hypothesis.md");
      expect(agents).toContain("docs/milestones/M1-preview-e2e.md");
      expect(agents).toContain("Run `pnpm run validate:quality` before completion when code changed");
      expect(agents).toContain("pnpm run validate:live:production");
      expect(agents).toContain("M1 preview helpers are the exception");
      expect(agents).toContain("m1:preview:deploy");
      expect(agents).toContain("m1:evidence:check");
      expect(agents).toContain("Provider mutation: convex preview apply, vercel preview deploy");
      expect(gitignore).toContain(".agentstack/");
      expect(gitignore).toContain(".env.*");
      expect(gitignore).toContain("!.env.example");
      expect(packageManifest.scripts).toMatchObject({
        inspect: "node scripts/agentstack.mjs inspect --env preview",
        doctor: "node scripts/agentstack.mjs doctor --env preview",
        dev: "node scripts/agentstack.mjs dev --env preview",
        lint: "pnpm run typecheck",
        typecheck: "pnpm --filter @app/web build",
        build: "pnpm -r --if-present build",
        "format:check": "node scripts/agentstack.mjs format --check",
        "generated:check": "node scripts/agentstack.mjs generated validate",
        test: "node scripts/agentstack.mjs theme validate",
        validate: "node scripts/agentstack.mjs validate",
        "validate:quality": "node scripts/agentstack.mjs validate --quality",
        "validate:live:preview": "node scripts/agentstack.mjs validate --live --env preview",
        "validate:live:production": "node scripts/agentstack.mjs validate --live --env production",
        "env:inspect": "node scripts/agentstack.mjs env inspect --env preview",
        "preview:plan": "node scripts/agentstack.mjs sync --env preview",
        "preview:apply": "node scripts/agentstack.mjs sync --env preview --apply",
        "preview:validate": "node scripts/agentstack.mjs validate --cloud --env preview",
        "preview:deploy": "node scripts/agentstack.mjs deploy --env preview",
        "preview:deploy:apply": "node scripts/agentstack.mjs deploy --env preview --apply",
        "provider:preview:plan": "node scripts/agentstack.mjs provider plan --env preview --all",
        "provider:production:plan": "node scripts/agentstack.mjs provider plan --env production --all",
        "provider:preview:reconcile": "node scripts/agentstack.mjs provider reconcile --env preview --plan",
        "provider:production:reconcile": "node scripts/agentstack.mjs provider reconcile --env production --plan",
        "provider:preview:reconcile:live":
          "node scripts/agentstack.mjs provider reconcile --env preview --plan --source live",
        "provider:production:reconcile:live":
          "node scripts/agentstack.mjs provider reconcile --env production --plan --source live",
        "m1:evidence:check": "node scripts/m1-evidence-check.mjs",
        "m1:auth:user": "node scripts/m1-auth-user.mjs",
        "m1:ledger:record": "node scripts/m1-ledger-record.mjs",
        "m1:providers:bootstrap": "node scripts/m1-providers-bootstrap.mjs",
        "m1:providers:link": "node scripts/m1-providers-link.mjs",
        "m1:preview:deploy": "node scripts/m1-preview-deploy.mjs",
        "m1:preview:smoke": "node scripts/m1-preview-smoke.mjs",
        "provider:ledger:record": "node scripts/agentstack.mjs provider ledger record",
        "provider:clerk:preview": "node scripts/agentstack.mjs provider plan --service clerk --env preview",
        "provider:clerk:production": "node scripts/agentstack.mjs provider plan --service clerk --env production",
        "provider:convex:preview": "node scripts/agentstack.mjs provider plan --service convex --env preview",
        "provider:convex:production": "node scripts/agentstack.mjs provider plan --service convex --env production",
        "provider:convex:inspect:production": "node scripts/agentstack.mjs provider inspect --service convex --env production",
        "provider:vercel:preview": "node scripts/agentstack.mjs provider plan --service vercel --env preview",
        "provider:vercel:inspect:preview": "node scripts/agentstack.mjs provider inspect --service vercel --env preview",
        "provider:vercel:inspect:production": "node scripts/agentstack.mjs provider inspect --service vercel --env production",
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
      expect(packageManifest.scripts["provider:eas:inspect:production"]).toBe(
        "node scripts/agentstack.mjs provider inspect --service eas --env production"
      );
      expect(packageManifest.scripts).toMatchObject({
        "provider:clerk:inventory:preview": "node scripts/agentstack.mjs provider inventory --service clerk --env preview",
        "provider:clerk:inventory:production": "node scripts/agentstack.mjs provider inventory --service clerk --env production",
        "provider:clerk:link:preview": "node scripts/agentstack.mjs provider link --service clerk --env preview --resource-type application --name acme-crm-preview",
        "provider:clerk:link:production": "node scripts/agentstack.mjs provider link --service clerk --env production --resource-type application --name acme-crm-production",
        "provider:clerk:proof:preview": "node scripts/agentstack.mjs provider proof --service clerk --env preview --resource-type application --name acme-crm-preview",
        "provider:clerk:proof:production": "node scripts/agentstack.mjs provider proof --service clerk --env production --resource-type application --name acme-crm-production",
        "provider:convex:inventory:preview": "node scripts/agentstack.mjs provider inventory --service convex --env preview",
        "provider:convex:inventory:production": "node scripts/agentstack.mjs provider inventory --service convex --env production",
        "provider:convex:link:preview": "node scripts/agentstack.mjs provider link --service convex --env preview --resource-type deployment --name acme-crm-preview",
        "provider:convex:link:production": "node scripts/agentstack.mjs provider link --service convex --env production --resource-type deployment --name prod",
        "provider:convex:proof:preview": "node scripts/agentstack.mjs provider proof --service convex --env preview --resource-type deployment --name acme-crm-preview",
        "provider:convex:proof:production": "node scripts/agentstack.mjs provider proof --service convex --env production --resource-type deployment --name prod",
        "provider:vercel:inventory:preview": "node scripts/agentstack.mjs provider inventory --service vercel --env preview",
        "provider:vercel:inventory:production": "node scripts/agentstack.mjs provider inventory --service vercel --env production",
        "provider:vercel:link:preview": "node scripts/agentstack.mjs provider link --service vercel --env preview --resource-type project --name acme-crm",
        "provider:vercel:link:production": "node scripts/agentstack.mjs provider link --service vercel --env production --resource-type project --name acme-crm",
        "provider:vercel:proof:preview": "node scripts/agentstack.mjs provider proof --service vercel --env preview --resource-type project --name acme-crm",
        "provider:vercel:proof:production": "node scripts/agentstack.mjs provider proof --service vercel --env production --resource-type project --name acme-crm",
        "provider:eas:inventory:preview": "node scripts/agentstack.mjs provider inventory --service eas --env preview",
        "provider:eas:inventory:production": "node scripts/agentstack.mjs provider inventory --service eas --env production",
        "provider:eas:link:preview": "node scripts/agentstack.mjs provider link --service eas --env preview --resource-type project --name acme-crm",
        "provider:eas:link:production": "node scripts/agentstack.mjs provider link --service eas --env production --resource-type project --name acme-crm",
        "provider:eas:proof:preview": "node scripts/agentstack.mjs provider proof --service eas --env preview --resource-type project --name acme-crm",
        "provider:eas:proof:production": "node scripts/agentstack.mjs provider proof --service eas --env production --resource-type project --name acme-crm"
      });
      expectNoProviderAliasScripts(packageManifest.scripts);
      expectNoProviderAdoptScripts(packageManifest.scripts);
      expect(manifest.generated.requiredAnchors).toEqual(
        expect.arrayContaining([
          "apps/mobile/app.config.ts",
          "apps/mobile/eas.json",
          "vercel.json",
          "docs/agentstack/mobile.md",
          "packages/domain/src/saas-spine.ts",
          "apps/web/src/index.ts",
          "apps/mobile/src/index.ts",
          "convex/auth.config.ts",
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
        "provider:eas:inspect:production": "node ../../scripts/agentstack.mjs provider inspect --service eas --env production",
        "provider:eas:inventory:preview": "node ../../scripts/agentstack.mjs provider inventory --service eas --env preview",
        "provider:eas:inventory:production": "node ../../scripts/agentstack.mjs provider inventory --service eas --env production",
        "provider:eas:link:preview": "node ../../scripts/agentstack.mjs provider link --service eas --env preview --resource-type project --name acme-crm",
        "provider:eas:link:production": "node ../../scripts/agentstack.mjs provider link --service eas --env production --resource-type project --name acme-crm",
        "provider:eas:proof:preview": "node ../../scripts/agentstack.mjs provider proof --service eas --env preview --resource-type project --name acme-crm",
        "provider:eas:proof:production": "node ../../scripts/agentstack.mjs provider proof --service eas --env production --resource-type project --name acme-crm"
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
        "Successful structured Convex preview/production env-list evidence may reduce missing-proof guidance with sanitized `provider-environment-scope`"
      );
      expect(generatedEnvironmentDocs).toContain("Identity proof requirements:");
      expect(generatedEnvironmentDocs).toContain("FAIL provider.adopt.live-coherence-blocked");
      expect(generatedEnvironmentDocs).toContain("There is no `--live` shorthand for adopt");
      expect(generatedEnvironmentDocs).toContain("not proof of external provider existence");
      expect(generatedEnvironmentDocs).toContain("ledger-gated through supported provider apply commands");
      expect(generatedEnvironmentDocs).toContain("matching strict provider-owned evidence may surface `identity=matched identity-scope=exact`");
      expect(generatedEnvironmentDocs).toContain("Exact identity in inventory is still diagnostic only");
      expect(generatedEnvironmentDocs).toContain("Exact identity evidence");
      expect(generatedEnvironmentDocs).toContain("instead of candidate missing-proof guidance");
      expect(generatedEnvironmentDocs).toContain("Lifecycle: create|provision|update|no-op|blocked");
      expect(generatedEnvironmentDocs).toContain("for every expected Clerk, Convex, Vercel, and EAS");
      expect(generatedEnvironmentDocs).toContain("provider reconcile --env <preview|production> --plan --source live");
      expect(generatedEnvironmentDocs).toContain("Evidence: live-reconciliation-plan");
      expect(generatedEnvironmentDocs).toContain("Reason: live-read-failed");
      expect(generatedEnvironmentDocs).toContain("per-service proof diagnostics");
      expect(generatedEnvironmentDocs).toContain("generated root `vercel.json`");
      const generatedPreviewDocs = await readFile(join(targetDir, "docs/agentstack/preview.md"), "utf8");
      const generatedValidationHypothesis = await readFile(join(targetDir, "docs/validation-hypothesis.md"), "utf8");
      const generatedM1Milestone = await readFile(join(targetDir, "docs/milestones/M1-preview-e2e.md"), "utf8");
      const generatedM1EvidenceDocs = await readFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/README.md"),
        "utf8"
      );
      const generatedM1Runbook = await readFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/runbook.md"),
        "utf8"
      );
      expect(generatedValidationHypothesis).toContain("Agentstack Validation Hypothesis");
      expect(generatedValidationHypothesis).toContain("Generate an app from the B2B SaaS template");
      expect(generatedValidationHypothesis).toContain("m1:providers:bootstrap");
      expect(generatedValidationHypothesis).toContain("Provider CLI login links");
      expect(generatedValidationHypothesis).toContain("Produce a redacted evidence bundle");
      expect(generatedM1Milestone).toContain("M1: Preview E2E");
      expect(generatedM1Milestone).toContain("Preview environment only. Web surface only");
      expect(generatedM1Milestone).toContain("- [x] **Generate**");
      expect(generatedM1Milestone).toContain("- [ ] **Ledger**");
      expect(generatedM1Milestone).toContain("- [ ] **Auth**");
      expect(generatedM1Milestone).toContain("m1:providers:bootstrap");
      expect(generatedM1Milestone).toContain("provider-bootstrap.txt");
      expect(generatedM1Milestone).toContain("m1:ledger:record");
      expect(generatedM1Milestone).toContain("m1:providers:link");
      expect(generatedM1Milestone).toContain("Link local provider state only after bootstrap recorded matching active ledger rows");
      expect(generatedM1Milestone).toContain("m1:preview:deploy");
      expect(generatedM1Milestone).toContain("m1:evidence:check");
      expect(generatedM1Milestone).toContain("M1_CLERK_EXTERNAL_ID");
      expect(generatedM1Milestone).toContain("--status active --replace");
      expect(generatedM1Milestone).toContain("If a provider CLI requires authentication");
      expect(generatedM1Milestone).toContain("m1:preview:smoke");
      expect(generatedM1Milestone).toContain("Do not check Auth/Data from local placeholder output");
      expect(generatedPreviewDocs).toContain("provider inventory --service convex --env preview");
      expect(generatedPreviewDocs).toContain("provider link --service convex --env preview");
      expect(generatedPreviewDocs).toContain("provider adopt --service convex --env preview");
      expect(generatedPreviewDocs).toContain("does not mutate the root provider ledger");
      expect(generatedPreviewDocs).toContain("sanitized identity proof requirements");
      expect(generatedPreviewDocs).toContain("sanitized candidate identity evidence summaries");
      expect(generatedPreviewDocs).toContain("Lifecycle` is a plan decision only");
      expect(generatedPreviewDocs).toContain("provider:preview:reconcile:live");
      expect(generatedPreviewDocs).toContain("M1 web-only preview path");
      expect(generatedPreviewDocs).toContain("m1:providers:bootstrap");
      expect(generatedPreviewDocs).toContain("primary M1 Ledger + Connect entrypoint");
      expect(generatedPreviewDocs).toContain("Provider CLI authentication");
      expect(generatedPreviewDocs).toContain("m1:ledger:record");
      expect(generatedPreviewDocs).toContain("m1:providers:link");
      expect(generatedPreviewDocs).toContain("After the three active M1 ledger rows exist");
      expect(generatedPreviewDocs).toContain("restores the previous `.agentstack/provider-links.json` state");
      expect(generatedPreviewDocs).toContain("removes stale `provider-links.txt`");
      expect(generatedPreviewDocs).toContain("m1:preview:deploy");
      expect(generatedPreviewDocs).toContain("requires active Clerk, Convex, and Vercel M1 ledger rows plus");
      expect(generatedPreviewDocs).toContain("top-level `Result: PASS` `provider-links.txt`");
      expect(generatedPreviewDocs).toContain("FAIL m1 preview deploy.provider-links-required");
      expect(generatedPreviewDocs).toContain("removes any stale `deploy-url.txt`");
      expect(generatedPreviewDocs).toContain("removes stale `smoke-output.txt`");
      expect(generatedPreviewDocs).toContain("m1:evidence:check");
      expect(generatedPreviewDocs).toContain("top-level `Result: PASS`");
      expect(generatedPreviewDocs).toContain("provider-link state contains active Clerk, Convex, and Vercel preview links");
      expect(generatedPreviewDocs).toContain("all name the same preview URL");
      expect(generatedPreviewDocs).toContain("smoke `Checked at` is not older than deploy `Checked at`");
      expect(generatedPreviewDocs).toContain("unresolved runbook placeholders");
      expect(generatedPreviewDocs).toContain("failed/not-run step results");
      expect(generatedPreviewDocs).toContain("missing runbook step result lines");
      expect(generatedPreviewDocs).toContain("missing final required M1 checkbox review lines");
      expect(generatedPreviewDocs).toContain("M1_CLERK_EXTERNAL_ID");
      expect(generatedPreviewDocs).toContain("--status active --replace");
      expect(generatedPreviewDocs).toContain("generated root `vercel.json`");
      expect(generatedPreviewDocs).toContain("Deploy URL:");
      expect(generatedPreviewDocs).toContain("Start with the aggregate provider plan");
      expect(generatedPreviewDocs).toContain("Do not ledger, link, apply, or inspect EAS for M1");
      expect(generatedPreviewDocs).toContain("M1 deployed smoke markers");
      expect(generatedPreviewDocs).toContain("m1:preview:smoke");
      expect(generatedPreviewDocs).toContain(".agentstack/m1-preview-dom.html");
      expect(generatedPreviewDocs).toContain("deploy-url.txt");
      expect(generatedPreviewDocs).toContain("provider-links.txt");
      expect(generatedPreviewDocs).toContain("smoke-output.txt");
      expect(generatedPreviewDocs).toContain("Result: FAIL");
      expect(generatedPreviewDocs).toContain("top-level `Result: PASS` deploy evidence");
      expect(generatedPreviewDocs).toContain("both deploy evidence files must match the `--url` value");
      expect(generatedPreviewDocs).toContain("FAIL m1 preview smoke.deploy-evidence-required");
      expect(generatedPreviewDocs).toContain("no raw provider stdout, stderr, identifiers, tokens, or secrets");
      expect(generatedPreviewDocs).toContain(
        "`m1:preview:smoke` first requires `deploy-url.txt` and `deploy-output.txt`"
      );
      expect(generatedPreviewDocs).toContain("redacted local temporary file marker, not the supplied path");
      expect(generatedPreviewDocs).toContain('data-agentstack-auth-state="signed-in"');
      expect(generatedPreviewDocs).toContain('data-agentstack-protected-data-state="protected-data-loaded"');
      expect(generatedPreviewDocs).toContain("data-agentstack-protected-workspace-id");
      expect(generatedM1EvidenceDocs).toContain("M1 Preview E2E Evidence");
      expect(generatedM1EvidenceDocs).toContain("deploy-url.txt");
      expect(generatedM1EvidenceDocs).toContain("deploy-output.txt");
      expect(generatedM1EvidenceDocs).toContain("failed-stage blocker output");
      expect(generatedM1EvidenceDocs).toContain("provider-bootstrap.txt");
      expect(generatedM1EvidenceDocs).toContain("provider-links.txt");
      expect(generatedM1EvidenceDocs).toContain("smoke-output.txt");
      expect(generatedM1EvidenceDocs).toContain("marker-missing blocker output");
      expect(generatedM1EvidenceDocs).toContain("provider-ledger");
      expect(generatedM1EvidenceDocs).toContain("runbook.md");
      expect(generatedM1EvidenceDocs).toContain("m1:evidence:check");
      expect(generatedM1EvidenceDocs).toContain("top-level `Result: PASS`");
      expect(generatedM1EvidenceDocs).toContain("Use `m1:providers:bootstrap` as the primary M1 provider entrypoint");
      expect(generatedM1EvidenceDocs).toContain("m1:ledger:record` must restore the previous `docs/provider-resource-ledger.md`");
      expect(generatedM1EvidenceDocs).toContain("write no `provider-links.txt` success evidence");
      expect(generatedM1EvidenceDocs).toContain("remove stale `provider-links.txt`");
      expect(generatedM1EvidenceDocs).toContain("m1:preview:deploy` must refuse with no deploy evidence writes");
      expect(generatedM1EvidenceDocs).toContain("remove stale `deploy-url.txt`");
      expect(generatedM1EvidenceDocs).toContain("remove stale `smoke-output.txt`");
      expect(generatedM1EvidenceDocs).toContain("same URL has matching top-level PASS deploy evidence");
      expect(generatedM1EvidenceDocs).toContain("still contains active Clerk, Convex, and Vercel preview links");
      expect(generatedM1EvidenceDocs).toContain("all name the same preview URL");
      expect(generatedM1EvidenceDocs).toContain("smoke `Checked at` timestamp is not older than deploy `Checked at`");
      expect(generatedM1EvidenceDocs).toContain("unresolved runbook placeholders");
      expect(generatedM1EvidenceDocs).toContain("all six required command-step result lines");
      expect(generatedM1EvidenceDocs).toContain("all six final required M1 checkbox review lines");
      expect(generatedM1EvidenceDocs).toContain("any final required M1 checkbox as `fail` or `unchanged`");
      expect(generatedM1EvidenceDocs).toContain("Do not commit raw DOM snapshots");
      expect(generatedM1EvidenceDocs).toContain("must not store the supplied DOM file path");
      expect(generatedM1EvidenceDocs).toContain("Do not store raw API keys");
      expect(generatedM1Runbook).toContain("M1 Preview E2E Runbook");
      expect(generatedM1Runbook).toContain("Status: not run");
      expect(generatedM1Runbook).toContain("Provider auth/account handoffs");
      expect(generatedM1Runbook).toContain("### 2. Bootstrap Preview Providers");
      expect(generatedM1Runbook).toContain("pnpm run m1:providers:bootstrap -- --confirm-live-mutation");
      expect(generatedM1Runbook).toContain("provider-bootstrap.txt");
      expect(generatedM1Runbook).toContain("M1_CLERK_EXTERNAL_ID");
      expect(generatedM1Runbook).toContain("--status active --replace");
      expect(generatedM1Runbook).toContain("pnpm run m1:ledger:record");
      expect(generatedM1Runbook).toContain("pnpm run m1:providers:link");
      expect(generatedM1Runbook).toContain("provider-links.txt");
      expect(generatedM1Runbook).toContain("pnpm run m1:preview:deploy -- --confirm-live-mutation");
      expect(generatedM1Runbook).toContain(".agentstack/provider-links.json");
      expect(generatedM1Runbook).toContain("redacted `Result: FAIL` blocker");
      expect(generatedM1Runbook).toContain("failed attempts that reach provider execution remove stale `deploy-url.txt`");
      expect(generatedM1Runbook).toContain("any attempts that reach provider execution remove stale `smoke-output.txt`");
      expect(generatedM1Runbook).toContain("pnpm run m1:preview:smoke");
      expect(generatedM1Runbook).toContain("redacted `Result: FAIL` marker blocker");
      expect(generatedM1Runbook).toContain("Requires matching `deploy-url.txt`");
      expect(generatedM1Runbook).toContain("pnpm run m1:evidence:check");
      expect(generatedM1Runbook).toContain("Requires matching preview URLs");
      expect(generatedM1Runbook).toContain("Requires `.agentstack/provider-links.json`");
      expect(generatedM1Runbook).toContain("All required M1 checkbox review values must be `pass`");
      expect(generatedM1Runbook).toContain("Do not paste raw provider CLI output");
      expect(generatedM1Runbook).toContain("Do not check Auth/Data from local builds");
      const providerPlanRunbookSection = generatedM1Runbook.slice(
        generatedM1Runbook.indexOf("### 1. Preview Provider Plans"),
        generatedM1Runbook.indexOf("### 2. Bootstrap Preview Providers")
      );
      const providerLinkRunbookSection = generatedM1Runbook.slice(
        generatedM1Runbook.indexOf("### 3. Link Local Provider State"),
        generatedM1Runbook.indexOf("### 4. Deploy Preview")
      );
      expect(providerPlanRunbookSection).not.toContain("provider-links.txt");
      expect(providerLinkRunbookSection).toContain("provider-links.txt");
      const generatedWorkflowDocs = await readFile(join(targetDir, "docs/agentstack/workflows.md"), "utf8");
      expect(generatedWorkflowDocs).toContain("pnpm run generated:check");
      expect(generatedWorkflowDocs).toContain("simulator state");
      expect(generatedWorkflowDocs).toContain("not proof of external provider existence");
      expect(generatedWorkflowDocs).toContain("sanitized candidate identity evidence plus `missing=` identity proof labels");
      expect(generatedWorkflowDocs).toContain("per-service `Resource`, `Ledger`, and `Lifecycle` lines");
      expect(generatedWorkflowDocs).toContain("pnpm run validate:live:preview");
      expect(generatedWorkflowDocs).toContain("pnpm run validate:live:production");
      expect(generatedWorkflowDocs).toContain("provider:clerk:proof:production");
      expect(generatedWorkflowDocs).toContain("provider:convex:proof:production");
      expect(generatedWorkflowDocs).toContain("provider:vercel:proof:production");
      expect(generatedWorkflowDocs).toContain("provider:eas:proof:production");
      expect(generatedWorkflowDocs).toContain("EAS preview/production project exact identity diagnostics");
      expect(generatedWorkflowDocs).toContain("Vercel/EAS production `env-list-production` partial drift diagnostics");
      expect(generatedWorkflowDocs).toContain("EAS preview/production project proof paths");
      expect(generatedWorkflowDocs).toContain("provider.link.live-coherence-blocked|unavailable");
      expect(generatedWorkflowDocs).toContain("provider.adopt.live-coherence-blocked|unavailable");
      expect(generatedWorkflowDocs).toContain("env-list-production");
      expect(generatedWorkflowDocs).toContain("Live validation prints per-service proof summaries");
      expect(generatedWorkflowDocs).toContain("Reason: proof-incomplete");
      expect(generatedWorkflowDocs).toContain("live-reconciliation-plan");
      expect(generatedWorkflowDocs).toContain("per-service proof diagnostics");
      expect(generatedWorkflowDocs).toContain("M1 preview helpers are the exception to the local-only preview rehearsal boundary");
      expect(generatedWorkflowDocs).toContain("pnpm run m1:providers:bootstrap -- --confirm-live-mutation");
      expect(generatedWorkflowDocs).toContain("pnpm run m1:ledger:record -- --status active --replace");
      expect(generatedWorkflowDocs).toContain("pnpm run m1:preview:deploy -- --confirm-live-mutation");
      expect(generatedWorkflowDocs).toContain("bootstrap-gated");
      expect(generatedWorkflowDocs).toContain("provider-link-gated");
      expect(generatedWorkflowDocs).toContain("pnpm run m1:evidence:check");
      expect(generatedWorkflowDocs).toContain(
        "Do not check Deploy, Auth, Data, or Evidence from `preview:deploy` or `preview:deploy:apply` output"
      );
      const generatedSkillWorkflows = await readFile(
        join(targetDir, "skills/agentstack/references/workflows.md"),
        "utf8"
      );
      expect(generatedSkillWorkflows).toContain("M1 web-only preview path");
      expect(generatedSkillWorkflows).toContain("pnpm run m1:providers:bootstrap -- --confirm-live-mutation");
      expect(generatedSkillWorkflows).toContain("Provider CLI auth/login/project selection is part of the work");
      expect(generatedSkillWorkflows).toContain("pnpm run m1:ledger:record -- --status active --replace");
      expect(generatedSkillWorkflows).toContain("--status active --replace");
      expect(generatedSkillWorkflows).toContain("pnpm run m1:providers:link");
      expect(generatedSkillWorkflows).toContain("writes no `provider-links.txt` success evidence");
      expect(generatedSkillWorkflows).toContain("pnpm run m1:preview:deploy -- --confirm-live-mutation");
      expect(generatedSkillWorkflows).toContain(".agentstack/provider-links.json");
      expect(generatedSkillWorkflows).toContain("pnpm run m1:preview:smoke");
      expect(generatedSkillWorkflows).toContain("replace runbook placeholders with redacted facts");
      expect(generatedSkillWorkflows).toContain("mark each required step result and final M1 checkbox as pass");
      expect(generatedSkillWorkflows).toContain("pnpm run m1:evidence:check");
      expect(generatedSkillWorkflows).toContain("Do not check Deploy from local preview rehearsal output");
      expect(generatedSkillWorkflows).toContain("Do not ledger, link, apply, inspect, or smoke EAS for M1");
      const generatedSkillGuardrails = await readFile(
        join(targetDir, "skills/agentstack/references/guardrails.md"),
        "utf8"
      );
      expect(generatedSkillGuardrails).toContain("M1 preview helpers are the exception");
      expect(generatedSkillGuardrails).toContain("m1:providers:bootstrap");
      expect(generatedSkillGuardrails).toContain("m1:preview:deploy");
      expect(generatedSkillGuardrails).toContain("active ledger/link prerequisites");
      expect(generatedSkillGuardrails).toContain("Provider mutation: convex preview apply, vercel preview deploy");
      const generatedValidationDocs = await readFile(join(targetDir, "docs/agentstack/validation.md"), "utf8");
      expect(generatedValidationDocs).toContain("pnpm run generated:check");
      expect(generatedValidationDocs).toContain("Evidence: generated-boundary");
      expect(generatedValidationDocs).toContain("pnpm lint");
      expect(generatedValidationDocs).toContain("pnpm run validate:live:preview");
      expect(generatedValidationDocs).toContain("pnpm run validate:live:production");
      expect(generatedValidationDocs).toContain("Evidence: live-validation");
      expect(generatedValidationDocs).toContain("Reason: proof-incomplete");
      expect(generatedValidationDocs).toContain("Exact identity evaluator: provider-exact-identity");
      expect(generatedValidationDocs).toContain("Clerk production application proof");
      expect(generatedValidationDocs).toContain("Convex production proof");
      expect(generatedValidationDocs).toContain("Vercel production project proof");
      expect(generatedValidationDocs).toContain("Drift evaluator: env-list-production");
      expect(generatedValidationDocs).toContain("EAS production project proof can also emit `Drift evaluator: env-list-production`");
      expect(generatedValidationDocs).toContain("EAS preview and production project proof can emit sanitized exact identity");
      expect(generatedValidationDocs).toContain("ledger-scoped `project:info` proof reads");
      await expect(readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8")).resolves.toContain(
        "## Ledger"
      );
      await expect(readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8")).resolves.toContain(
        "agentstack provider ledger record"
      );
      await expect(readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8")).resolves.toContain(
        "--write-evidence"
      );
      await expect(readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8")).resolves.toContain(
        "| id | provider | resource type | environment | owner account/project | name | external id/url | purpose | created by | created at | expected cleanup trigger/date | current status | cleanup command/procedure | cleaned at | evidence link/path | notes |"
      );
      await expect(readFile(join(targetDir, "docs/agentstack/auth.md"), "utf8")).resolves.toContain(
        "data-agentstack-auth-state"
      );
      await expect(readFile(join(targetDir, "scripts/m1-preview-smoke.mjs"), "utf8")).resolves.toContain(
        "data-agentstack-protected-workspace-id"
      );
      await expect(readFile(join(targetDir, "scripts/m1-preview-smoke.mjs"), "utf8")).resolves.toContain(
        "Local mutation: ${evidenceDir}/smoke-output.txt"
      );
      await expect(readFile(join(targetDir, "scripts/m1-preview-smoke.mjs"), "utf8")).resolves.toContain(
        "requireTopLevelDeployResultPass"
      );
      await expect(readFile(join(targetDir, "scripts/m1-ledger-record.mjs"), "utf8")).resolves.toContain(
        "M1_CLERK_EXTERNAL_ID"
      );
      await expect(readFile(join(targetDir, "scripts/m1-ledger-record.mjs"), "utf8")).resolves.toContain(
        "allow-pending"
      );
      await expect(readFile(join(targetDir, "scripts/m1-ledger-record.mjs"), "utf8")).resolves.toContain(
        "replace"
      );
      await expect(readFile(join(targetDir, "scripts/m1-ledger-record.mjs"), "utf8")).resolves.toContain(
        "snapshotLocalFiles"
      );
      await expect(readFile(join(targetDir, "scripts/m1-providers-link.mjs"), "utf8")).resolves.toContain(
        "m1-provider-link"
      );
      await expect(readFile(join(targetDir, "scripts/m1-providers-link.mjs"), "utf8")).resolves.toContain(
        "provider-links.txt"
      );
      await expect(readFile(join(targetDir, "scripts/m1-providers-link.mjs"), "utf8")).resolves.toContain(
        "ledger-active-required"
      );
      await expect(readFile(join(targetDir, "scripts/m1-providers-link.mjs"), "utf8")).resolves.toContain(
        "restoreProviderLinksState"
      );
      await expect(readFile(join(targetDir, "scripts/m1-providers-link.mjs"), "utf8")).resolves.toContain(
        "removeProviderLinksEvidence"
      );
      await expect(readFile(join(targetDir, "scripts/m1-evidence-check.mjs"), "utf8")).resolves.toContain(
        "m1-evidence-check"
      );
      await expect(readFile(join(targetDir, "scripts/m1-evidence-check.mjs"), "utf8")).resolves.toContain(
        "runbookPlaceholders"
      );
      await expect(readFile(join(targetDir, "scripts/m1-evidence-check.mjs"), "utf8")).resolves.toContain(
        "checkRunbookResults"
      );
      await expect(readFile(join(targetDir, "scripts/m1-evidence-check.mjs"), "utf8")).resolves.toContain(
        "requiredRunbookSteps"
      );
      await expect(readFile(join(targetDir, "scripts/m1-evidence-check.mjs"), "utf8")).resolves.toContain(
        "finalCheckboxes"
      );
      await expect(readFile(join(targetDir, "scripts/m1-evidence-check.mjs"), "utf8")).resolves.toContain(
        "requireEvidenceTimestampOrder"
      );
      await expect(readFile(join(targetDir, "scripts/m1-evidence-check.mjs"), "utf8")).resolves.toContain(
        "requireTopLevelResultPass"
      );
      await expect(readFile(join(targetDir, "scripts/m1-preview-deploy.mjs"), "utf8")).resolves.toContain(
        "m1-preview-deploy"
      );
      await expect(readFile(join(targetDir, "scripts/m1-preview-deploy.mjs"), "utf8")).resolves.toContain(
        "writeDeployOutput"
      );
      await expect(readFile(join(targetDir, "scripts/m1-preview-deploy.mjs"), "utf8")).resolves.toContain(
        "ledger-active-required"
      );
      await expect(readFile(join(targetDir, "scripts/m1-preview-deploy.mjs"), "utf8")).resolves.toContain(
        "removeStaleDeployUrl"
      );
      await expect(readFile(join(targetDir, "scripts/m1-preview-deploy.mjs"), "utf8")).resolves.toContain(
        "removeStaleSmokeOutput"
      );
      await expect(readFile(join(targetDir, "scripts/m1-preview-deploy.mjs"), "utf8")).resolves.toContain(
        "requireTopLevelProviderLinksResultPass"
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
      const generatedWebApp = await readFile(join(targetDir, "apps/web/src/App.tsx"), "utf8");
      expect(generatedWebApp).toContain("@clerk/react");
      expect(generatedWebApp).toContain("useQuery");
      expect(generatedWebApp).toContain("useConvexAuth");
      expect(generatedWebApp).toContain("anyApi.workspaceStatus.protectedStatus");
      expect(generatedWebApp).toContain("useUser");
      expect(generatedWebApp).toContain("SignInButton");
      expect(generatedWebApp).toContain("SignUpButton");
      expect(generatedWebApp).toContain("UserButton");
      expect(generatedWebApp).toContain("Protected Convex status");
      expect(generatedWebApp).toContain("data-agentstack-auth-state");
      expect(generatedWebApp).toContain("data-agentstack-protected-data-state");
      expect(generatedWebApp).toContain("data-agentstack-protected-workspace-id");
      expect(generatedWebApp).toContain("signed-in");
      expect(generatedWebApp).toContain("protected-data-loaded");
      const generatedWebMain = await readFile(join(targetDir, "apps/web/src/main.tsx"), "utf8");
      expect(generatedWebMain).toContain("ClerkProvider");
      expect(generatedWebMain).toContain("ConvexProviderWithClerk");
      expect(generatedWebMain).toContain("ConvexReactClient");
      expect(generatedWebMain).toContain("useAuth");
      expect(generatedWebMain).toContain("VITE_CLERK_PUBLISHABLE_KEY");
      expect(generatedWebMain).toContain("VITE_CONVEX_URL");
      const generatedVercelConfig = JSON.parse(await readFile(join(targetDir, "vercel.json"), "utf8"));
      expect(generatedVercelConfig).toMatchObject({
        framework: "vite",
        buildCommand: "pnpm --filter @app/web build",
        outputDirectory: "apps/web/dist"
      });
      await expect(readFile(join(targetDir, "apps/mobile/src/App.tsx"), "utf8")).resolves.toContain(
        "Workspace status"
      );
      await expect(readFile(join(targetDir, "apps/mobile/App.tsx"), "utf8")).resolves.toContain(
        './src/App'
      );
      await expect(readFile(join(targetDir, "convex/agentstack.ts"), "utf8")).resolves.toContain(
        "convexRuntime"
      );
      await expect(readFile(join(targetDir, "convex/auth.config.ts"), "utf8")).resolves.toContain(
        "CLERK_JWT_ISSUER_DOMAIN"
      );
      await expect(readFile(join(targetDir, "convex/schema.ts"), "utf8")).resolves.toContain(
        "workspaceStatuses"
      );
      await expect(readFile(join(targetDir, "convex/workspaceStatus.ts"), "utf8")).resolves.toContain(
        "checklistProgress"
      );
      await expect(readFile(join(targetDir, "convex/workspaceStatus.ts"), "utf8")).resolves.toContain(
        "protectedStatus"
      );
      await expect(readFile(join(targetDir, "convex/workspaceStatus.ts"), "utf8")).resolves.toContain(
        "ctx.auth.getUserIdentity()"
      );
      await expect(readFile(join(targetDir, "convex/workspaceStatus.ts"), "utf8")).resolves.toContain(
        "Not authenticated"
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
      const telemetryBeforeLedger = await readFile(join(targetDir, ".agentstack/events.jsonl"), "utf8");
      const sourceEnv = sourceCliEnv();
      const {
        M1_CLERK_EXTERNAL_ID: _m1ClerkExternalId,
        M1_CONVEX_EXTERNAL_ID: _m1ConvexExternalId,
        M1_VERCEL_EXTERNAL_ID: _m1VercelExternalId,
        ...ledgerEnvWithoutExternalIds
      } = sourceEnv;
      await expect(
        execFileAsync(
          "pnpm",
          [
            "run",
            "m1:ledger:record",
            "--",
            "--owner",
            "cardinal-dev",
            "--created-by",
            "Codex",
            "--created-at",
            "2026-06-22"
          ],
          {
            cwd: targetDir,
            env: ledgerEnvWithoutExternalIds
          }
        )
      ).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL m1 ledger record.external-id-required")
      });
      await expect(readFile(join(targetDir, ".agentstack/events.jsonl"), "utf8")).resolves.toBe(
        telemetryBeforeLedger
      );
      await expect(readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8")).resolves.not.toContain(
        "| clerk-preview-application | clerk | application | preview | cardinal-dev |"
      );
      const ledger = await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
            "--owner",
            "cardinal-dev",
            "--created-by",
            "Codex",
            "--created-at",
            "2026-06-22",
            "--status",
            "active"
          ],
          {
            cwd: targetDir,
            env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );
      const ledgerOutput = `${ledger.stdout}${ledger.stderr}`;
      expect(ledgerOutput).toContain("PASS m1 ledger record");
      expect(ledgerOutput).toContain("Evidence: m1-provider-ledger-record");
      expect(ledgerOutput).toContain("Local mutation: docs/provider-resource-ledger.md");
      expect(ledgerOutput).toContain(
        "Local mutation: docs/milestones/evidence/M1-preview-e2e/provider-ledger-clerk-2026-06-22.md"
      );
      expect(ledgerOutput).toContain(
        "Local mutation: docs/milestones/evidence/M1-preview-e2e/provider-ledger-convex-2026-06-22.md"
      );
      expect(ledgerOutput).toContain(
        "Local mutation: docs/milestones/evidence/M1-preview-e2e/provider-ledger-vercel-2026-06-22.md"
      );
      expect(ledgerOutput).toContain("Provider mutation: none");
      expect(ledgerOutput).toContain("Telemetry mutation: none");
      expect(ledgerOutput).not.toContain("secret-clerk-app-id-1234567890");
      expect(ledgerOutput).not.toContain("secret-preview-1234567890");
      expect(ledgerOutput).not.toContain("secret-acme-crm-preview");
      await expect(readFile(join(targetDir, ".agentstack/events.jsonl"), "utf8")).resolves.toBe(
        telemetryBeforeLedger
      );
      const providerLedger = await readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8");
      expect(providerLedger).toContain("| clerk-preview-application | clerk | application | preview | cardinal-dev | acme-crm-preview | https://clerk.example/apps/secret-clerk-app-id-1234567890 | M1 preview Clerk auth smoke | Codex | 2026-06-22 | M1 pass or pivot | active | delete through Clerk dashboard |  | docs/milestones/evidence/M1-preview-e2e/provider-ledger-clerk-2026-06-22.md | recorded by m1:ledger:record |");
      expect(providerLedger).toContain("| convex-preview-deployment | convex | deployment | preview | cardinal-dev | acme-crm-preview | https://convex.cloud/d/secret-preview-1234567890 | M1 preview protected Convex data smoke | Codex | 2026-06-22 | M1 pass or pivot | active | delete through Convex dashboard |  | docs/milestones/evidence/M1-preview-e2e/provider-ledger-convex-2026-06-22.md | recorded by m1:ledger:record |");
      expect(providerLedger).toContain("| vercel-preview-project | vercel | project | preview | cardinal-dev | acme-crm | https://vercel.com/cardinal-dev/secret-acme-crm-preview | M1 preview Vercel deploy smoke | Codex | 2026-06-22 | M1 pass or pivot | active | delete through Vercel dashboard |  | docs/milestones/evidence/M1-preview-e2e/provider-ledger-vercel-2026-06-22.md | recorded by m1:ledger:record |");
      for (const service of ["clerk", "convex", "vercel"]) {
        const evidence = await readFile(
          join(targetDir, `docs/milestones/evidence/M1-preview-e2e/provider-ledger-${service}-2026-06-22.md`),
          "utf8"
        );
        expect(evidence).toContain("External id/url: recorded in provider ledger (redacted)");
        expect(evidence).toContain("Provider mutation: none");
        expect(evidence).toContain("Telemetry mutation: none");
        expect(evidence).not.toContain("secret-clerk-app-id-1234567890");
        expect(evidence).not.toContain("secret-preview-1234567890");
        expect(evidence).not.toContain("secret-acme-crm-preview");
      }
      const telemetryBeforeLink = await readFile(join(targetDir, ".agentstack/events.jsonl"), "utf8");
      const link = await execFileAsync("pnpm", ["run", "m1:providers:link"], {
        cwd: targetDir,
        env: sourceCliEnv()
      });
      const linkOutput = `${link.stdout}${link.stderr}`;
      expect(linkOutput).toContain("LINKED provider clerk preview");
      expect(linkOutput).toContain("LINKED provider convex preview");
      expect(linkOutput).toContain("LINKED provider vercel preview");
      expect(linkOutput).toContain("PASS m1 providers link");
      expect(linkOutput).toContain("Evidence: m1-provider-link");
      expect(linkOutput).toContain("Local mutation: .agentstack/provider-links.json");
      expect(linkOutput).toContain(
        "Local mutation: docs/milestones/evidence/M1-preview-e2e/provider-links.txt"
      );
      expect(linkOutput).toContain("Provider mutation: none");
      expect(linkOutput).toContain("Ledger mutation: none");
      expect(linkOutput).toContain("Telemetry mutation: none");
      expect(linkOutput).not.toContain("secret-clerk-app-id-1234567890");
      expect(linkOutput).not.toContain("secret-preview-1234567890");
      expect(linkOutput).not.toContain("secret-acme-crm-preview");
      await expect(readFile(join(targetDir, ".agentstack/events.jsonl"), "utf8")).resolves.toBe(
        telemetryBeforeLink
      );
      const providerLinks = JSON.parse(await readFile(join(targetDir, ".agentstack/provider-links.json"), "utf8"));
      expect(providerLinks.links).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            service: "clerk",
            environment: "preview",
            resourceType: "application",
            name: "acme-crm-preview",
            ledgerStatus: "active"
          }),
          expect.objectContaining({
            service: "convex",
            environment: "preview",
            resourceType: "deployment",
            name: "acme-crm-preview",
            ledgerStatus: "active"
          }),
          expect.objectContaining({
            service: "vercel",
            environment: "preview",
            resourceType: "project",
            name: "acme-crm",
            ledgerStatus: "active"
          })
        ])
      );
      expect(JSON.stringify(providerLinks)).not.toContain("secret-clerk-app-id-1234567890");
      expect(JSON.stringify(providerLinks)).not.toContain("secret-preview-1234567890");
      expect(JSON.stringify(providerLinks)).not.toContain("secret-acme-crm-preview");
      const providerLinkEvidence = await readFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/provider-links.txt"),
        "utf8"
      );
      expect(providerLinkEvidence).toContain("# M1 Provider Link Evidence");
      expect(providerLinkEvidence).toContain("Result: PASS");
      expect(providerLinkEvidence).toContain("Clerk preview application: linked");
      expect(providerLinkEvidence).toContain("Convex preview deployment: linked");
      expect(providerLinkEvidence).toContain("Vercel preview project: linked");
      expect(providerLinkEvidence).toContain("Local mutation: .agentstack/provider-links.json");
      expect(providerLinkEvidence).toContain("Provider mutation: none");
      expect(providerLinkEvidence).toContain("Ledger mutation: none");
      expect(providerLinkEvidence).toContain("Telemetry mutation: none");
      expect(providerLinkEvidence).not.toContain("secret-clerk-app-id-1234567890");
      expect(providerLinkEvidence).not.toContain("secret-preview-1234567890");
      expect(providerLinkEvidence).not.toContain("secret-acme-crm-preview");
      await writeFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/provider-bootstrap.txt"),
        [
          "# M1 Provider Bootstrap Evidence",
          "",
          "Result: PASS",
          "Checked at: 2026-06-22T09:45:00.000Z",
          "Clerk preview application: created or reused and linked",
          "Convex preview deployment: preview deployment ensured; deploy key saved to .agentstack/convex-preview.env",
          "Vercel preview project: project ensured and linked",
          "Provider mutation: clerk app/link, convex preview deployment/deploy-key/env, vercel project/link/env",
          "Ledger mutation: docs/provider-resource-ledger.md",
          "Local mutation: .vercel, .agentstack/convex-preview.env",
          "Telemetry mutation: provider ledger telemetry only",
          ""
        ].join("\n")
      );
      const fakeCliPath = join(targetDir, ".agentstack/fake-agentstack-cli.mjs");
      await writeFile(
        fakeCliPath,
        [
          "#!/usr/bin/env node",
          'import { appendFileSync } from "node:fs";',
          "const args = process.argv.slice(2);",
          'appendFileSync(".agentstack/m1-preview-deploy-cli.jsonl", `${JSON.stringify(args)}\\n`);',
          'const rendered = args.join(" ");',
          'if (rendered === "provider apply --service convex --env preview") {',
          '  console.log("APPLIED provider convex preview");',
          '  console.log("Evidence: live-mutation");',
          '  console.log("Mutation scope: bounded provider executor");',
          "  process.exit(0);",
          "}",
          'if (rendered === "provider apply --service vercel --env preview") {',
          '  console.log("APPLIED provider vercel preview");',
          '  console.log("Evidence: live-mutation");',
          '  console.log("Mutation scope: bounded provider executor");',
          '  console.log("Deploy URL: https://acme-crm-git-m1-example.vercel.app");',
          "  process.exit(0);",
          "}",
          "console.error(`Unexpected command: ${rendered}`);",
          "process.exit(1);",
          ""
        ].join("\n")
      );
      await chmod(fakeCliPath, 0o755);
      const deployEnv = { ...sourceCliEnv(), AGENTSTACK_CLI_BIN: fakeCliPath };
      await expect(
        execFileAsync("pnpm", ["run", "m1:preview:deploy"], {
          cwd: targetDir,
          env: deployEnv
        })
      ).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL m1 preview deploy.confirmation-required")
      });
      await expect(readFile(join(targetDir, ".agentstack/m1-preview-deploy-cli.jsonl"), "utf8")).rejects.toThrow();
      await writeFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/smoke-output.txt"),
        [
          "# M1 Preview Smoke Output",
          "",
          "Result: PASS",
          "Deploy URL: https://stale-success.example.vercel.app",
          "Auth state: signed-in",
          "Protected data state: protected-data-loaded",
          "Workspace id: present (redacted)",
          ""
        ].join("\n")
      );
      const deploy = await execFileAsync(
        "pnpm",
        ["run", "m1:preview:deploy", "--", "--confirm-live-mutation"],
        {
          cwd: targetDir,
          env: deployEnv
        }
      );
      const deployOutput = `${deploy.stdout}${deploy.stderr}`;
      expect(deployOutput).toContain("APPLIED provider convex preview");
      expect(deployOutput).toContain("APPLIED provider vercel preview");
      expect(deployOutput).toContain("PASS m1 preview deploy");
      expect(deployOutput).toContain("Evidence: m1-preview-deploy");
      expect(deployOutput).toContain("Deploy URL: https://acme-crm-git-m1-example.vercel.app");
      expect(deployOutput).toContain("Provider mutation: convex preview apply, vercel preview deploy");
      expect(deployOutput).toContain("Telemetry mutation: provider apply telemetry");
      expect(deployOutput).toContain(
        "Local mutation: docs/milestones/evidence/M1-preview-e2e/deploy-url.txt"
      );
      expect(deployOutput).toContain(
        "Local mutation: docs/milestones/evidence/M1-preview-e2e/deploy-output.txt"
      );
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/deploy-url.txt"), "utf8")
      ).resolves.toBe("https://acme-crm-git-m1-example.vercel.app\n");
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/smoke-output.txt"), "utf8")
      ).rejects.toThrow();
      const deployEvidence = await readFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/deploy-output.txt"),
        "utf8"
      );
      expect(deployEvidence).toContain("# M1 Preview Deploy Output");
      expect(deployEvidence).toContain("Result: PASS");
      expect(deployEvidence).toContain("Convex apply: completed");
      expect(deployEvidence).toContain("Vercel apply: completed");
      expect(deployEvidence).toContain("Deploy URL: https://acme-crm-git-m1-example.vercel.app");
      const fakeProviderBinDir = await writeFakeProviderPnpm(targetDir);
      const authUser = await execFileAsync(
        process.execPath,
        ["scripts/m1-auth-user.mjs", "ensure", "--confirm-live-mutation", "--created-by", "Codex"],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            AGENTSTACK_M1_CREATED_AT: "2026-06-22",
            AGENTSTACK_M1_AUTH_USER_PASSWORD: "workflow-local-password-should-not-leak",
            PATH: `${fakeProviderBinDir}:${process.env.PATH ?? ""}`
          }
        }
      );
      const authUserOutput = `${authUser.stdout}${authUser.stderr}`;
      expect(authUserOutput).toContain("PASS m1 auth user ensure");
      expect(authUserOutput).toContain("Provider mutation: clerk user create/update");
      expect(authUserOutput).not.toContain("workflow-local-password-should-not-leak");
      const authUserEvidence = await readFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/clerk-smoke-user.txt"),
        "utf8"
      );
      expect(authUserEvidence).toContain("Result: PASS");
      expect(authUserEvidence).toContain("Action: ensure");
      expect(authUserEvidence).not.toContain("workflow-local-password-should-not-leak");
      const fakeCliLog = (await readFile(join(targetDir, ".agentstack/m1-preview-deploy-cli.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(fakeCliLog).toEqual([
        ["provider", "apply", "--service", "convex", "--env", "preview"],
        ["provider", "apply", "--service", "vercel", "--env", "preview"]
      ]);
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
      const failedDomPath = join(targetDir, ".agentstack/m1-preview-dom-failed.html");
      await writeFile(
        failedDomPath,
        [
          '<main data-agentstack-auth-state="signed-out">',
          "<section>workspace-secret-should-not-appear</section>",
          "</main>"
        ].join("")
      );
      await expect(
        execFileAsync(
          "pnpm",
          [
            "run",
            "m1:preview:smoke",
            "--",
            "--url",
            "https://acme-crm-git-m1-example.vercel.app",
            "--dom-file",
            failedDomPath
          ],
          { cwd: targetDir }
        )
      ).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL m1 preview smoke")
      });
      const failedSmokeOutput = await readFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/smoke-output.txt"),
        "utf8"
      );
      expect(failedSmokeOutput).toContain("# M1 Preview Smoke Output");
      expect(failedSmokeOutput).toContain("Result: FAIL");
      expect(failedSmokeOutput).toContain("Deploy URL: https://acme-crm-git-m1-example.vercel.app");
      expect(failedSmokeOutput).toContain("Auth state: missing signed-in");
      expect(failedSmokeOutput).toContain("Protected data state: missing protected-data-loaded");
      expect(failedSmokeOutput).toContain("Workspace id: missing");
      expect(failedSmokeOutput).toContain('Reason: missing data-agentstack-auth-state="signed-in"');
      expect(failedSmokeOutput).toContain(
        'Reason: missing data-agentstack-protected-data-state="protected-data-loaded"'
      );
      expect(failedSmokeOutput).toContain("Reason: missing non-empty data-agentstack-protected-workspace-id");
      expect(failedSmokeOutput).toContain(
        "Raw DOM snapshots, provider identifiers, cookies, and tokens are not stored in this evidence file."
      );
      expect(failedSmokeOutput).toContain("DOM snapshot source: local temporary file (redacted)");
      expect(failedSmokeOutput).not.toContain(failedDomPath);
      expect(failedSmokeOutput).not.toContain("workspace-secret-should-not-appear");
      const passingDomPath = join(targetDir, ".agentstack/m1-preview-dom.html");
      await writeFile(
        passingDomPath,
        [
          '<main data-agentstack-auth-state="signed-in">',
          '<section data-agentstack-protected-data-state="protected-data-loaded"',
          ' data-agentstack-protected-workspace-id="workspace-secret-123"></section>',
          "</main>"
        ].join("")
      );
      const smoke = await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:preview:smoke",
          "--",
          "--url",
          "https://acme-crm-git-m1-example.vercel.app",
          "--dom-file",
          passingDomPath
        ],
        { cwd: targetDir }
      );
      const smokeTerminalOutput = `${smoke.stdout}${smoke.stderr}`;
      expect(smokeTerminalOutput).toContain("PASS m1 preview smoke");
      expect(smokeTerminalOutput).toContain("Evidence: m1-preview-smoke");
      expect(smokeTerminalOutput).toContain(
        "Local mutation: docs/milestones/evidence/M1-preview-e2e/deploy-url.txt"
      );
      expect(smokeTerminalOutput).toContain(
        "Local mutation: docs/milestones/evidence/M1-preview-e2e/smoke-output.txt"
      );
      expect(smokeTerminalOutput).not.toContain(`Wrote: ${targetDir}`);
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/deploy-url.txt"), "utf8")
      ).resolves.toContain("https://acme-crm-git-m1-example.vercel.app");
      const smokeOutput = await readFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/smoke-output.txt"),
        "utf8"
      );
      expect(smokeOutput).toContain("Auth state: signed-in");
      expect(smokeOutput).toContain("Protected data state: protected-data-loaded");
      expect(smokeOutput).toContain("Workspace id: present (redacted)");
      expect(smokeOutput).toContain("DOM snapshot source: local temporary file (redacted)");
      expect(smokeOutput).not.toContain(passingDomPath);
      expect(smokeOutput).not.toContain("workspace-secret-123");
      await expect(execFileAsync("pnpm", ["run", "m1:evidence:check"], { cwd: targetDir })).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL m1 evidence check")
      });
      const initialRunbook = await readFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/runbook.md"),
        "utf8"
      );
      expect(initialRunbook).toContain("Status: not run");
      const runbookPath = join(targetDir, "docs/milestones/evidence/M1-preview-e2e/runbook.md");
      await writeFile(runbookPath, initialRunbook.replace("Status: not run", "Status: run"));
      await expect(execFileAsync("pnpm", ["run", "m1:evidence:check"], { cwd: targetDir })).rejects.toMatchObject({
        stdout: expect.stringContaining("runbook contains unresolved placeholder")
      });
      await writeFile(runbookPath, completeM1RunbookScaffold(initialRunbook));
      const telemetryBeforeEvidenceCheck = await readFile(join(targetDir, ".agentstack/events.jsonl"), "utf8");
      const evidenceCheck = await execFileAsync("pnpm", ["run", "m1:evidence:check"], {
        cwd: targetDir
      });
      const evidenceCheckOutput = `${evidenceCheck.stdout}${evidenceCheck.stderr}`;
      expect(evidenceCheckOutput).toContain("PASS m1 evidence check");
      expect(evidenceCheckOutput).toContain("Evidence: m1-evidence-check");
      expect(evidenceCheckOutput).toContain("Checked: provider ledger rows");
      expect(evidenceCheckOutput).toContain("Checked: provider bootstrap evidence");
      expect(evidenceCheckOutput).toContain("Checked: provider link evidence");
      expect(evidenceCheckOutput).toContain("Checked: deploy evidence");
      expect(evidenceCheckOutput).toContain("Checked: Clerk smoke user evidence");
      expect(evidenceCheckOutput).toContain("Checked: smoke evidence");
      expect(evidenceCheckOutput).toContain("Checked: runbook");
      expect(evidenceCheckOutput).toContain("Provider mutation: none");
      expect(evidenceCheckOutput).toContain("Local mutation: none");
      expect(evidenceCheckOutput).toContain("Telemetry mutation: none");
      expect(evidenceCheckOutput).not.toContain("secret-clerk-app-id-1234567890");
      expect(evidenceCheckOutput).not.toContain("secret-preview-1234567890");
      expect(evidenceCheckOutput).not.toContain("secret-acme-crm-preview");
      await expect(readFile(join(targetDir, ".agentstack/events.jsonl"), "utf8")).resolves.toBe(
        telemetryBeforeEvidenceCheck
      );
      await expect(runPackageScript(targetDir, "preview:validate", sourceCliEnv())).resolves.toBeDefined();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 provider bootstrap records live-created provider resources", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });
      const fakeBinDir = await writeFakeProviderPnpm(targetDir);

      await expect(
        execFileAsync(
          process.execPath,
          ["scripts/m1-providers-bootstrap.mjs", "--confirm-live-mutation", "--created-by", "Codex"],
          {
            cwd: targetDir,
            env: {
              ...sourceCliEnv(),
              AGENTSTACK_M1_CREATED_AT: "2026-06-22",
              AGENTSTACK_M1_RUN_STAMP: "fake",
              PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`
            }
          }
        )
      ).resolves.toMatchObject({
        stdout: expect.stringContaining("PASS m1 providers bootstrap")
      });

      const ledger = await readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8");
      expect(ledger).toContain("| clerk-preview-application | clerk | application | preview | owner@example.test | acme-crm-preview | app_fake_clerk_preview | M1 preview Clerk auth smoke | Codex |");
      expect(ledger).toContain("| clerk-preview-jwt-template | clerk | jwt-template | preview | owner@example.test | convex | jwt_fake_convex_template | M1 preview Clerk JWT template for Convex auth | Codex |");
      expect(ledger).toContain("| convex-preview-deployment | convex | deployment | preview | cardinal:acme-crm | acme-crm-preview | cardinal:acme-crm:preview/acme-crm-preview | M1 preview protected Convex data smoke | Codex |");
      expect(ledger).toContain("| vercel-preview-project | vercel | project | preview | org_fake_vercel_owner | acme-crm | prj_fake_vercel_preview | M1 preview Vercel deploy smoke | Codex |");
      expect(ledger).toContain("recorded by m1:providers:bootstrap (active)");
      expect(ledger).not.toContain("convex_secret_deploy_key");

      const bootstrapEvidence = await readFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/provider-bootstrap.txt"),
        "utf8"
      );
      expect(bootstrapEvidence).toContain("Result: PASS");
      expect(bootstrapEvidence).toContain("Clerk preview application: created or reused and linked");
      expect(bootstrapEvidence).toContain("Clerk JWT template: created or reused for Convex auth");
      expect(bootstrapEvidence).toContain("Convex preview deployment: preview deployment ensured; deploy key saved to .agentstack/convex-preview.env");
      expect(bootstrapEvidence).toContain("Vercel preview project: project ensured and linked");
      expect(bootstrapEvidence).toContain("Raw provider stdout, provider identifiers, tokens, secrets, deploy keys, cookies, and sessions are not stored");
      expect(bootstrapEvidence).not.toContain("convex_secret_deploy_key");

      await expect(readFile(join(targetDir, ".agentstack/convex-preview.env"), "utf8")).resolves.toContain(
        "CONVEX_DEPLOY_KEY=convex_secret_deploy_key"
      );
      const providerCalls = (await readFile(join(targetDir, ".agentstack/fake-provider-calls.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(providerCalls.map((call) => call.args.join(" "))).toEqual([
        "exec clerk whoami --json",
        "exec clerk apps list --json",
        "exec clerk apps create acme-crm-preview --json",
        "exec clerk apps list --json",
        "exec clerk link --app app_fake_clerk_preview",
        "exec clerk api /jwt_templates",
        'exec clerk api /jwt_templates --data {"name":"convex","claims":{"aud":"convex"}} --yes',
        "exec convex deployment create acme-crm-preview --type preview --expiration in 5 days",
        "exec convex env --deployment cardinal:acme-crm:preview/acme-crm-preview set CLERK_JWT_ISSUER_DOMAIN https://acme.clerk.accounts.dev",
        "exec convex deployment token create agentstack-m1-preview-fake --deployment cardinal:acme-crm:preview/acme-crm-preview --save-env .agentstack/convex-preview.env",
        "exec vercel whoami",
        "exec vercel project ls --json",
        "exec vercel project add acme-crm",
        "exec vercel link --yes --project acme-crm",
        "exec vercel env rm VITE_CLERK_PUBLISHABLE_KEY preview --yes",
        "exec vercel env add VITE_CLERK_PUBLISHABLE_KEY preview",
        "exec vercel env rm VITE_CONVEX_URL preview --yes",
        "exec vercel env add VITE_CONVEX_URL preview"
      ]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("generated M1 auth user helper manages a ledgered Clerk smoke user", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });
      const fakeBinDir = await writeFakeProviderPnpm(targetDir);

      await expect(
        execFileAsync(process.execPath, ["scripts/m1-auth-user.mjs", "ensure"], {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`
          }
        })
      ).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL m1 auth user.confirmation-required")
      });

      const ensure = await execFileAsync(
        process.execPath,
        ["scripts/m1-auth-user.mjs", "ensure", "--confirm-live-mutation", "--created-by", "Codex"],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            AGENTSTACK_M1_CREATED_AT: "2026-06-28",
            AGENTSTACK_M1_AUTH_USER_PASSWORD: "fake-local-password-should-not-leak",
            PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`
          }
        }
      );
      const ensureOutput = `${ensure.stdout}${ensure.stderr}`;
      expect(ensureOutput).toContain("PASS m1 auth user ensure");
      expect(ensureOutput).toContain("Evidence: m1-auth-user");
      expect(ensureOutput).toContain("Clerk smoke user: created or reused");
      expect(ensureOutput).toContain("Provider mutation: clerk user create/update");
      expect(ensureOutput).toContain("Ledger mutation: docs/provider-resource-ledger.md");
      expect(ensureOutput).toContain("Local mutation: .agentstack/m1-auth-user.json");
      expect(ensureOutput).toContain("Local mutation: docs/milestones/evidence/M1-preview-e2e/clerk-smoke-user.txt");
      expect(ensureOutput).not.toContain("fake-local-password-should-not-leak");

      const localState = JSON.parse(await readFile(join(targetDir, ".agentstack/m1-auth-user.json"), "utf8"));
      expect(localState).toMatchObject({
        service: "clerk",
        environment: "preview",
        userId: "user_fake_m1_smoke",
        email: "acme-crm+m1-smoke+clerk_test@example.com"
      });
      expect(localState.password).toBe("fake-local-password-should-not-leak");

      const ledger = await readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8");
      expect(ledger).toContain(
        "| clerk-preview-user | clerk | user | preview | owner@example.test | acme-crm+m1-smoke+clerk_test@example.com | user_fake_m1_smoke | M1 preview Clerk sign-in smoke user | Codex | 2026-06-28 | M1 pass or cleanup | active | delete through Clerk dashboard or `pnpm run m1:auth:user -- delete --confirm-live-mutation` |  | docs/milestones/evidence/M1-preview-e2e/clerk-smoke-user.txt | recorded by m1:auth:user ensure; client trust bypass requested |"
      );
      expect(ledger).not.toContain("fake-local-password-should-not-leak");

      const userEvidence = await readFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/clerk-smoke-user.txt"),
        "utf8"
      );
      expect(userEvidence).toContain("# M1 Clerk Smoke User Evidence");
      expect(userEvidence).toContain("Result: PASS");
      expect(userEvidence).toContain("Action: ensure");
      expect(userEvidence).toContain("Clerk smoke user: created or reused");
      expect(userEvidence).toContain("Client trust bypass: requested");
      expect(userEvidence).toContain("Local credential state: .agentstack/m1-auth-user.json");
      expect(userEvidence).toContain(
        "Raw passwords, OTP codes, session tokens, cookies, provider stdout, and full user payloads are not stored"
      );
      expect(userEvidence).not.toContain("fake-local-password-should-not-leak");

      const update = await execFileAsync(
        process.execPath,
        ["scripts/m1-auth-user.mjs", "update", "--confirm-live-mutation", "--created-by", "Codex"],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            AGENTSTACK_M1_CREATED_AT: "2026-06-28",
            AGENTSTACK_M1_AUTH_USER_PASSWORD: "second-local-password-should-not-leak",
            PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`
          }
        }
      );
      expect(`${update.stdout}${update.stderr}`).toContain("PASS m1 auth user update");
      const updatedState = JSON.parse(await readFile(join(targetDir, ".agentstack/m1-auth-user.json"), "utf8"));
      expect(updatedState.password).toBe("second-local-password-should-not-leak");

      const deleteResult = await execFileAsync(
        process.execPath,
        ["scripts/m1-auth-user.mjs", "delete", "--confirm-live-mutation", "--created-by", "Codex"],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            AGENTSTACK_M1_CREATED_AT: "2026-06-28",
            PATH: `${fakeBinDir}:${process.env.PATH ?? ""}`
          }
        }
      );
      expect(`${deleteResult.stdout}${deleteResult.stderr}`).toContain("PASS m1 auth user delete");
      await expect(readFile(join(targetDir, ".agentstack/m1-auth-user.json"), "utf8")).rejects.toThrow();
      const cleanedLedger = await readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8");
      expect(cleanedLedger).toContain("| clerk-preview-user | clerk | user | preview | owner@example.test | acme-crm+m1-smoke+clerk_test@example.com | user_fake_m1_smoke | M1 preview Clerk sign-in smoke user | Codex | 2026-06-28 | M1 pass or cleanup | cleaned | delete through Clerk dashboard or `pnpm run m1:auth:user -- delete --confirm-live-mutation` | 2026-06-28 | docs/milestones/evidence/M1-preview-e2e/clerk-smoke-user.txt | recorded by m1:auth:user delete; verified cleanup through Clerk API |");

      const providerCalls = (await readFile(join(targetDir, ".agentstack/fake-provider-calls.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line).args.join(" "));
      expect(providerCalls).toEqual([
        "exec clerk whoami --json",
        "exec clerk api /users?email_address=acme-crm%2Bm1-smoke%2Bclerk_test%40example.com",
        'exec clerk api /users --data {"email_address":["acme-crm+m1-smoke+clerk_test@example.com"],"password":"fake-local-password-should-not-leak","skip_password_checks":true,"skip_password_requirement":false,"public_metadata":{"agentstack":"m1","appSlug":"acme-crm","fixture":"clerk-smoke-user"}} --yes',
        'exec clerk api /users/user_fake_m1_smoke --method PATCH --data {"password":"fake-local-password-should-not-leak","skip_password_checks":true,"bypass_client_trust":true,"public_metadata":{"agentstack":"m1","appSlug":"acme-crm","fixture":"clerk-smoke-user"}} --yes',
        "exec clerk whoami --json",
        'exec clerk api /users/user_fake_m1_smoke --method PATCH --data {"password":"second-local-password-should-not-leak","skip_password_checks":true,"bypass_client_trust":true,"public_metadata":{"agentstack":"m1","appSlug":"acme-crm","fixture":"clerk-smoke-user"}} --yes',
        "exec clerk whoami --json",
        "exec clerk api /users/user_fake_m1_smoke --method DELETE --yes"
      ]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 evidence check requires active provider ledger rows", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );
      await writePassingM1EvidenceBundle(targetDir);

      await expect(execFileAsync("pnpm", ["run", "m1:evidence:check"], { cwd: targetDir })).rejects.toMatchObject({
        stdout: expect.stringContaining("provider ledger status is not active for clerk preview application")
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 evidence check requires Clerk smoke user fixture evidence", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--status",
          "active"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );
      await writePassingM1EvidenceBundle(targetDir, { writeAuthFixture: false });

      await expect(execFileAsync("pnpm", ["run", "m1:evidence:check"], { cwd: targetDir })).rejects.toMatchObject({
        stdout: expect.stringContaining("missing Clerk smoke user evidence")
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 evidence check requires deploy and smoke URL consistency", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--status",
          "active"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );
      await writePassingM1EvidenceBundle(targetDir);

      const smokeOutputPath = join(targetDir, "docs/milestones/evidence/M1-preview-e2e/smoke-output.txt");
      const smokeOutput = await readFile(smokeOutputPath, "utf8");
      await writeFile(
        smokeOutputPath,
        smokeOutput.replace(
          "Deploy URL: https://acme-crm-git-m1.vercel.app",
          "Deploy URL: https://acme-crm-unrelated.vercel.app"
        )
      );

      await expect(execFileAsync("pnpm", ["run", "m1:evidence:check"], { cwd: targetDir })).rejects.toMatchObject({
        stdout: expect.stringContaining("smoke output deploy URL does not match deploy URL evidence")
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 evidence check rejects smoke evidence older than deploy evidence", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--status",
          "active"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );
      await writePassingM1EvidenceBundle(targetDir);

      const smokeOutputPath = join(targetDir, "docs/milestones/evidence/M1-preview-e2e/smoke-output.txt");
      const smokeOutput = await readFile(smokeOutputPath, "utf8");
      await writeFile(
        smokeOutputPath,
        smokeOutput.replace("Checked at: 2026-06-22T10:05:00.000Z", "Checked at: 2026-06-22T09:59:00.000Z")
      );

      await expect(execFileAsync("pnpm", ["run", "m1:evidence:check"], { cwd: targetDir })).rejects.toMatchObject({
        stdout: expect.stringContaining("smoke output checked timestamp is older than deploy output")
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 evidence check requires top-level PASS result lines", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--status",
          "active"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );
      await writePassingM1EvidenceBundle(targetDir);

      const smokeOutputPath = join(targetDir, "docs/milestones/evidence/M1-preview-e2e/smoke-output.txt");
      const smokeOutput = await readFile(smokeOutputPath, "utf8");
      await writeFile(
        smokeOutputPath,
        [
          smokeOutput.replace("Result: PASS", "Result: FAIL"),
          "Reason: expected literal Result: PASS from a completed deployed smoke",
          ""
        ].join("\n")
      );

      await expect(execFileAsync("pnpm", ["run", "m1:evidence:check"], { cwd: targetDir })).rejects.toMatchObject({
        stdout: expect.stringContaining("smoke output top-level result is not PASS")
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 evidence check requires provider-link local state", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--status",
          "active"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );
      await writePassingM1EvidenceBundle(targetDir, { writeProviderLinksState: false });

      await expect(execFileAsync("pnpm", ["run", "m1:evidence:check"], { cwd: targetDir })).rejects.toMatchObject({
        stdout: expect.stringContaining("missing .agentstack/provider-links.json from m1:providers:link")
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 evidence check rejects failed runbook results", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--status",
          "active"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );
      await writePassingM1EvidenceBundle(targetDir);

      const runbookPath = join(targetDir, "docs/milestones/evidence/M1-preview-e2e/runbook.md");
      const runbook = await readFile(runbookPath, "utf8");
      await writeFile(runbookPath, runbook.replace("Result: `pass`", "Result: `fail`"));

      await expect(execFileAsync("pnpm", ["run", "m1:evidence:check"], { cwd: targetDir })).rejects.toMatchObject({
        stdout: expect.stringContaining("runbook contains failed step result")
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 evidence check requires all runbook step results", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--status",
          "active"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );
      await writePassingM1EvidenceBundle(targetDir);

      const runbookPath = join(targetDir, "docs/milestones/evidence/M1-preview-e2e/runbook.md");
      const runbook = await readFile(runbookPath, "utf8");
      await writeFile(
        runbookPath,
        runbook.replace(
          "### 4. Deploy Preview\n\n```bash\npnpm run m1:preview:deploy -- --confirm-live-mutation\n```\n\nResult: `pass`\n",
          "### 4. Deploy Preview\n\n```bash\npnpm run m1:preview:deploy -- --confirm-live-mutation\n```\n\n"
        )
      );

      await expect(execFileAsync("pnpm", ["run", "m1:evidence:check"], { cwd: targetDir })).rejects.toMatchObject({
        stdout: expect.stringContaining("runbook step Deploy Preview result is missing")
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 evidence check rejects unchanged final runbook checkboxes", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--status",
          "active"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );
      await writePassingM1EvidenceBundle(targetDir);

      const runbookPath = join(targetDir, "docs/milestones/evidence/M1-preview-e2e/runbook.md");
      const runbook = await readFile(runbookPath, "utf8");
      await writeFile(runbookPath, runbook.replace("- Evidence: `pass`", "- Evidence: `unchanged`"));

      await expect(execFileAsync("pnpm", ["run", "m1:evidence:check"], { cwd: targetDir })).rejects.toMatchObject({
        stdout: expect.stringContaining("runbook final Evidence checkbox is not pass")
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 evidence check requires all final runbook checkboxes", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--status",
          "active"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );
      await writePassingM1EvidenceBundle(targetDir);

      const runbookPath = join(targetDir, "docs/milestones/evidence/M1-preview-e2e/runbook.md");
      const runbook = await readFile(runbookPath, "utf8");
      await writeFile(runbookPath, runbook.replace("- Data: `pass`\n", ""));

      await expect(execFileAsync("pnpm", ["run", "m1:evidence:check"], { cwd: targetDir })).rejects.toMatchObject({
        stdout: expect.stringContaining("runbook final Data checkbox is missing")
      });
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 smoke helper requires matching deploy evidence before recording smoke", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });
      await writeFile(
        join(targetDir, "m1-preview-dom.html"),
        [
          '<main data-agentstack-auth-state="signed-in">',
          '<section data-agentstack-protected-data-state="protected-data-loaded"',
          ' data-agentstack-protected-workspace-id="workspace-secret-123"></section>',
          "</main>"
        ].join("")
      );

      await expect(
        execFileAsync(
          "pnpm",
          [
            "run",
            "m1:preview:smoke",
            "--",
            "--url",
            "https://acme-crm-git-m1.vercel.app",
            "--dom-file",
            "m1-preview-dom.html"
          ],
          { cwd: targetDir }
        )
      ).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL m1 preview smoke.deploy-evidence-required")
      });
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/smoke-output.txt"), "utf8")
      ).rejects.toThrow();
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/deploy-url.txt"), "utf8")
      ).rejects.toThrow();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 smoke helper requires top-level PASS deploy evidence before recording smoke", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      const evidenceDir = join(targetDir, "docs/milestones/evidence/M1-preview-e2e");
      await writeFile(join(evidenceDir, "deploy-url.txt"), "https://acme-crm-git-m1.vercel.app\n");
      await writeFile(
        join(evidenceDir, "deploy-output.txt"),
        [
          "# M1 Preview Deploy Output",
          "",
          "Result: FAIL",
          "Checked at: 2026-06-22T10:00:00.000Z",
          "Convex apply: completed",
          "Vercel apply: failed",
          "Deploy URL: https://acme-crm-git-m1.vercel.app",
          "Reason: expected literal Result: PASS from a completed deploy",
          ""
        ].join("\n")
      );
      await writeFile(
        join(targetDir, "m1-preview-dom.html"),
        [
          '<main data-agentstack-auth-state="signed-in">',
          '<section data-agentstack-protected-data-state="protected-data-loaded"',
          ' data-agentstack-protected-workspace-id="workspace-secret-123"></section>',
          "</main>"
        ].join("")
      );

      await expect(
        execFileAsync(
          "pnpm",
          [
            "run",
            "m1:preview:smoke",
            "--",
            "--url",
            "https://acme-crm-git-m1.vercel.app",
            "--dom-file",
            "m1-preview-dom.html"
          ],
          { cwd: targetDir }
        )
      ).rejects.toMatchObject({
        stdout: expect.stringContaining("deploy-output.txt top-level result is not PASS")
      });
      await expect(readFile(join(evidenceDir, "smoke-output.txt"), "utf8")).rejects.toThrow();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 provider link requires active provider ledger rows", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );

      await expect(
        execFileAsync("pnpm", ["run", "m1:providers:link"], {
          cwd: targetDir,
          env: sourceCliEnv()
        })
      ).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL m1 providers link.ledger-active-required")
      });
      await expect(readFile(join(targetDir, ".agentstack/provider-links.json"), "utf8")).rejects.toThrow();
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/provider-links.txt"), "utf8")
      ).rejects.toThrow();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 ledger helper restores local state on partial record failure", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });
      const initialLedger = await readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8");

      const fakeCliPath = join(targetDir, "fake-agentstack-cli-ledger-fail.mjs");
      await writeFile(
        fakeCliPath,
        [
          "#!/usr/bin/env node",
          'import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";',
          "const args = process.argv.slice(2);",
          'appendFileSync("m1-ledger-record-fail-cli.jsonl", `${JSON.stringify(args)}\\n`);',
          'const rendered = args.join(" ");',
          'if (rendered.includes("--service clerk")) {',
          '  mkdirSync("docs/milestones/evidence/M1-preview-e2e", { recursive: true });',
          '  writeFileSync("docs/provider-resource-ledger.md", "| id | provider | type | env | owner | name | external id/url | purpose | created by | created at | cleanup trigger | status | cleanup | last checked | evidence | notes |\\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\\n| clerk-preview-application | clerk | application | preview | cardinal-dev | acme-crm-preview | redacted | M1 preview Clerk auth smoke | Codex | 2026-06-22 | M1 pass or pivot | active | delete through Clerk dashboard |  | docs/milestones/evidence/M1-preview-e2e/provider-ledger-clerk-2026-06-22.md | recorded by m1:ledger:record |\\n");',
          '  writeFileSync("docs/milestones/evidence/M1-preview-e2e/provider-ledger-clerk-2026-06-22.md", "# partial clerk evidence\\n");',
          '  console.log("RECORDED provider ledger clerk preview");',
          "  process.exit(0);",
          "}",
          'if (rendered.includes("--service convex")) {',
          '  console.error("convex ledger record failed");',
          "  process.exit(1);",
          "}",
          "console.error(`Unexpected command: ${rendered}`);",
          "process.exit(1);",
          ""
        ].join("\n")
      );
      await chmod(fakeCliPath, 0o755);

      await expect(
        execFileAsync(
          "pnpm",
          [
            "run",
            "m1:ledger:record",
            "--",
            "--owner",
            "cardinal-dev",
            "--created-by",
            "Codex",
            "--created-at",
            "2026-06-22",
            "--status",
            "active"
          ],
          {
            cwd: targetDir,
            env: {
              ...sourceCliEnv(),
              AGENTSTACK_CLI_BIN: fakeCliPath,
              M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
              M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
              M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
            }
          }
        )
      ).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL m1 ledger record")
      });

      await expect(readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8")).resolves.toBe(
        initialLedger
      );
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/provider-ledger-clerk-2026-06-22.md"), "utf8")
      ).rejects.toThrow();
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/provider-ledger-convex-2026-06-22.md"), "utf8")
      ).rejects.toThrow();
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/provider-ledger-vercel-2026-06-22.md"), "utf8")
      ).rejects.toThrow();
      const fakeCliLog = (await readFile(join(targetDir, "m1-ledger-record-fail-cli.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(fakeCliLog.map((args) => args[args.indexOf("--service") + 1])).toEqual(["clerk", "convex"]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 provider link restores local state on partial link failure", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--status",
          "active"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );

      await writeFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/provider-links.txt"),
        [
          "# M1 Provider Link Evidence",
          "",
          "Result: PASS",
          "Clerk preview application: linked",
          "Convex preview deployment: linked",
          "Vercel preview project: linked",
          "Local mutation: .agentstack/provider-links.json",
          ""
        ].join("\n")
      );

      const fakeCliPath = join(targetDir, "fake-agentstack-cli-link-fail.mjs");
      await writeFile(
        fakeCliPath,
        [
          "#!/usr/bin/env node",
          'import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";',
          "const args = process.argv.slice(2);",
          'appendFileSync("m1-provider-link-fail-cli.jsonl", `${JSON.stringify(args)}\\n`);',
          'const rendered = args.join(" ");',
          'if (rendered === "provider link --service clerk --env preview --resource-type application --name acme-crm-preview") {',
          '  mkdirSync(".agentstack", { recursive: true });',
          '  writeFileSync(".agentstack/provider-links.json", JSON.stringify({ links: [{ service: "clerk", environment: "preview", resourceType: "application", name: "acme-crm-preview", ledgerStatus: "active" }] }, null, 2));',
          '  console.log("LINKED provider clerk preview");',
          "  process.exit(0);",
          "}",
          'if (rendered === "provider link --service convex --env preview --resource-type deployment --name acme-crm-preview") {',
          '  console.error("convex link failed");',
          "  process.exit(1);",
          "}",
          "console.error(`Unexpected command: ${rendered}`);",
          "process.exit(1);",
          ""
        ].join("\n")
      );
      await chmod(fakeCliPath, 0o755);

      await expect(
        execFileAsync("pnpm", ["run", "m1:providers:link"], {
          cwd: targetDir,
          env: { ...sourceCliEnv(), AGENTSTACK_CLI_BIN: fakeCliPath }
        })
      ).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL m1 providers link")
      });

      await expect(readFile(join(targetDir, ".agentstack/provider-links.json"), "utf8")).rejects.toThrow();
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/provider-links.txt"), "utf8")
      ).rejects.toThrow();
      const fakeCliLog = (await readFile(join(targetDir, "m1-provider-link-fail-cli.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(fakeCliLog).toEqual([
        [
          "provider",
          "link",
          "--service",
          "clerk",
          "--env",
          "preview",
          "--resource-type",
          "application",
          "--name",
          "acme-crm-preview"
        ],
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
        ]
      ]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 deploy helper requires active provider ledger rows before provider execution", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );

      const fakeCliPath = join(targetDir, "fake-agentstack-cli-planned-deploy.mjs");
      await writeFile(
        fakeCliPath,
        [
          "#!/usr/bin/env node",
          'import { appendFileSync } from "node:fs";',
          'appendFileSync("m1-preview-deploy-planned-cli.jsonl", `${JSON.stringify(process.argv.slice(2))}\\n`);',
          'console.error("provider execution should not start");',
          "process.exit(1);",
          ""
        ].join("\n")
      );
      await chmod(fakeCliPath, 0o755);

      await expect(
        execFileAsync("pnpm", ["run", "m1:preview:deploy", "--", "--confirm-live-mutation"], {
          cwd: targetDir,
          env: { ...sourceCliEnv(), AGENTSTACK_CLI_BIN: fakeCliPath }
        })
      ).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL m1 preview deploy.ledger-active-required")
      });
      await expect(readFile(join(targetDir, "m1-preview-deploy-planned-cli.jsonl"), "utf8")).rejects.toThrow();
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/deploy-output.txt"), "utf8")
      ).rejects.toThrow();
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/deploy-url.txt"), "utf8")
      ).rejects.toThrow();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 deploy helper requires provider-link evidence before provider execution", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--status",
          "active"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );

      const fakeCliPath = join(targetDir, "fake-agentstack-cli-unlinked-deploy.mjs");
      await writeFile(
        fakeCliPath,
        [
          "#!/usr/bin/env node",
          'import { appendFileSync } from "node:fs";',
          'appendFileSync("m1-preview-deploy-unlinked-cli.jsonl", `${JSON.stringify(process.argv.slice(2))}\\n`);',
          'console.error("provider execution should not start");',
          "process.exit(1);",
          ""
        ].join("\n")
      );
      await chmod(fakeCliPath, 0o755);

      await expect(
        execFileAsync("pnpm", ["run", "m1:preview:deploy", "--", "--confirm-live-mutation"], {
          cwd: targetDir,
          env: { ...sourceCliEnv(), AGENTSTACK_CLI_BIN: fakeCliPath }
        })
      ).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL m1 preview deploy.provider-links-required")
      });
      await expect(readFile(join(targetDir, "m1-preview-deploy-unlinked-cli.jsonl"), "utf8")).rejects.toThrow();
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/deploy-output.txt"), "utf8")
      ).rejects.toThrow();
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/deploy-url.txt"), "utf8")
      ).rejects.toThrow();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 deploy helper requires top-level PASS provider-link evidence before provider execution", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--status",
          "active"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );
      await writePassingM1EvidenceBundle(targetDir);

      const evidenceDir = join(targetDir, "docs/milestones/evidence/M1-preview-e2e");
      await rm(join(evidenceDir, "deploy-url.txt"), { force: true });
      await rm(join(evidenceDir, "deploy-output.txt"), { force: true });
      await rm(join(evidenceDir, "smoke-output.txt"), { force: true });
      await writeFile(
        join(evidenceDir, "provider-links.txt"),
        [
          "# M1 Provider Link Evidence",
          "",
          "Result: FAIL",
          "Clerk preview application: linked",
          "Convex preview deployment: linked",
          "Vercel preview project: linked",
          "Local mutation: .agentstack/provider-links.json",
          "Provider mutation: none",
          "Ledger mutation: none",
          "Telemetry mutation: none",
          "Reason: expected literal Result: PASS from a completed provider-link run",
          ""
        ].join("\n")
      );

      const fakeCliPath = join(targetDir, "fake-agentstack-cli-provider-link-failed-deploy.mjs");
      await writeFile(
        fakeCliPath,
        [
          "#!/usr/bin/env node",
          'import { appendFileSync } from "node:fs";',
          'appendFileSync("m1-preview-deploy-provider-link-failed-cli.jsonl", `${JSON.stringify(process.argv.slice(2))}\\n`);',
          'console.error("provider execution should not start");',
          "process.exit(1);",
          ""
        ].join("\n")
      );
      await chmod(fakeCliPath, 0o755);

      await expect(
        execFileAsync("pnpm", ["run", "m1:preview:deploy", "--", "--confirm-live-mutation"], {
          cwd: targetDir,
          env: { ...sourceCliEnv(), AGENTSTACK_CLI_BIN: fakeCliPath }
        })
      ).rejects.toMatchObject({
        stdout: expect.stringContaining("provider-links.txt top-level result is not PASS")
      });
      await expect(
        readFile(join(targetDir, "m1-preview-deploy-provider-link-failed-cli.jsonl"), "utf8")
      ).rejects.toThrow();
      await expect(readFile(join(evidenceDir, "deploy-output.txt"), "utf8")).rejects.toThrow();
      await expect(readFile(join(evidenceDir, "deploy-url.txt"), "utf8")).rejects.toThrow();
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 ledger helper replaces explicit pending rows with real ids", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      const sourceEnv = sourceCliEnv();
      const {
        M1_CLERK_EXTERNAL_ID: _m1ClerkExternalId,
        M1_CONVEX_EXTERNAL_ID: _m1ConvexExternalId,
        M1_VERCEL_EXTERNAL_ID: _m1VercelExternalId,
        ...ledgerEnvWithoutExternalIds
      } = sourceEnv;
      const pending = await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--allow-pending"
        ],
        {
          cwd: targetDir,
          env: ledgerEnvWithoutExternalIds
        }
      );
      const pendingOutput = `${pending.stdout}${pending.stderr}`;
      expect(pendingOutput).toContain("PASS m1 ledger record");
      expect(pendingOutput).toContain("Pending external IDs: yes");
      expect(pendingOutput).toContain("M1 Ledger checkbox: unchanged until real external IDs replace pending rows");
      expect(pendingOutput).toContain(
        "Local mutation: docs/milestones/evidence/M1-preview-e2e/provider-ledger-clerk-2026-06-22.md"
      );

      const pendingLedger = await readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8");
      expect(pendingLedger).toContain("| clerk-preview-application | clerk | application | preview | cardinal-dev | acme-crm-preview | pending | M1 preview Clerk auth smoke | Codex | 2026-06-22 | M1 pass or pivot | planned | delete through Clerk dashboard |  | docs/milestones/evidence/M1-preview-e2e/provider-ledger-clerk-2026-06-22.md | recorded by m1:ledger:record |");

      const replace = await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--status",
          "active",
          "--replace"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );
      const replaceOutput = `${replace.stdout}${replace.stderr}`;
      expect(replaceOutput).toContain("UPDATED provider ledger clerk preview");
      expect(replaceOutput).toContain("UPDATED provider ledger convex preview");
      expect(replaceOutput).toContain("UPDATED provider ledger vercel preview");
      expect(replaceOutput).toContain("PASS m1 ledger record");
      expect(replaceOutput).toContain("Replaced: clerk preview application");
      expect(replaceOutput).toContain("Replaced: convex preview deployment");
      expect(replaceOutput).toContain("Replaced: vercel preview project");
      expect(replaceOutput).toContain(
        "Local mutation: docs/milestones/evidence/M1-preview-e2e/provider-ledger-clerk-2026-06-22-active.md"
      );
      expect(replaceOutput).toContain("Provider mutation: none");
      expect(replaceOutput).toContain("Telemetry mutation: none");
      expect(replaceOutput).not.toContain("Pending external IDs: yes");
      expect(replaceOutput).not.toContain("secret-clerk-app-id-1234567890");
      expect(replaceOutput).not.toContain("secret-preview-1234567890");
      expect(replaceOutput).not.toContain("secret-acme-crm-preview");

      const providerLedger = await readFile(join(targetDir, "docs/provider-resource-ledger.md"), "utf8");
      expect(providerLedger.match(/\| clerk-preview-application \|/g)).toHaveLength(1);
      expect(providerLedger.match(/\| convex-preview-deployment \|/g)).toHaveLength(1);
      expect(providerLedger.match(/\| vercel-preview-project \|/g)).toHaveLength(1);
      expect(providerLedger).toContain("| clerk-preview-application | clerk | application | preview | cardinal-dev | acme-crm-preview | https://clerk.example/apps/secret-clerk-app-id-1234567890 | M1 preview Clerk auth smoke | Codex | 2026-06-22 | M1 pass or pivot | active | delete through Clerk dashboard |  | docs/milestones/evidence/M1-preview-e2e/provider-ledger-clerk-2026-06-22-active.md | recorded by m1:ledger:record |");
      expect(providerLedger).toContain("| convex-preview-deployment | convex | deployment | preview | cardinal-dev | acme-crm-preview | https://convex.cloud/d/secret-preview-1234567890 | M1 preview protected Convex data smoke | Codex | 2026-06-22 | M1 pass or pivot | active | delete through Convex dashboard |  | docs/milestones/evidence/M1-preview-e2e/provider-ledger-convex-2026-06-22-active.md | recorded by m1:ledger:record |");
      expect(providerLedger).toContain("| vercel-preview-project | vercel | project | preview | cardinal-dev | acme-crm | https://vercel.com/cardinal-dev/secret-acme-crm-preview | M1 preview Vercel deploy smoke | Codex | 2026-06-22 | M1 pass or pivot | active | delete through Vercel dashboard |  | docs/milestones/evidence/M1-preview-e2e/provider-ledger-vercel-2026-06-22-active.md | recorded by m1:ledger:record |");
      for (const service of ["clerk", "convex", "vercel"]) {
        const evidence = await readFile(
          join(targetDir, `docs/milestones/evidence/M1-preview-e2e/provider-ledger-${service}-2026-06-22-active.md`),
          "utf8"
        );
        expect(evidence).toContain("External id/url: recorded in provider ledger (redacted)");
        expect(evidence).toContain("Provider mutation: none");
        expect(evidence).toContain("Telemetry mutation: none");
        expect(evidence).not.toContain("secret-clerk-app-id-1234567890");
        expect(evidence).not.toContain("secret-preview-1234567890");
        expect(evidence).not.toContain("secret-acme-crm-preview");
      }
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

  test("generated M1 deploy helper writes redacted failure evidence after provider execution starts", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "agentstack-create-"));
    const targetDir = join(tempRoot, "acme-crm");

    try {
      await generateProject({ name: "acme-crm", targetDir });

      await execFileAsync(
        "pnpm",
        [
          "run",
          "m1:ledger:record",
          "--",
          "--owner",
          "cardinal-dev",
          "--created-by",
          "Codex",
          "--created-at",
          "2026-06-22",
          "--status",
          "active"
        ],
        {
          cwd: targetDir,
          env: {
            ...sourceCliEnv(),
            M1_CLERK_EXTERNAL_ID: "https://clerk.example/apps/secret-clerk-app-id-1234567890",
            M1_CONVEX_EXTERNAL_ID: "https://convex.cloud/d/secret-preview-1234567890",
            M1_VERCEL_EXTERNAL_ID: "https://vercel.com/cardinal-dev/secret-acme-crm-preview"
          }
        }
      );
      await expect(
        execFileAsync("pnpm", ["run", "m1:providers:link"], {
          cwd: targetDir,
          env: sourceCliEnv()
        })
      ).resolves.toBeDefined();
      await writeFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/deploy-url.txt"),
        "https://stale-success.example.vercel.app\n"
      );
      await writeFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/smoke-output.txt"),
        [
          "# M1 Preview Smoke Output",
          "",
          "Result: PASS",
          "Deploy URL: https://stale-success.example.vercel.app",
          "Auth state: signed-in",
          "Protected data state: protected-data-loaded",
          "Workspace id: present (redacted)",
          ""
        ].join("\n")
      );

      const fakeCliPath = join(targetDir, "fake-agentstack-cli-fail.mjs");
      await writeFile(
        fakeCliPath,
        [
          "#!/usr/bin/env node",
          'import { appendFileSync } from "node:fs";',
          "const args = process.argv.slice(2);",
          'appendFileSync("m1-preview-deploy-fail-cli.jsonl", `${JSON.stringify(args)}\\n`);',
          'const rendered = args.join(" ");',
          'if (rendered === "provider apply --service convex --env preview") {',
          '  console.log("APPLIED provider convex preview");',
          '  console.log("Evidence: live-mutation");',
          "  process.exit(0);",
          "}",
          'if (rendered === "provider apply --service vercel --env preview") {',
          '  console.error("vercel failed with token secret-vercel-token-1234567890");',
          "  process.exit(1);",
          "}",
          "console.error(`Unexpected command: ${rendered}`);",
          "process.exit(1);",
          ""
        ].join("\n")
      );
      await chmod(fakeCliPath, 0o755);

      await expect(
        execFileAsync("pnpm", ["run", "m1:preview:deploy", "--", "--confirm-live-mutation"], {
          cwd: targetDir,
          env: { ...sourceCliEnv(), AGENTSTACK_CLI_BIN: fakeCliPath }
        })
      ).rejects.toMatchObject({
        stdout: expect.stringContaining("FAIL m1 preview deploy"),
        stderr: expect.stringContaining("secret-vercel-token-1234567890")
      });

      const deployEvidence = await readFile(
        join(targetDir, "docs/milestones/evidence/M1-preview-e2e/deploy-output.txt"),
        "utf8"
      );
      expect(deployEvidence).toContain("# M1 Preview Deploy Output");
      expect(deployEvidence).toContain("Result: FAIL");
      expect(deployEvidence).toContain("Failed stage: vercel preview deploy");
      expect(deployEvidence).toContain("Convex apply: completed");
      expect(deployEvidence).toContain("Vercel apply: failed");
      expect(deployEvidence).toContain("Deploy URL: unavailable");
      expect(deployEvidence).toContain("Raw provider stdout, stderr, provider identifiers, tokens, and secrets are not stored in this evidence file.");
      expect(deployEvidence).not.toContain("secret-vercel-token-1234567890");
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/deploy-url.txt"), "utf8")
      ).rejects.toThrow();
      await expect(
        readFile(join(targetDir, "docs/milestones/evidence/M1-preview-e2e/smoke-output.txt"), "utf8")
      ).rejects.toThrow();

      const fakeCliLog = (await readFile(join(targetDir, "m1-preview-deploy-fail-cli.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(fakeCliLog).toEqual([
        ["provider", "apply", "--service", "convex", "--env", "preview"],
        ["provider", "apply", "--service", "vercel", "--env", "preview"]
      ]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 15000);

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

async function writeFakeProviderPnpm(targetDir: string): Promise<string> {
  const fakeBinDir = join(targetDir, ".agentstack/fake-bin");
  await mkdir(fakeBinDir, { recursive: true });
  const fakePnpmPath = join(fakeBinDir, "pnpm");
  await writeFile(
    fakePnpmPath,
    [
      "#!/usr/bin/env node",
      'import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";',
      'import { dirname } from "node:path";',
      "const args = process.argv.slice(2);",
      'mkdirSync(".agentstack", { recursive: true });',
      'writeFileSync(".agentstack/fake-provider-calls.jsonl", `${JSON.stringify({ args })}\\n`, { flag: "a" });',
      'const statePath = ".agentstack/fake-provider-state.json";',
      "const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};",
      "function save() { writeFileSync(statePath, JSON.stringify(state, null, 2)); }",
      "function ensureDir(path) { mkdirSync(dirname(path), { recursive: true }); }",
      "if (args[0] !== 'exec') { console.error(`Unexpected fake pnpm call: ${args.join(' ')}`); process.exit(1); }",
      "const command = args[1];",
      "const rest = args.slice(2);",
      "if (command === 'clerk' && rest.join(' ') === 'whoami --json') { console.log(JSON.stringify({ email: 'owner@example.test', linked: null })); process.exit(0); }",
      "if (command === 'clerk' && rest.join(' ') === 'apps list --json') {",
      "  console.log(JSON.stringify(state.clerkApp ? [{ application_id: state.clerkApp.id, name: state.clerkApp.name, instances: [{ environment_type: 'development', publishable_key: 'pk_test_YWNtZS5jbGVyay5hY2NvdW50cy5kZXYk' }] }] : []));",
      "  process.exit(0);",
      "}",
      "if (command === 'clerk' && rest[0] === 'apps' && rest[1] === 'create') { state.clerkApp = { id: 'app_fake_clerk_preview', name: rest[2] }; save(); console.log(JSON.stringify({ application_id: state.clerkApp.id, name: state.clerkApp.name })); process.exit(0); }",
      "if (command === 'clerk' && rest[0] === 'link' && rest[1] === '--app') { ensureDir('.clerk/project.json'); writeFileSync('.clerk/project.json', JSON.stringify({ appId: rest[2] }, null, 2)); console.log('Linked Clerk app'); process.exit(0); }",
      "if (command === 'clerk' && rest.join(' ') === 'api /jwt_templates') { console.log(JSON.stringify(state.clerkJwtTemplate ? [state.clerkJwtTemplate] : [])); process.exit(0); }",
      "if (command === 'clerk' && rest[0] === 'api' && rest[1] === '/jwt_templates' && rest[2] === '--data') { state.clerkJwtTemplate = { id: 'jwt_fake_convex_template', name: 'convex' }; save(); console.log(JSON.stringify(state.clerkJwtTemplate)); process.exit(0); }",
      "if (command === 'clerk' && rest[0] === 'api' && rest[1] === '/users?email_address=acme-crm%2Bm1-smoke%2Bclerk_test%40example.com') { console.log(JSON.stringify(state.clerkSmokeUser ? [state.clerkSmokeUser] : [])); process.exit(0); }",
      "if (command === 'clerk' && rest[0] === 'api' && rest[1] === '/users' && rest[2] === '--data') { const payload = JSON.parse(rest[3]); state.clerkSmokeUser = { id: 'user_fake_m1_smoke', email_addresses: [{ email_address: payload.email_address[0] }] }; save(); console.log(JSON.stringify(state.clerkSmokeUser)); process.exit(0); }",
      "if (command === 'clerk' && rest[0] === 'api' && rest[1] === '/users/user_fake_m1_smoke' && rest[2] === '--method' && rest[3] === 'PATCH') { state.clerkSmokeUserUpdated = JSON.parse(rest[5]); save(); console.log(JSON.stringify({ id: 'user_fake_m1_smoke' })); process.exit(0); }",
      "if (command === 'clerk' && rest[0] === 'api' && rest[1] === '/users/user_fake_m1_smoke' && rest[2] === '--method' && rest[3] === 'DELETE') { state.clerkSmokeUserDeleted = true; save(); console.log(JSON.stringify({ id: 'user_fake_m1_smoke', deleted: true })); process.exit(0); }",
      "if (command === 'convex' && rest.join(' ') === 'deployment create acme-crm-preview --type preview --expiration in 5 days') { console.log('Created new preview deployment:'); console.log('[Preview] cardinal:acme-crm:preview/acme-crm-preview'); console.log('<convex-url>'); console.log('teamSlug: cardinal'); console.log('projectSlug: acme-crm'); process.exit(0); }",
      "if (command === 'convex' && rest.join(' ') === 'env --deployment cardinal:acme-crm:preview/acme-crm-preview set CLERK_JWT_ISSUER_DOMAIN https://acme.clerk.accounts.dev') { state.convexIssuer = rest.at(-1); save(); console.log('Set Convex env'); process.exit(0); }",
      "if (command === 'convex' && rest[0] === 'deployment' && rest[1] === 'token' && rest[2] === 'create') { const envPath = rest.at(-1); ensureDir(envPath); writeFileSync(envPath, 'CONVEX_DEPLOY_KEY=convex_secret_deploy_key\\n'); console.log('Saved deploy key'); process.exit(0); }",
      "if (command === 'vercel' && rest.join(' ') === 'whoami') { console.log('Vercel CLI 54.14.5'); console.log('cardinal-dev'); process.exit(0); }",
      "if (command === 'vercel' && rest.join(' ') === 'project ls --json') { console.log(JSON.stringify({ projects: state.vercelProject ? [state.vercelProject] : [] })); process.exit(0); }",
      "if (command === 'vercel' && rest[0] === 'project' && rest[1] === 'add') { state.vercelProject = { id: 'prj_fake_vercel_preview', name: rest[2], accountId: 'org_fake_vercel_owner' }; save(); console.log('Added Vercel project'); process.exit(0); }",
      "if (command === 'vercel' && rest[0] === 'link') { ensureDir('.vercel/project.json'); writeFileSync('.vercel/project.json', JSON.stringify({ projectId: 'prj_fake_vercel_preview', orgId: 'org_fake_vercel_owner' }, null, 2)); console.log('Linked Vercel project'); process.exit(0); }",
      "if (command === 'vercel' && rest[0] === 'env' && rest[1] === 'rm') { console.log('Removed Vercel env'); process.exit(0); }",
      "if (command === 'vercel' && rest[0] === 'env' && rest[1] === 'add') { state.vercelEnv = { ...(state.vercelEnv || {}), [rest[2]]: 'set' }; save(); console.log('Added Vercel env'); process.exit(0); }",
      "console.error(`Unexpected provider command: ${command} ${rest.join(' ')}`);",
      "process.exit(1);",
      ""
    ].join("\n")
  );
  await chmod(fakePnpmPath, 0o755);
  return fakeBinDir;
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

async function writePassingM1EvidenceBundle(
  targetDir: string,
  {
    writeProviderLinksState = true,
    writeAuthFixture = true
  }: { writeProviderLinksState?: boolean; writeAuthFixture?: boolean } = {}
): Promise<void> {
  const evidenceDir = join(targetDir, "docs/milestones/evidence/M1-preview-e2e");

  if (writeProviderLinksState) {
    await mkdir(join(targetDir, ".agentstack"), { recursive: true });
    await writeFile(
      join(targetDir, ".agentstack/provider-links.json"),
      JSON.stringify(
        {
          links: [
            {
              service: "clerk",
              environment: "preview",
              resourceType: "application",
              name: "acme-crm-preview",
              ledgerStatus: "active"
            },
            {
              service: "convex",
              environment: "preview",
              resourceType: "deployment",
              name: "acme-crm-preview",
              ledgerStatus: "active"
            },
            {
              service: "vercel",
              environment: "preview",
              resourceType: "project",
              name: "acme-crm",
              ledgerStatus: "active"
            }
          ]
        },
        null,
        2
      )
    );
  }

  await writeFile(
    join(evidenceDir, "provider-bootstrap.txt"),
    [
      "# M1 Provider Bootstrap Evidence",
      "",
      "Result: PASS",
      "Checked at: 2026-06-22T09:45:00.000Z",
      "Clerk preview application: created or reused and linked",
      "Convex preview deployment: preview deployment ensured; deploy key saved to .agentstack/convex-preview.env",
      "Vercel preview project: project ensured and linked",
      "Provider mutation: clerk app/link, convex preview deployment/deploy-key/env, vercel project/link/env",
      "Ledger mutation: docs/provider-resource-ledger.md",
      "Local mutation: .vercel, .agentstack/convex-preview.env",
      "Telemetry mutation: provider ledger telemetry only",
      ""
    ].join("\n")
  );

  await writeFile(
    join(evidenceDir, "provider-links.txt"),
    [
      "# M1 Provider Link Evidence",
      "",
      "Result: PASS",
      "Clerk preview application: linked",
      "Convex preview deployment: linked",
      "Vercel preview project: linked",
      "Local mutation: .agentstack/provider-links.json",
      "Provider mutation: none",
      "Ledger mutation: none",
      "Telemetry mutation: none",
      ""
    ].join("\n")
  );
  await writeFile(join(evidenceDir, "deploy-url.txt"), "https://acme-crm-git-m1.vercel.app\n");
  await writeFile(
    join(evidenceDir, "deploy-output.txt"),
    [
      "# M1 Preview Deploy Output",
      "",
      "Result: PASS",
      "Checked at: 2026-06-22T10:00:00.000Z",
      "Convex apply: completed",
      "Vercel apply: completed",
      "Deploy URL: https://acme-crm-git-m1.vercel.app",
      ""
    ].join("\n")
  );
  await writeFile(
    join(evidenceDir, "smoke-output.txt"),
    [
      "# M1 Preview Smoke Output",
      "",
      "Result: PASS",
      "Checked at: 2026-06-22T10:05:00.000Z",
      "Deploy URL: https://acme-crm-git-m1.vercel.app",
      "Auth state: signed-in",
      "Protected data state: protected-data-loaded",
      "Workspace id: present (redacted)",
      ""
    ].join("\n")
  );

  if (writeAuthFixture) {
    await appendM1AuthFixtureLedgerRow(targetDir);
    await writeFile(
      join(evidenceDir, "clerk-smoke-user.txt"),
      [
        "# M1 Clerk Smoke User Evidence",
        "",
        "Result: PASS",
        "Checked at: 2026-06-22T10:04:00.000Z",
        "Action: ensure",
        "Provider: clerk",
        "Resource type: user",
        "Environment: preview",
        "Clerk smoke user: created or reused",
        "Client trust bypass: requested",
        "Local credential state: .agentstack/m1-auth-user.json",
        "Provider mutation: clerk user create/update/delete",
        "Ledger mutation: docs/provider-resource-ledger.md",
        "Local mutation: .agentstack/m1-auth-user.json",
        "Telemetry mutation: provider ledger telemetry only",
        "",
        "Raw passwords, OTP codes, session tokens, cookies, provider stdout, and full user payloads are not stored in this evidence file.",
        ""
      ].join("\n")
    );
  }

  const runbookPath = join(evidenceDir, "runbook.md");
  const runbook = await readFile(runbookPath, "utf8");
  await writeFile(runbookPath, completeM1RunbookScaffold(runbook));
}

async function appendM1AuthFixtureLedgerRow(targetDir: string): Promise<void> {
  const ledgerPath = join(targetDir, "docs/provider-resource-ledger.md");
  const ledger = await readFile(ledgerPath, "utf8");
  const row =
    "| clerk-preview-user | clerk | user | preview | cardinal-dev | acme-crm+m1-smoke+clerk_test@example.com | user_fake_m1_smoke | M1 preview Clerk sign-in smoke user | Codex | 2026-06-22 | M1 pass or cleanup | active | delete through Clerk dashboard or `pnpm run m1:auth:user -- delete --confirm-live-mutation` |  | docs/milestones/evidence/M1-preview-e2e/clerk-smoke-user.txt | recorded by m1:auth:user ensure; client trust bypass requested |";
  if (ledger.includes("| clerk-preview-user | clerk | user | preview |")) {
    return;
  }
  await writeFile(ledgerPath, `${ledger.replace(/\n*$/, "")}\n${row}\n`);
}

function completeM1RunbookScaffold(runbook: string): string {
  return runbook
    .replace("Status: not run", "Status: run")
    .replaceAll("[redacted owner or account label]", "cardinal-dev")
    .replaceAll("[operator name]", "Codex")
    .replaceAll("[yyyy-mm-dd]", "2026-06-22")
    .replaceAll("[redacted login or project-selection note, or none]", "none")
    .replaceAll("[not run | pass | fail]", "pass")
    .replaceAll("[redacted notes or blocker]", "completed with redacted evidence")
    .replaceAll("[pass | fail | unchanged]", "pass")
    .replaceAll("[next action or blocker]", "real provider resource blocker");
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
