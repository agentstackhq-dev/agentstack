# Agentstack Preview Deploy Rehearsal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the deploy placeholder with a deterministic local preview deploy rehearsal that agents can plan, apply, validate, and inspect without real provider APIs.

**Architecture:** The local-cloud adapter owns deploy planning and local artifact writes. The CLI owns command parsing, local validation gating, diagnostic output, and command telemetry. Generated templates and docs describe the workflow as a local preview rehearsal, not a real Convex, Clerk, Vercel, EAS, Stripe, or telemetry-provider deployment.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, local JSON state under `.agentstack`, generated B2B SaaS template docs, static spin-up HTML.

---

## File Map

- Modify `packages/adapters/src/types.ts`: add deploy plan types and adapter method.
- Modify `packages/adapters/src/local-cloud.ts`: implement local deploy plan/apply, write `.agentstack/deployments/<env>.json` on apply.
- Modify `packages/adapters/src/local-cloud.test.ts`: prove deploy planning, apply artifact, idempotence, and stale-service behavior.
- Modify `packages/cli/src/run.ts`: replace `deploy.not-implemented` with `PLAN deploy <env>` / `APPLIED deploy <env>`, local gate, adapter call, and telemetry.
- Modify `packages/cli/src/run.test.ts`: prove deploy plan/apply, local-failure blocking, artifact writes, and deployment telemetry.
- Modify `tests/e2e/prototype.test.ts`: extend generated workflow through deploy plan/apply and deployment timeline.
- Modify both template mirrors under `templates/b2b-saas` and `packages/create-agent-stack/templates/b2b-saas`: add preview scripts, `docs/agentstack/preview.md`, and accurate local-cloud wording.
- Modify `README.md` and `docs/spinup-site/*.html`: update human-facing progress and workflow docs.

## Task 1: Adapter Deploy Lifecycle

**Files:**
- Modify: `packages/adapters/src/types.ts`
- Modify: `packages/adapters/src/local-cloud.ts`
- Test: `packages/adapters/src/local-cloud.test.ts`

- [ ] **Step 1: Add failing adapter tests**

Add tests that assert:

```ts
const plan = await adapter.deploy(createDefaultManifest("acme-crm"), "preview", { apply: false });
expect(plan.applied).toBe(false);
expect(plan.steps.map((step) => `${step.status} ${step.action} ${step.environment}.${step.service}`)).toContain(
  "planned release preview.vercel"
);
await expect(stat(join(dir, ".agentstack", "deployments", "preview.json"))).rejects.toMatchObject({ code: "ENOENT" });
```

Also test `apply: true` writes `.agentstack/deployments/preview.json`, links missing services through existing local-cloud state, and repeated apply does not duplicate services.

- [ ] **Step 2: Verify adapter tests fail**

Run:

```bash
pnpm vitest run packages/adapters/src/local-cloud.test.ts
```

Expected: FAIL because `adapter.deploy` and deploy types do not exist.

- [ ] **Step 3: Implement deploy types and adapter behavior**

Add deploy types:

```ts
export type DeployOptions = {
  apply: boolean;
};

export type DeployStep = {
  action: "sync" | "release";
  environment: EnvironmentName;
  service: ServiceName | string;
  status: "planned" | "applied";
};

export type DeployPlan = {
  environment: EnvironmentName;
  steps: DeployStep[];
  applied: boolean;
  artifactPath?: string;
};
```

Implement `LocalCloudAdapter.deploy()` by inspecting state, building sync steps from `plan(report).changes`, adding release steps for expected services, applying sync changes when requested, and writing a secret-free artifact only on apply.

- [ ] **Step 4: Verify adapter tests pass**

Run:

```bash
pnpm vitest run packages/adapters/src/local-cloud.test.ts
```

Expected: PASS.

## Task 2: CLI Deploy Plan/Apply

**Files:**
- Modify: `packages/cli/src/run.ts`
- Modify: `packages/cli/src/run.test.ts`

- [ ] **Step 1: Add failing CLI tests**

Replace the placeholder deploy test with tests asserting:

```ts
expect(await runAgentstack(["deploy", "--env", "preview"], { cwd: dir, write })).toBe(0);
expect(output).toContain("PLAN deploy preview");
await expect(stat(join(dir, ".agentstack", "deployments", "preview.json"))).rejects.toMatchObject({ code: "ENOENT" });
```

and:

```ts
expect(await runAgentstack(["deploy", "--env", "preview", "--apply"], { cwd: dir, write })).toBe(0);
expect(output).toContain("APPLIED deploy preview");
await expect(readFile(join(dir, ".agentstack", "deployments", "preview.json"), "utf8")).resolves.toContain('"environment": "preview"');
```

Keep the existing source-secret deploy blocker test and add deployment telemetry assertion via `observe timeline --env preview --journey deployment`.

