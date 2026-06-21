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
- Prefer preview and dev resources before production resources.
- Never record secrets, raw tokens, credentials, private keys, or similarly sensitive values.
- Record exact CLI or API commands in notes only when they do not include sensitive values.
- Production resources require an explicit reason in the purpose or notes field.
- Cleanup must be verified, and the ledger must be updated with cleanup status, cleaned at, procedure, and evidence.
- If a resource cannot be deleted, mark it abandoned-with-reason and record the owner, reason, and next review date.

## Ledger

No real provider resources have been recorded yet.

| id | provider | resource type | environment | owner account/project | name | external id/url | purpose | created by | created at | expected cleanup trigger/date | current status | cleanup command/procedure | cleaned at | evidence link/path | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
