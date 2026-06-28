# M1 Evidence Scaffold Support - 2026-06-22

## Scope

Local generated evidence scaffold check only. No real provider resources were created, linked, adopted, inspected, mutated, deployed, or claimed as M1 evidence.

## App

- Path: `tmp/m1-evidence-scaffold`
- Template: local `create-agent-stack` B2B SaaS template
- CLI: source checkout under `<agentstack-repo>`

## Commands

```bash
cd <agentstack-repo>/tmp
<agentstack-repo>/node_modules/.bin/tsx \
  <agentstack-repo>/packages/create-agent-stack/src/bin.ts \
  m1-evidence-scaffold
```

Output:

```text
Created m1-evidence-scaffold
```

Generated evidence files:

```text
docs/milestones/evidence/M1-preview-e2e/.gitkeep
docs/milestones/evidence/M1-preview-e2e/README.md
```

The generated README documents:

```text
provider-ledger-<yyyy-mm-dd>.md
deploy-url.txt
smoke-output.txt
Do not commit raw DOM snapshots
Do not store raw API keys, Clerk secrets, Convex deploy keys, Vercel tokens, cookies, or session values.
```

## Result

PASS for local evidence scaffold support. Generated projects now carry the M1 evidence directory and redaction rules before any live provider work starts.

This does not satisfy the M1 Evidence checkbox. That checkbox remains unchecked until real deployed preview evidence is recorded under the scaffolded path.

## Next Smallest Step

Record real preview Clerk, Convex, and Vercel rows with `provider:ledger:record`, then connect/deploy and populate the scaffolded evidence files from the real preview run.
