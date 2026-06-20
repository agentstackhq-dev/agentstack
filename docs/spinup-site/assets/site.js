const page = document.body.dataset.page;
for (const link of document.querySelectorAll(".nav a")) {
  if (link.dataset.page === page) {
    link.classList.add("active");
  }
}

const scenarios = {
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
  previewDeploy: {
    title: "Preview deploy rehearsal",
    command: "pnpm run preview:deploy && pnpm run preview:deploy:apply",
    result: "PLAN deploy preview / APPLIED deploy preview",
    detail: "The deploy rehearsal is local-only. Plan does not write a deployment artifact. Apply writes .agentstack/deployments/preview.json and records agentstack.deploy.completed telemetry without calling real provider APIs.",
    files: ["templates/b2b-saas/docs/agentstack/preview.md", "packages/cli/src/run.ts", "tests/e2e/prototype.test.ts"]
  },
  telemetry: {
    title: "Inspect a validation journey",
    command: "agentstack observe timeline --env preview --journey validation",
    result: "PASS observe timeline 2",
    detail: "JSONL telemetry events are filtered into chronological timelines by environment, surface, event, trace, correlation, or journey. State is redacted before output, so email/token-like fields are safe to inspect.",
    files: ["packages/telemetry/src/events.ts", "packages/telemetry/src/store.ts", "packages/cli/src/run.ts"]
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
