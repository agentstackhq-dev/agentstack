const page = document.body.dataset.page;
for (const link of document.querySelectorAll(".nav a")) {
  if (link.dataset.page === page) {
    link.classList.add("active");
  }
}

const scenarios = {
  lifecycleInspector: {
    title: "Lifecycle preflight",
    command: "pnpm run inspect && pnpm run skills:inspect && pnpm run preview:apply && pnpm run doctor && pnpm run dev",
    result: "PASS inspect acme-crm / PASS skills inspect / PASS doctor preview / PASS dev preflight preview",
    detail: "Inspect summarizes generated anchors, services, and preview local-cloud state. Skills inspect verifies versioned repo-local guidance without MCP. Doctor runs validation plus selected-environment local-cloud checks. Dev is a preflight only: it prints next validation, env, sync, web, and mobile commands without starting real servers.",
    files: ["packages/core/src/lifecycle.ts", "packages/core/src/guidance.ts", "packages/cli/src/run.ts", "templates/b2b-saas/skills/agentstack/SKILL.md"]
  },
  missingAnchor: {
    title: "Generated anchor removed",
    command: "pnpm run validate",
    result: "FAIL template.anchor.missing",
    detail: "If a required file such as apps/web/package.json, pnpm-workspace.yaml, or docs/agentstack/theming.md is missing or is a directory, validation blocks before cloud checks run.",
    files: ["packages/core/src/validation.ts", "packages/cli/src/run.ts", "packages/cli/src/run.test.ts"]
  },
  envValues: {
    title: "Required custom env value",
    command: "pnpm run validate",
    result: "PASS validate",
    detail: "A required env declaration is satisfiable by .agentstack/env-values.json when it uses the environment -> surface -> variable -> string shape. agentstack env set writes local validation state only; invalid JSON or wrong leaf types fail explicitly.",
    files: ["packages/core/src/env-graph.ts", "packages/cli/src/context.ts", "templates/b2b-saas/.gitignore"]
  },
  providerEnvResources: {
    title: "Provider env resource rehearsal",
    command: "agentstack sync --env preview --apply && agentstack validate --cloud --env preview",
    result: "set-env preview.convex.STRIPE_MODE / PASS validate --cloud / Evidence: local-rehearsal / Scope: local-cloud state only; no live provider reads",
    detail: "Local-cloud sync rehearses provider env resources without calling real provider APIs. It refuses missing or invalid declared values before planning or applying, then stores redacted metadata and valueHash only so raw values such as sandbox are not copied into local-cloud state.",
    files: ["packages/adapters/src/local-cloud.ts", "templates/b2b-saas/docs/agentstack/environments.md", "tests/e2e/prototype.test.ts"]
  },
  staleCloud: {
    title: "Stale linked service",
    command: "agentstack sync --env preview --apply",
    result: "APPLIED preview / unlink preview.clerk",
    detail: "If a service was linked and later disabled in the manifest, validate --cloud reports cloud.service.stale. Sync reconciles by removing the stale selected-environment entry.",
    files: ["packages/adapters/src/local-cloud.ts", "packages/adapters/src/local-cloud.test.ts"]
  },
  themeDrift: {
    title: "Theme mirror drift",
    command: "pnpm run theme:validate",
    result: "FAIL theme.tokens.mirror-drift",
    detail: "Theme tokens live in packages/theme/tokens.json. The typed wrapper must import that JSON source instead of copying token values, so web and mobile cannot silently read stale theme constants.",
    files: ["packages/core/src/theme.ts", "packages/cli/src/run.ts", "templates/b2b-saas/packages/theme/src/index.ts"]
  },
  previewDeploy: {
    title: "Preview deploy rehearsal",
    command: "pnpm run preview:deploy && pnpm run preview:deploy:apply",
    result: "PLAN deploy preview / APPLIED deploy preview / Evidence: local-rehearsal",
    detail: "The deploy rehearsal is local-only. Plan does not write a deployment artifact. Apply writes .agentstack/deployments/preview.json and records agentstack.deploy.completed telemetry without calling real provider APIs.",
    files: ["templates/b2b-saas/docs/agentstack/preview.md", "packages/cli/src/run.ts", "tests/e2e/prototype.test.ts"]
  },
  productionRelease: {
    title: "Production release rehearsal",
    command: "pnpm run prod:prepare && pnpm run prod:provision && pnpm run prod:provision:apply && pnpm run prod:validate && pnpm run prod:deploy && pnpm run prod:deploy:apply",
    result: "PASS prod prepare production / PLAN prod provision production / APPLIED prod provision production / PASS validate --release production / PLAN deploy production / APPLIED deploy production / Evidence: local-rehearsal",
    detail: "The production release rehearsal is local-only. Prepare checks readiness and reports repair commands. Provision plans and applies local production state. Validate runs release validation. Deploy plans production deploy, and deploy apply writes a local artifact only after explicit production confirmation through the script. No real provider APIs are called.",
    files: ["templates/b2b-saas/docs/agentstack/release.md", "templates/b2b-saas/package.json", "packages/create-agent-stack/src/generate.test.ts"]
  },
  mobileBuild: {
    title: "Mobile build rehearsal",
    command: "pnpm run mobile:build:preview && pnpm run mobile:build:preview:apply",
    result: "PLAN mobile build preview / APPLIED mobile build preview / Evidence: local-rehearsal",
    detail: "The mobile build rehearsal checks local validation and EAS readiness, then writes .agentstack/builds/mobile-preview.json only when apply is used. It records agentstack.mobile.build.completed without submitting a real EAS build.",
    files: ["packages/core/src/mobile-build.ts", "packages/cli/src/run.ts", "templates/b2b-saas/docs/agentstack/mobile.md"]
  },
  telemetry: {
    title: "Inspect a validation journey",
    command: "agentstack observe timeline --env preview --journey validation && agentstack observe export --env preview --format otlp-json",
    result: "PASS observe timeline 2 / EXPORTED observe otlp-json preview <count> / .agentstack/exports/telemetry-preview-otlp.json",
    detail: "JSONL telemetry events remain the source for local inspection. Export writes an OTLP-shaped JSON local export artifact from redacted store query output; no network export or hosted provider is configured by default.",
    files: ["packages/telemetry/src/events.ts", "packages/telemetry/src/store.ts", "packages/cli/src/run.ts"]
  },
  observabilityInspection: {
    title: "Narrow an incident from local events",
    command: "agentstack observe errors --env production --since 2h --group-by component",
    result: "PASS observe errors / grouped by component",
    detail: "Start broad with query or timeline, then pivot into trace, journey, errors, webhook, component, or compare. These commands inspect redacted .agentstack/events.jsonl evidence through the current local telemetry boundary; hosted/network export, provider dashboards, and retention are outside the generated framework boundary.",
    files: ["templates/b2b-saas/docs/agentstack/observability.md", "packages/telemetry/src/store.ts", "packages/cli/src/run.ts"]
  }
};

