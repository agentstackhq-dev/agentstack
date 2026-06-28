# M1 Ledger Record Command Evidence — 2026-06-22

## Scope

Local command smoke only. No real provider resources were created, linked, adopted, inspected, mutated, or claimed as M1 ledger resources.

## App

- Path: `tmp/m1-ledger-record-smoke`
- Template: local `create-agent-stack` B2B SaaS template
- CLI: source checkout under `<agentstack-repo>`

## Commands

```bash
cd <agentstack-repo>/tmp
<agentstack-repo>/node_modules/.bin/tsx \
  <agentstack-repo>/packages/create-agent-stack/src/bin.ts \
  m1-ledger-record-smoke
```

Output:

```text
Created m1-ledger-record-smoke
```

```bash
AGENTSTACK_CLI_BIN=<agentstack-repo>/packages/cli/src/bin.ts \
AGENTSTACK_TSX_BIN=<agentstack-repo>/node_modules/.bin/tsx \
pnpm --dir <agentstack-repo>/tmp/m1-ledger-record-smoke \
  run provider:ledger:record -- \
  --service convex \
  --env preview \
  --resource-type deployment \
  --name m1-ledger-record-smoke-preview \
  --external-id pending \
  --owner local-ledger-smoke \
  --purpose "M1 local ledger command smoke only" \
  --created-by Codex \
  --created-at 2026-06-22 \
  --cleanup-trigger "scratch cleanup" \
  --cleanup "delete scratch row" \
  --evidence docs/milestones/evidence/M1-preview-e2e/ledger-record-command-2026-06-22.md
```

Output:

```text
RECORDED provider ledger convex preview
Evidence: provider-ledger-record
Resource: deployment m1-ledger-record-smoke-preview
Status: planned
Local mutation: docs/provider-resource-ledger.md
Provider mutation: none
Telemetry mutation: none
```

The scratch ledger row was written as:

```text
| convex-preview-deployment | convex | deployment | preview | local-ledger-smoke | m1-ledger-record-smoke-preview | pending | M1 local ledger command smoke only | Codex | 2026-06-22 | scratch cleanup | planned | delete scratch row |  | docs/milestones/evidence/M1-preview-e2e/ledger-record-command-2026-06-22.md |  |
```

```bash
AGENTSTACK_CLI_BIN=<agentstack-repo>/packages/cli/src/bin.ts \
AGENTSTACK_TSX_BIN=<agentstack-repo>/node_modules/.bin/tsx \
pnpm --dir <agentstack-repo>/tmp/m1-ledger-record-smoke run provider:convex:link:preview
```

Output:

```text
LINKED provider convex preview
Evidence: ledger-local-inventory
Local mutation: .agentstack/provider-links.json
Provider mutation: none
Ledger mutation: none
```

## Result

PASS for local ledger-record command behavior. The generated script can record a planned provider ledger row and the existing local provider link path can consume it without provider or telemetry mutation.

This does not satisfy the M1 Ledger checkbox because the row used `local-ledger-smoke` and `pending` for a scratch command smoke, not real preview Clerk, Convex, or Vercel resources.

## Next Smallest Step

Run `provider:ledger:record` for the real preview Clerk application, Convex deployment, and Vercel project rows with owner, purpose, cleanup, and evidence before any live provider command.
