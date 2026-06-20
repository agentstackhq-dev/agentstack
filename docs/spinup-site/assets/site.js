const page = document.body.dataset.page;
for (const link of document.querySelectorAll(".nav a")) {
  if (link.dataset.page === page) {
    link.classList.add("active");
  }
}

const scenarios = {
  lifecycleInspector: {
    title: "Lifecycle preflight",
    command: "pnpm run inspect && pnpm run skills:inspect && pnpm run sync:preview:apply && pnpm run doctor && pnpm run dev",
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
    detail: "A required env declaration is satisfiable by .agentstack/env-values.json when it uses the environment -> surface -> variable -> string shape. Invalid JSON or wrong leaf types fail explicitly.",
    files: ["packages/core/src/env-graph.ts", "packages/cli/src/context.ts", "templates/b2b-saas/.gitignore"]
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
    result: "PLAN deploy preview / APPLIED deploy preview",
    detail: "The deploy rehearsal is local-only. Plan does not write a deployment artifact. Apply writes .agentstack/deployments/preview.json and records agentstack.deploy.completed telemetry without calling real provider APIs.",
    files: ["templates/b2b-saas/docs/agentstack/preview.md", "packages/cli/src/run.ts", "tests/e2e/prototype.test.ts"]
  },
  mobileBuild: {
    title: "Mobile build rehearsal",
    command: "pnpm run mobile:build:preview && pnpm run mobile:build:preview:apply",
    result: "PLAN mobile build preview / APPLIED mobile build preview",
    detail: "The mobile build rehearsal checks local validation and EAS readiness, then writes .agentstack/builds/mobile-preview.json only when apply is used. It records agentstack.mobile.build.completed without submitting a real EAS build.",
    files: ["packages/core/src/mobile-build.ts", "packages/cli/src/run.ts", "templates/b2b-saas/docs/agentstack/mobile.md"]
  },
  telemetry: {
    title: "Inspect a validation journey",
    command: "agentstack observe timeline --env preview --journey validation",
    result: "PASS observe timeline 2",
    detail: "JSONL telemetry events are filtered into chronological timelines by environment, surface, event, trace, correlation, or journey. State is redacted before output, and the prototype does not export to OTLP or a hosted provider.",
    files: ["packages/telemetry/src/events.ts", "packages/telemetry/src/store.ts", "packages/cli/src/run.ts"]
  },
  observabilityInspection: {
    title: "Narrow an incident from local events",
    command: "agentstack observe errors --env production --since 2h --group-by component",
    result: "PASS observe errors / grouped by component",
    detail: "Start broad with query or timeline, then pivot into trace, journey, errors, webhook, component, or compare. These commands inspect redacted .agentstack/events.jsonl evidence and are shaped for future adapters without claiming hosted telemetry today.",
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