- [ ] **Step 2: Verify CLI tests fail**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts
```

Expected: FAIL because deploy still returns `deploy.not-implemented`.

- [ ] **Step 3: Implement CLI deploy lifecycle**

Update `deployCommand` so after the local validation gate passes it calls:

```ts
const deployPlan = await new LocalCloudAdapter(io.cwd).deploy(context.manifest, environment, {
  apply: Boolean(options.apply)
});
```

Print `PLAN deploy preview` or `APPLIED deploy preview`, then each deploy step as `- planned sync link preview.convex` or `- applied release preview.vercel`. Record `agentstack.deploy.completed` with journey `deployment`, `applied`, `steps`, and service names.

- [ ] **Step 4: Verify CLI tests pass**

Run:

```bash
pnpm vitest run packages/cli/src/run.test.ts
```

Expected: PASS.

## Task 3: Generated Preview Runbook

**Files:**
- Modify: `templates/b2b-saas/package.json`
- Modify: `packages/create-agent-stack/templates/b2b-saas/package.json`
- Modify: `templates/b2b-saas/AGENTS.md`
- Modify: `packages/create-agent-stack/templates/b2b-saas/AGENTS.md`
- Create: `templates/b2b-saas/docs/agentstack/preview.md`
- Create: `packages/create-agent-stack/templates/b2b-saas/docs/agentstack/preview.md`
- Modify related generated docs: `.env.example`, `docs/agentstack/local-development.md`, `docs/agentstack/validation.md`, `docs/agentstack/release.md`, `docs/agentstack/workflows.md`

- [ ] **Step 1: Add failing template expectations**

Update generator/e2e tests to expect `docs/agentstack/preview.md` and preview scripts:

```ts
expect(packageJson.scripts["preview:deploy"]).toBe("node scripts/agentstack.mjs deploy --env preview");
expect(packageJson.scripts["preview:deploy:apply"]).toBe("node scripts/agentstack.mjs deploy --env preview --apply");
await expect(readFile(join(appDir, "docs/agentstack/preview.md"), "utf8")).resolves.toContain("local preview deploy rehearsal");
```

- [ ] **Step 2: Verify generated-template tests fail**

Run:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts tests/e2e/prototype.test.ts
```

Expected: FAIL because preview scripts/docs are absent.

- [ ] **Step 3: Update both template mirrors**

Add scripts:

```json
"preview:plan": "node scripts/agentstack.mjs sync --env preview",
"preview:apply": "node scripts/agentstack.mjs sync --env preview --apply",
"preview:validate": "node scripts/agentstack.mjs validate --cloud --env preview",
"preview:deploy": "node scripts/agentstack.mjs deploy --env preview",
"preview:deploy:apply": "node scripts/agentstack.mjs deploy --env preview --apply"
```

Add `docs/agentstack/preview.md` with exact commands, expected outputs, files written, and non-goals. Keep every wording claim local-cloud scoped.

- [ ] **Step 4: Verify template tests pass**

Run:

```bash
pnpm vitest run packages/create-agent-stack/src/generate.test.ts tests/e2e/prototype.test.ts
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
```

Expected: PASS and no diff output.

## Task 4: Human Docs And Spin-Up Site

**Files:**
- Modify: `README.md`
- Modify: `docs/spinup-site/workflows.html`
- Modify: `docs/spinup-site/generated-app.html`
- Modify: `docs/spinup-site/guardrails.html`
- Modify: `docs/spinup-site/architecture.html`
- Modify: `docs/spinup-site/timeline.html`
- Modify: `docs/spinup-site/lab.html`

- [ ] **Step 1: Update docs after behavior is green**

Describe the slice as local preview deploy rehearsal. Mention `PLAN deploy preview`, `APPLIED deploy preview`, `.agentstack/deployments/preview.json`, and `agentstack.deploy.completed` telemetry. Do not claim real provider deployment.

- [ ] **Step 2: Verify docs and links**

Run:

```bash
python3 - <<'PY'
from html.parser import HTMLParser
from pathlib import Path
root = Path('docs/spinup-site')
class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]
    def handle_starttag(self, tag, attrs):
        if tag in {'a','link','script'}:
            d=dict(attrs); v=d.get('href') or d.get('src')
            if v: self.links.append(v)
errors=[]
for path in sorted(root.glob('*.html')):
    p=P(); p.feed(path.read_text())
    for href in p.links:
        if href.startswith(('http://','https://','#','mailto:')): continue
        target=(path.parent / href.split('#')[0]).resolve()
        if href.split('#')[0] and not target.exists(): errors.append(f'{path}: missing {href}')
if errors:
    print('\n'.join(errors)); raise SystemExit(1)
print('spinup links ok')
PY
```

Expected: `spinup links ok`.

## Final Verification

Run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
git diff --check
```

Expected:
- install exits 0 with lockfile unchanged;
- typecheck exits 0;
- tests exit 0;
- template mirror diff has no output;
- diff check has no output.

## Self-Review

- Spec coverage: implements first prototype item 7 as a local preview deploy rehearsal, with real provider deployment explicitly out of scope.
- Placeholder scan: no `TBD`, `TODO`, or undocumented future behavior in implementation tasks.
- Type consistency: deploy types are introduced in adapters and consumed by CLI tests and command output.
