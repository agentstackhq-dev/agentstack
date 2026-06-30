# Provider Resource Ledger

## Purpose

This ledger tracks real external provider resources created for Agentstack integration testing, including resources in Clerk, Vercel, Convex, EAS, and similar providers.

Invariant: every external resource created for Agentstack testing must be recorded before or immediately after creation and updated through cleanup. There are no untracked provider resources.

## Status Taxonomy

| Status | Meaning |
| --- | --- |
| planned | Resource is expected but has not been created yet. |
| active | Resource exists and is still relevant for testing. |
| cleanup-pending | Resource is no longer needed and is waiting for verified cleanup. |
| cleaned | Resource was deleted, disabled, or otherwise cleaned up, and the cleanup was verified. |
| abandoned-with-reason | Resource cannot be deleted or cleaned up yet; owner, reason, and next review date are recorded. |

## Required Fields

| Field | Required content |
| --- | --- |
| id | Stable local ledger identifier. |
| provider | External provider name, such as Clerk, Vercel, Convex, or EAS. |
| resource type | Resource category, such as app, project, deployment, database, build, domain, or integration. |
| environment | Environment or scope, such as preview, dev, staging, production, or local-test. |
| owner account/project | Owning provider account, organization, workspace, or project. |
| name | Human-readable resource name. |
| external id/url | Provider resource identifier, dashboard URL, deployment URL, or API-visible ID. |
| purpose | Why this resource exists for Agentstack testing. |
| created by | Person or automation that created the resource. |
| created at | Creation timestamp or date. |
| expected cleanup trigger/date | Event or date that should trigger cleanup review. |
| current status | One of planned, active, cleanup-pending, cleaned, or abandoned-with-reason. |
| cleanup command/procedure | Exact cleanup procedure, with commands only when they contain no sensitive values. |
| cleaned at | Cleanup timestamp or date, if applicable. |
| evidence link/path | Link or local path proving creation, use, cleanup, or abandonment status. |
| notes | Extra context, non-sensitive command history, owner details, reason, or next review date. |

## Operational Rules

- No external provider resource may be created, used, or retained for Agentstack testing unless it is tracked in this ledger.
- Prefer `agentstack provider ledger record` for planned or active rows so the table shape is validated before provider link/apply commands.
- Use `agentstack provider ledger record --replace` only to replace the matching provider/environment/resource/name row after a planned `pending` row gets a real provider id or dashboard URL.
- Use `--write-evidence` when `--evidence` points to a local milestone evidence markdown file. The command writes a redacted evidence note under `docs/milestones/evidence/` without calling provider CLIs or writing telemetry.
- Prefer preview and dev resources before production resources.
- Never record secrets, raw tokens, credentials, private keys, or similarly sensitive values.
- Record exact CLI or API commands in notes only when they do not include sensitive values.
- Production resources require an explicit reason in the purpose or notes field.
- Cleanup must be verified, and the ledger must be updated with cleanup status, cleaned at, procedure, and evidence.
- If a resource cannot be deleted, mark it abandoned-with-reason and record the owner, reason, and next review date.

## Ledger

Real provider resource rows are intentionally not published in this repository. Public docs preserve the ledger schema and operational policy, while concrete provider account names, resource IDs, deployment URLs, cleanup commands, and account emails live only in private operational state.

Use `.agentstack/` or a private operator-owned ledger for live-provider runs. Public evidence should reference resources through redacted labels such as `<clerk-app-id>`, `<convex-deployment>`, and `<vercel-project-id>`.
