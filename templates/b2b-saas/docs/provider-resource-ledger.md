# Provider Resource Ledger

## Purpose

This ledger is the generated project's source of truth for real external provider resources that Agentstack may inspect or mutate. Generated projects start with no real provider resources recorded. Add planned rows before supported provider apply commands, then keep active and cleanup rows current as resources are created, used, and removed.

Supported provider apply paths are ledger-gated. A matching row with current status `planned` or `active` is required before Agentstack may execute a supported live mutation.

## Status Taxonomy

| Status | Meaning |
| --- | --- |
| planned | Resource is expected but has not been created yet. |
| active | Resource exists and is still relevant for the project. |
| cleanup-pending | Resource is no longer needed and is waiting for verified cleanup. |
| cleaned | Resource was deleted, disabled, or otherwise cleaned up, and cleanup was verified. |
| abandoned-with-reason | Resource cannot be deleted or cleaned up yet; owner, reason, and next review date are recorded. |

Only `planned` and `active` rows can authorize supported provider apply commands. `cleanup-pending`, `cleaned`, and `abandoned-with-reason` rows block mutation until the row is replaced with a valid planned or active intent.

## Required Fields

| Field | Requirement |
| --- | --- |
| id | Stable ledger identifier, unique within this table. |
| provider | External service name, such as `clerk`, `convex`, `vercel`, or `eas`. |
| resource type | Provider resource category, such as `deployment`, `project`, `application`, `environment-variable`, or `build-profile`. |
| environment | Agentstack environment, such as `preview` or `production`. |
| owner account/project | Account, org, team, project, or tenant that owns the resource. Required for planned and active rows. |
| name | Provider resource name. For gated apply, this must match the expected resource name. |
| external id/url | Provider id, dashboard URL, or `pending` for not-yet-created planned resources. |
| purpose | Why the resource exists. Required for planned and active rows. |
| created by | Person or automation that created or will create the resource. Required for planned and active rows. |
| created at | Creation date, or planned creation date for planned rows. Required for planned and active rows. |
| expected cleanup trigger/date | Event or date that should trigger cleanup review. Required for planned and active rows. |
| current status | One of `planned`, `active`, `cleanup-pending`, `cleaned`, or `abandoned-with-reason`. |
| cleanup command/procedure | Exact cleanup procedure, with commands only when they contain no sensitive values. Required for planned and active rows. |
| cleaned at | Cleanup verification date when current status is `cleaned`; otherwise blank until cleanup completes. |
| evidence link/path | Link or local path proving creation, use, cleanup, or abandonment status. Required for planned and active rows. |
| notes | Optional operational context. For abandoned resources, include reason and next review date. |

## Operational Rules

- Do not record raw secrets, tokens, private keys, passwords, session values, or full sensitive environment values in this file.
- Prefer `agentstack provider ledger record` for planned or active rows so the table shape is validated before provider link/apply commands.
- Use `agentstack provider ledger record --replace` only to replace the matching provider/environment/resource/name row after a planned `pending` row gets a real provider id or dashboard URL.
- Use `--write-evidence` when `--evidence` points to a local milestone evidence markdown file. The command writes a redacted evidence note under `docs/milestones/evidence/` without calling provider CLIs or writing telemetry.
- Do not create, adopt, inspect, or mutate untracked real provider resources. Add a row first, then run the provider operation.
- Provider plans may report ledger state, but they do not create or update ledger rows.
- Supported provider apply commands require a matching `planned` or `active` row with required fields complete before execution.
- Update `planned` rows to `active` after successful creation and add provider id or dashboard evidence when available.
- When a resource is no longer needed, mark it `cleanup-pending`, perform cleanup, verify cleanup, then mark it `cleaned` with `cleaned at`, cleanup procedure, and evidence.
- If cleanup cannot be completed, mark the row `abandoned-with-reason` and record the owner, reason, and next review date in `notes`.

## Ledger

Generated projects start with no real provider resources recorded.

| id | provider | resource type | environment | owner account/project | name | external id/url | purpose | created by | created at | expected cleanup trigger/date | current status | cleanup command/procedure | cleaned at | evidence link/path | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
