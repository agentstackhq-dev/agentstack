const page = document.body.dataset.page;
for (const link of document.querySelectorAll(".nav a")) {
  if (link.dataset.page === page) {
    link.classList.add("active");
  }
}

const scenarios = {
  lifecycleInspector: {
    title: "Lean happy path preflight",
    command: "pnpm run validate && pnpm run dev:check",
    result: "PASS validate / PASS dev check web",
    detail: "Validate checks the typed config and generated app boundary. Dev check verifies the web start path without running a long-lived server.",
    files: ["packages/core/src/validation.ts", "packages/cli/src/run.ts", "templates/b2b-saas/package.json"]
  },
  missingAnchor: {
    title: "Generated anchor removed",
    command: "pnpm run validate",
    result: "FAIL template.anchor.missing",
    detail: "If a required file such as agentstack.config.ts, apps/web/package.json, apps/convex/package.json, or pnpm-workspace.yaml is missing or is a directory, validation blocks before provider work.",
    files: ["packages/core/src/validation.ts", "packages/cli/src/run.ts", "packages/cli/src/run.test.ts"]
  },
  envValues: {
    title: "Preview environment inspection",
    command: "pnpm run env:inspect",
    result: "PASS env inspect preview",
    detail: "Environment inspection reads the typed config and local .agentstack state without mutating providers. Missing local values remain agent-readable diagnostics.",
    files: ["packages/core/src/env-graph.ts", "packages/cli/src/context.ts", "templates/b2b-saas/.gitignore"]
  },
  providerEnvResources: {
    title: "Preview local rehearsal",
    command: "pnpm run preview:sync",
    result: "APPLIED local rehearsal preview / Scope: ignored .agentstack state only; no live provider mutation",
    detail: "Preview sync is deliberately local. It updates ignored .agentstack rehearsal state and does not mutate Clerk, Convex, Vercel, or EAS.",
    files: ["packages/adapters/src/local-cloud.ts", "packages/cli/src/run.ts", "tests/e2e/prototype.test.ts"]
  },
  staleCloud: {
    title: "Preview live confirmation gate",
    command: "pnpm run preview:up",
    result: "FAIL preview.up.confirmation-required",
    detail: "The live preview path refuses to mutate providers unless --confirm-live-mutation is passed through the package script.",
    files: ["packages/cli/src/run.ts", "packages/cli/src/run.test.ts", "templates/b2b-saas/package.json"]
  },
  themeDrift: {
    title: "Stale binary repair",
    command: "which agentstack && agentstack --help",
    result: "Help must show create",
    detail: "If help does not show create, the visible binary is stale or points at @agentstack/cli instead of the agentstack facade package. The local quickstart documents symlink cleanup.",
    files: ["docs/references/local-quickstart.md", "packages/agentstack/src/bin.ts", "tests/e2e/prototype.test.ts"]
  },
  previewDeploy: {
    title: "Live preview happy path",
    command: "pnpm run preview:up -- --confirm-live-mutation",
    result: "provider bootstrap -> provider link -> auth user -> preview deploy",
    detail: "Preview up runs the package-owned live sequence in order and stops at exact provider auth or browser handoffs when needed.",
    files: ["packages/cli/src/run.ts", "packages/cli/src/m2-live.ts", "templates/b2b-saas/package.json"]
  },
  productionRelease: {
    title: "M4 local pack passed",
    command: "Read docs/milestones/M4-clean-machine-smoke.md",
    result: "Status: complete",
    detail: "The local packed-package smoke passed without public npm publication. Public release automation remains a later approach discussion.",
    files: ["docs/milestones/M4-clean-machine-smoke.md", "docs/README.md", "README.md"]
  },
  mobileBuild: {
    title: "Mobile anchors present",
    command: "pnpm run validate",
    result: "PASS validate",
    detail: "Mobile is part of the generated lean root, but live mobile build execution is outside M3. Keep Expo/EAS anchors in apps/mobile for later milestones.",
    files: ["templates/b2b-saas/apps/mobile/app.config.ts", "templates/b2b-saas/apps/mobile/eas.json", "templates/b2b-saas/apps/mobile/src/App.tsx"]
  },
  telemetry: {
    title: "Evidence check",
    command: "pnpm run evidence:check",
    result: "PASS evidence check",
    detail: "Evidence checks are package-owned and read ignored .agentstack artifacts. Generated apps should not carry copied runbooks or evidence source files.",
    files: ["packages/cli/src/run.ts", "docs/milestones/M3-billing-webhook.md", "templates/b2b-saas/package.json"]
  },
  observabilityInspection: {
    title: "Current source of truth",
    command: "Read README.md, docs/README.md, and milestones",
    result: "Use milestone docs before historical spinup pages",
    detail: "This site includes older prototype deep dives. The docs index and milestone cards decide which commands are current.",
    files: ["README.md", "docs/README.md", "docs/milestones/README.md"]
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
    summary: "The repo is split into framework packages plus a lean B2B SaaS template. Core owns contracts and diagnostics; the CLI composes commands; adapters model provider boundaries; telemetry stores/query events; the agentstack facade owns creation.",
    commands: ["pnpm typecheck", "pnpm test"],
    files: [
      "packages/core/src/manifest.ts",
      "packages/cli/src/run.ts",
      "packages/adapters/src/types.ts",
      "packages/telemetry/src/events.ts",
      "packages/agentstack/src/create/generate.ts"
    ]
  },
  workflow: {
    title: "Workflow orchestration",
    summary: "Generated apps expose scripts that route through the installed agentstack binary. Local source testing passes --package-spec link:<agentstack-repo>/packages/agentstack instead of copying scripts into the app.",
    commands: ["pnpm run validate", "pnpm run dev:check", "pnpm run preview:sync", "pnpm run preview:up -- --confirm-live-mutation"],
    files: ["templates/b2b-saas/package.json", "templates/b2b-saas/agentstack.config.ts", "packages/cli/src/context.ts"]
  },
  providers: {
    title: "Env and provider orchestration",
    summary: "Provider work is explicit by evidence tier. Local preview sync updates ignored .agentstack state only. Live preview up requires confirmation and runs package-owned bootstrap, link, auth fixture, and deploy steps against Clerk, Convex, and Vercel.",
    commands: ["pnpm run env:inspect", "pnpm run preview:sync", "pnpm run preview:up -- --confirm-live-mutation"],
    files: ["packages/adapters/src/local-cloud.ts", "packages/cli/src/m2-live.ts", "packages/cli/src/run.ts"]
  },
  generated: {
    title: "Generated app contract",
    summary: "The generated app is intentionally lean: apps/web, apps/mobile, apps/convex, typed config, root guidance, package scripts, and ignored .agentstack state. The installed agentstack package owns provider glue, diagnostics, evidence, and docs/help.",
    commands: ["agentstack create acme-crm", "pnpm run validate", "pnpm run preview:up -- --confirm-live-mutation"],
    files: ["templates/b2b-saas/agentstack.config.ts", "templates/b2b-saas/apps", "templates/b2b-saas/package.json"]
  },
  telemetry: {
    title: "Telemetry and timeline inspection",
    summary: "Telemetry remains package-owned and redacted. Generated consumer apps should not receive copied telemetry packages or docs unless a later milestone deliberately adds that surface.",
    commands: ["agentstack observe timeline --env preview --journey deployment", "agentstack observe export --env preview --format otlp-json"],
    files: ["packages/telemetry/src/store.ts", "packages/telemetry/src/otlp.ts", "packages/cli/src/run.ts"]
  },
  gaps: {
    title: "Current progress and gaps",
    summary: "M1, M2, M3, and M4 have evidence. M4 proved local tarball installability; public npm publication, release automation, and hosted control-plane work remain locked until the next approach discussion.",
    commands: ["corepack pnpm run m4:pack:smoke", "pnpm run validate", "pnpm run preview:up -- --confirm-live-mutation"],
    files: ["README.md", "docs/milestones/M4-clean-machine-smoke.md", "tests/e2e/prototype.test.ts"]
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
