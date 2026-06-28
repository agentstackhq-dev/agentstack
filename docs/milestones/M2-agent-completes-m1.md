# M2: Agent Completes Lean Agentstack Preview

Status: **locked** (unlock after the lean generated-surface correction is implemented and verified)

## Product correction

M1 proved that Agentstack can make real contact with Clerk, Convex, and Vercel, but it also exposed the wrong consumer shape. The generated app must not contain copied framework internals, generated runbooks, provider ledgers, or M1 scripts.

Agentstack is a package dependency and CLI. The generated app is an app that uses Agentstack.

## Hypothesis under test

A fresh coding agent can take an ultra-lean generated app from zero to preview using only:

- root `AGENTS.md`
- root `agentstack.config.ts`
- package scripts that call the installed `agentstack` CLI
- package-owned Agentstack docs/help rendered on demand by CLI commands
- provider CLI auth handoffs when the provider requires login or account selection

No copied `docs/`, copied `scripts/`, generated skills, generated provider ledger source files, or generated framework runbooks may be required inside the consumer app.

## Required generated surface

`create-agent-stack` must generate a root surface that is intentionally small:

```text
apps/mobile
apps/web
apps/convex
agentstack.config.ts
AGENTS.md
.gitignore
package.json
```

Package-manager lockfiles may appear after install, but Agentstack must not use generated root clutter as a substitute for package-owned framework behavior.

## Typed config contract

`agentstack.config.ts` is mandatory. JSON config is not acceptable for M2.

The config must be fully typed and schema-driven from the installed Agentstack package, for example:

```ts
import { defineAgentstackConfig } from "agentstack/config";

export default defineAgentstackConfig({
  // app, surfaces, providers, environments
});
```

The same schema must drive:

- TypeScript feedback in the config file
- `agentstack validate`
- provider bootstrap/link/deploy commands
- structured diagnostics for coding agents
- generated fix suggestions

Diagnostics must point to stable schema paths such as `providers.clerk.preview` or `surfaces.web.env`, include a concise reason, and state the smallest next edit or command.

## Package-owned guidance contract

`AGENTS.md` is the only generated guidance file in the consumer app. It should point agents to package commands, not duplicate runbooks.

Deeper guidance must come from the installed package, for example:

- `agentstack help`
- `agentstack docs <topic>`
- `agentstack explain <diagnostic-code>`
- `agentstack provider bootstrap --help`

This prevents stale generated information. Updating Agentstack updates framework guidance without regenerating or patching every app.

## Hidden state contract

Agentstack may write ignored local state under `.agentstack/` for provider links, evidence, auth fixtures, ledgers, deploy metadata, and browser smoke artifacts.

That state is runtime/evidence state, not generated source. It must be ignored by default and must not become the app's framework documentation layer.

## Done when

- [ ] `create-agent-stack` generates the required lean root surface with `agentstack.config.ts`, not `agentstack.config.json`
- [ ] `package.json` depends on the local/published Agentstack package and scripts invoke `agentstack`, not copied `scripts/*.mjs`
- [ ] Generated app root contains no `docs/`, `scripts/`, `skills/`, root `convex/`, `vercel.json`, provider ledger source file, or copied M1 runbook
- [ ] `agentstack.config.ts` imports a typed schema helper from the package and typechecks in the generated app
- [ ] `agentstack validate` validates the typed config through the package schema and emits agent-actionable diagnostics
- [ ] A fresh agent completes preview bootstrap, link, deploy, auth fixture, smoke, and evidence through package-owned CLI commands from the lean app
- [ ] M2 evidence is recorded in this Agentstack framework repo, not as generated consumer-app docs
- [ ] Friction log records every human/provider intervention and every place package-owned guidance was insufficient

## Failure conditions

M2 fails if any of these are required for the fresh-agent preview path:

- copied generated runbooks or docs inside the consumer app
- copied generated M1 scripts inside the consumer app
- JSON config or untyped config
- manual dashboard setup beyond provider auth/account-selection handoffs
- agent inference from stale generated text instead of package-owned CLI/schema feedback

## Not this milestone

- Production
- Billing or entitlements
- Hosted control plane
- Broad provider matrix expansion beyond the preview path needed to prove the corrected contract

## Unlock condition

M2 unlocks only after a dedicated correction slice replaces the current generated-app shape with the lean package-driven contract above and verifies that a generated app can run local validation through the installed Agentstack package.
