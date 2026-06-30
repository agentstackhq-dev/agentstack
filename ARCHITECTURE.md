# Architecture

Last reviewed: 2026-06-30

## System Overview

Agentstack is a package-owned control layer around a lean generated SaaS app. The framework package provides the CLI,
typed configuration schema, validation, provider orchestration, smoke/evidence commands, and agent guidance. The
generated app contains product surfaces and typed config only.

The current proven path is preview-focused:

```text
agentstack create
  -> lean generated app
  -> provider bootstrap/link
  -> preview deploy
  -> Clerk auth fixture
  -> protected Convex smoke
  -> Clerk Billing webhook entitlement smoke
  -> redacted framework-repo evidence
```

M1 proved provider contact with a heavier generated surface. M2 corrected the product boundary to a lean generated app
driven by the installed package. M3 proved the next SaaS spine: real Clerk Billing webhook delivery to a Convex HTTP
action and a gated `feature.auditLog` web path. M4 proved local packed-package installability. M5 proved public npm beta
publishability for `@agentstackhq/agentstack` with the `agentstack` CLI binary.

## Package Boundaries

| Package | Responsibility |
| --- | --- |
| `packages/agentstack` | Public `@agentstackhq/agentstack` package facade, `agentstack` bin, `@agentstackhq/agentstack/config` export, create command routing |
| `packages/cli` | Command implementation for validation, provider lifecycle, M2 live preview, M3 billing, telemetry inspection, and local quality gates |
| `packages/core` | Zod manifest schema, diagnostics, local validation, env graph, release policy, theme and generated-boundary contracts |
| `packages/adapters` | Provider command plans, provider proof contracts, provider executor abstraction, provider resource ledger parsing/writes |
| `packages/telemetry` | Local wide-event JSONL store, telemetry inspection, and OTLP-shaped local export transforms |

The root `templates/b2b-saas/` mirror must stay byte-for-byte aligned with
`packages/agentstack/templates/b2b-saas/`.

## Generated App Boundary

Generated app root:

```text
apps/mobile
apps/web
apps/convex
agentstack.config.ts
AGENTS.md
.gitignore
package.json
```

The generated app must not contain copied framework docs, copied framework scripts, generated skills, root `convex/`,
root `vercel.json`, generated provider ledgers, copied milestone runbooks, or package internals. Those belong in the
installed package or in ignored `.agentstack/` runtime/evidence state.

## Runtime Entry Points

Framework entry points:

- `packages/agentstack/src/bin.ts` routes `agentstack create` and delegates other commands to `@agentstackhq/cli`.
- `packages/cli/src/run.ts` is the main CLI dispatcher.
- `packages/cli/src/m2-live.ts` owns package-owned preview bootstrap/link/deploy/auth/smoke/evidence commands.
- `packages/cli/src/m3-billing.ts` owns Clerk Billing bootstrap, fixture, smoke, and M3 evidence commands.
- `packages/agentstack/src/create/generate.ts` copies the lean template and replaces app/package tokens.

Generated app runtime entry points:

- `apps/web/src/App.tsx` renders auth, protected Convex status, and the M3 entitlement markers used by smoke checks.
- `apps/convex/convex/http.ts` exposes the Clerk Billing webhook route.
- `apps/convex/convex/billing.ts` stores billing principals, webhook event evidence, and entitlement state.
- `apps/convex/convex/workspaceStatus.ts` provides the protected Convex data smoke path.
- `apps/mobile/src/App.tsx` currently carries a local mobile status surface; live mobile/EAS proof is not in M1-M3.

## Configuration Model

`agentstack.config.ts` is the typed source of truth. It imports:

```ts
import { defineAgentstackConfig } from "@agentstackhq/agentstack/config";
```

The schema lives in `packages/core/src/manifest.ts` and currently covers:

- app identity and slug
- environments: `development`, `preview`, `production`
- surfaces: `web`, `mobile`, `convex`
- services: Clerk, Convex, Vercel, EAS
- custom env declarations and provider targets
- local telemetry policy and redaction policy
- Clerk Billing entitlements and Convex webhook delivery
- generated boundary anchors

JSON config is obsolete for the corrected path.

## Provider And Evidence Model

Provider work is explicit and evidence-labeled:

- `local-structure` and `local-quality` are local checks only.
- `provider-command-plan` prints provider CLI plans without execution.
- `live-read` performs bounded provider reads or diagnostics.
- `live-mutation` performs bounded provider mutations after explicit confirmation and ledger gates.

Real provider resources must be tracked in `docs/provider-resource-ledger.md`. Hidden generated-app files under
`.agentstack/` may hold provider links, deploy URLs, auth user state, Convex preview env files, billing fixture state,
smoke DOM captures, and generated-app evidence. Repository evidence under `docs/milestones/evidence/` must remain
redacted and must not contain secrets, cookies, smoke-user passwords, setup intent secrets, webhook signing secrets, or
raw provider stdout.

## Milestone State

| Milestone | Current architecture implication |
| --- | --- |
| M1 | Historical provider-path spike. Do not extend the generated-docs/generated-scripts surface it used. |
| M2 | Current generated app boundary. All consumer proof must use package-owned `agentstack` commands and generated package scripts. |
| M3 | Current SaaS runtime proof. Clerk Billing webhook state flows through Convex and gates `feature.auditLog` in web smoke. |
| M4 | Completed local packed-package installability proof. |
| M5 | Completed public npm beta publishability proof for `@agentstackhq/agentstack`. |

## Known Constraints And Risks

- Several older roadmap and superpowers planning docs describe the pre-M2 generated workspace shape. They are preserved
  as historical rationale, not current implementation instructions.
- The M3 live pass retained active Clerk, Convex, and Vercel test resources for post-M3 review. See the provider ledger
  before touching cleanup.
- M3 cleanup/revert is not fully validated. `billing:fixture delete` removes local/Convex fixture state, but active
  Clerk subscription/payment-source cleanup still requires provider review.
- Public npm registry installation is validated for `@agentstackhq/agentstack@0.1.0-beta.3`. New package publication
  must use the release workflow in `docs/releases/versioning-and-release-workflow.md`.
- Production provider readiness, hosted control plane, real OTel/network export, and EAS/mobile live proof remain
  outside the completed M1-M3 evidence.
