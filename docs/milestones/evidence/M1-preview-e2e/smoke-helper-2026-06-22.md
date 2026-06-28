# M1 Smoke Helper Evidence Support - 2026-06-22

## Scope

Local generated helper smoke only. No real provider resources were created, linked, adopted, inspected, mutated, deployed, or claimed as M1 Auth/Data evidence.

## App

- Path: `tmp/m1-smoke-helper`
- Template: local `create-agent-stack` B2B SaaS template
- CLI: source checkout under `<agentstack-repo>`

## Commands

```bash
cd <agentstack-repo>/tmp
<agentstack-repo>/node_modules/.bin/tsx \
  <agentstack-repo>/packages/create-agent-stack/src/bin.ts \
  m1-smoke-helper
```

Output:

```text
Created m1-smoke-helper
```

A synthetic post-sign-in DOM snapshot was written to `.agentstack/m1-preview-dom.html` with:

```text
data-agentstack-auth-state="signed-in"
data-agentstack-protected-data-state="protected-data-loaded"
data-agentstack-protected-workspace-id="<synthetic id>"
```

Then the generated helper was run with a synthetic Vercel-shaped URL:

```bash
pnpm run m1:preview:smoke -- --url https://m1-smoke-helper-git-m1.vercel.app --dom-file .agentstack/m1-preview-dom.html
```

Output:

```text
PASS m1 preview smoke
Evidence: m1-preview-smoke
Deploy URL: https://m1-smoke-helper-git-m1.vercel.app/
Auth state: signed-in
Protected data state: protected-data-loaded
Workspace id: present (redacted)
Wrote: .../docs/milestones/evidence/M1-preview-e2e/deploy-url.txt
Wrote: .../docs/milestones/evidence/M1-preview-e2e/smoke-output.txt
```

Generated `smoke-output.txt` contained:

```text
Result: PASS
Deploy URL: https://m1-smoke-helper-git-m1.vercel.app/
Auth state: signed-in
Protected data state: protected-data-loaded
Workspace id: present (redacted)
Raw DOM snapshots, provider identifiers, cookies, and tokens are not stored in this evidence file.
```

A search of generated evidence output found the synthetic workspace id only absent from redacted evidence files.

## Result

PASS for local smoke-helper behavior. Generated projects now include `pnpm run m1:preview:smoke`, which can turn a temporary signed-in DOM snapshot into redacted `deploy-url.txt` and `smoke-output.txt` files for the M1 evidence bundle.

This does not satisfy the M1 Deploy, Auth, Data, or Evidence checkboxes because the smoke used a synthetic DOM snapshot and synthetic Vercel-shaped URL. Those checkboxes remain unchecked until the helper is run against a real deployed preview URL after real Clerk sign-in and a successful protected Convex query.

## Next Smallest Step

Record real preview Clerk, Convex, and Vercel rows with `provider:ledger:record`, then connect/deploy and run `m1:preview:smoke` against the real deployed URL.
