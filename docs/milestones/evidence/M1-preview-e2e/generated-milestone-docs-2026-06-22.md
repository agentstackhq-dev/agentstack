# M1 Generated Milestone Docs Support - 2026-06-22

## Scope

Local generated documentation check only. No real provider resources were created, linked, adopted, inspected, mutated, deployed, or claimed as M1 evidence.

## App

- Path: `tmp/m1-generated-milestone`
- Template: local `create-agent-stack` B2B SaaS template
- CLI: source checkout under `<agentstack-repo>`

## Commands

```bash
cd <agentstack-repo>/tmp
<agentstack-repo>/node_modules/.bin/tsx \
  <agentstack-repo>/packages/create-agent-stack/src/bin.ts \
  m1-generated-milestone
```

Output:

```text
Created m1-generated-milestone
```

Generated docs inspected:

```text
docs/validation-hypothesis.md
docs/milestones/M1-preview-e2e.md
AGENTS.md
```

The generated milestone card includes:

```text
- [x] Generate
- [ ] Ledger
- [ ] Connect
- [ ] Deploy
- [ ] Auth
- [ ] Data
- [ ] Evidence
provider:ledger:record
m1:preview:smoke
Do not check Auth/Data from local placeholder output
```

Generated `AGENTS.md` now tells coding agents to read `docs/validation-hypothesis.md` and `docs/milestones/M1-preview-e2e.md` before coding or touching providers.

## Result

PASS for generated milestone-doc support. A freshly generated app now carries its own M1 validation hypothesis and active milestone checklist, so the live preview attempt can be driven from generated docs instead of relying on the framework repo's milestone card.

This does not satisfy the M1 Ledger, Connect, Deploy, Auth, Data, or Evidence checkboxes. They remain unchecked until real preview resources are recorded, connected, deployed, smoked, and evidenced.

## Next Smallest Step

Record real preview Clerk, Convex, and Vercel rows with `provider:ledger:record`, then run the generated M1 checklist from the generated app.
