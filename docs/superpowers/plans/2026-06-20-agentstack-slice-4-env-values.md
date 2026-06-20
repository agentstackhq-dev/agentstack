# Agentstack Slice 4 Env Value Management Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe command-based local custom environment value management so agents do not hand-edit `.agentstack/env-values.json`.

**Architecture:** Keep the manifest as the declaration source and `.agentstack/env-values.json` as the local value store. The CLI validates environment, surface, declaration scope, and enum values before writing. `env inspect` reports whether each declared binding is present without exposing secret values.

**Command Contract:**

```bash
agentstack env set --env preview --surface convex --name STRIPE_MODE --value sandbox
agentstack env inspect --env preview
```

`env set` must fail for undeclared variables, out-of-scope surfaces/environments, invalid enum values, and missing option values.

## Definition Of Done

- `pnpm typecheck` passes.
- `pnpm test` passes.
- `diff -qr templates/b2b-saas packages/create-agent-stack/templates/b2b-saas` has no output.
- E2E or CLI tests prove setting a required value lets `validate` pass and secret output is redacted.