function renderScenario(key) {
  const target = document.querySelector("[data-scenario-output]");
  if (!target || !scenarios[key]) return;
  const scenario = scenarios[key];
  target.innerHTML = `
    <h3>${scenario.title}</h3>
    <p><span class="pill">Command</span> <code>${scenario.command}</code></p>
    <p><span class="pill">Expected signal</span> <code>${scenario.result}</code></p>
    <p>${scenario.detail}</p>
    <div class="pill-row">${scenario.files.map((file) => `<span class="pill">${file}</span>`).join("")}</div>
  `;
}

const scenarioButtons = document.querySelectorAll("[data-scenario]");
for (const button of scenarioButtons) {
  button.addEventListener("click", () => {
    for (const current of scenarioButtons) current.classList.remove("active");
    button.classList.add("active");
    renderScenario(button.dataset.scenario);
  });
}

if (scenarioButtons.length > 0) {
  scenarioButtons[0].classList.add("active");
  renderScenario(scenarioButtons[0].dataset.scenario);
}

const concerns = {
  architecture: {
    title: "Architecture and ownership",
    summary: "The repo is split into five framework packages plus a generated B2B SaaS template. Core owns contracts and diagnostics; the CLI composes commands; adapters model provider boundaries; telemetry stores/query events; the generator copies the template.",
    commands: ["pnpm typecheck", "pnpm test"],
    files: [
      "packages/core/src/manifest.ts",
      "packages/cli/src/run.ts",
      "packages/adapters/src/types.ts",
      "packages/telemetry/src/events.ts",
      "packages/create-agent-stack/src/generate.ts"
    ]
  },
  workflow: {
    title: "Workflow orchestration",
    summary: "Generated apps expose scripts that route through scripts/agentstack.mjs. In source-prototype mode the wrapper uses AGENTSTACK_CLI_BIN and AGENTSTACK_TSX_BIN; in an installed package it resolves the agentstack bin without embedding local machine paths.",
    commands: ["pnpm run inspect", "pnpm run doctor", "pnpm run dev", "pnpm run preview:apply"],
    files: ["templates/b2b-saas/package.json", "templates/b2b-saas/scripts/agentstack.mjs", "packages/cli/src/context.ts"]
  },
  providers: {
    title: "Env and provider orchestration",
    summary: "Provider work is explicit by evidence tier. Local-cloud state records linked services, provider operation IDs, env resource metadata, deployments, and mobile builds. Command-plan adapters print Clerk, Convex, Vercel, and EAS command shapes with Evidence: provider-command-plan. Provider inspect uses Evidence: live-read. Supported provider apply uses Evidence: live-mutation and is ledger-gated before the executor runs.",
    commands: ["pnpm run env:inspect", "pnpm run provider:convex:preview", "pnpm run provider:eas:production"],
    files: ["packages/adapters/src/local-cloud.ts", "packages/adapters/src/provider-operations.ts", "packages/adapters/src/convex.ts", "packages/adapters/src/eas.ts"]
  },
  generated: {
    title: "Generated app contract",
    summary: "The generated app is intentionally small but structured: web, mobile, Convex, theme, UI, config, telemetry, domain, runtime, docs, skills, and manifest anchors. Add commands extend that shape through generated feature, event, and billing-plan anchors.",
    commands: ["create-agent-stack acme-crm", "agentstack add feature invoices --surfaces web,mobile --backend convex", "agentstack add billing-plan pro --entitlements feature.auditLog --seats 10"],
    files: ["templates/b2b-saas/agentstack.config.json", "templates/b2b-saas/docs/agentstack", "templates/b2b-saas/packages"]
  },
  telemetry: {
    title: "Telemetry and timeline inspection",
    summary: "Telemetry is local and redacted today. The CLI writes/query JSONL events, supports timeline/query/trace/journey/errors/webhook/component/compare views, and can write an OTLP-shaped JSON export artifact for handoff.",
    commands: ["agentstack observe timeline --env preview --journey deployment", "agentstack observe export --env preview --format otlp-json"],
    files: ["packages/telemetry/src/store.ts", "packages/telemetry/src/otlp.ts", "templates/b2b-saas/docs/agentstack/observability.md"]
  },
  gaps: {
    title: "Current progress and gaps",
    summary: "The slice proves the command contract and provider boundaries. Provider execution is explicit through provider inspect/apply: Clerk and Convex inspect are diagnostics, Convex apply executes provider commands, Vercel preview apply runs only the preview deploy command, and EAS preview inspect runs only env:list for preview. Generated deploy rehearsals, EAS builds, env mutations, real app servers, hosted/network telemetry export, provider dashboards, retention, live Stripe integration, and store submission flows are outside the current generated framework boundary.",
    commands: ["pnpm run preview:deploy", "pnpm run preview:deploy:apply", "pnpm run prod:deploy"],
    files: ["README.md", "tests/e2e/prototype.test.ts", "templates/b2b-saas/docs/agentstack/release.md"]
  }
};

function renderConcern(key) {
  const target = document.querySelector("[data-concern-output]");
  if (!target || !concerns[key]) return;
  const concern = concerns[key];
  target.innerHTML = `
    <h3>${concern.title}</h3>
    <p>${concern.summary}</p>
    <h4>Commands to recognize</h4>
    <div class="pill-row">${concern.commands.map((command) => `<span class="pill"><code>${command}</code></span>`).join("")}</div>
    <h4>Evidence anchors</h4>
    <div class="pill-row">${concern.files.map((file) => `<span class="pill">${file}</span>`).join("")}</div>
  `;
}

const concernButtons = document.querySelectorAll("[data-concern]");
for (const button of concernButtons) {
  button.addEventListener("click", () => {
    for (const current of concernButtons) current.classList.remove("active");
    button.classList.add("active");
    renderConcern(button.dataset.concern);
  });
}

if (concernButtons.length > 0) {
  concernButtons[0].classList.add("active");
  renderConcern(concernButtons[0].dataset.concern);
}
