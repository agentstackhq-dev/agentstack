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

Real provider resources created for M1 validation are recorded below. Secret values, deploy keys, cookies, and session material are not recorded.

| id | provider | resource type | environment | owner account/project | name | external id/url | purpose | created by | created at | expected cleanup trigger/date | current status | cleanup command/procedure | cleaned at | evidence link/path | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| m1-live-audit-clerk-preview | clerk | application | preview | <provider-account-email> | m1-live-audit-preview | <clerk-app-id> | M1 preview Clerk auth smoke | Codex | 2026-06-22 | M1 pass or pivot | cleaned | `pnpm exec clerk api /platform/applications/<clerk-app-id> --platform --method DELETE --yes` | 2026-06-28 | docs/milestones/evidence/M1-preview-e2e/m1-post-pass-closeout-2026-06-28.md | Superseded by the 2026-06-28 M1 pass resources; delete returned `deleted: true` and app was absent from `clerk apps list`; raw keys not recorded. |
| m1-live-audit-convex-project | convex | project | preview | <provider-owner> | m1-live-audit | <convex-dashboard-url> | M1 Convex cloud context for preview deployment | Codex | 2026-06-22 | M1 pass or pivot | abandoned-with-reason | delete through Convex dashboard |  | docs/milestones/evidence/M1-preview-e2e/m1-post-pass-closeout-2026-06-28.md | Owner <provider-owner>; reason: Convex CLI 1.41.0 exposes deployment create/select/token but no project or deployment delete command; next review 2026-07-05 or post-M1 provider review. |
| m1-live-audit-convex-preview | convex | deployment | preview | <provider-owner>:m1-live-audit | m1-live-audit-preview | <provider-owner>:m1-live-audit:preview/m1-live-audit-preview | M1 protected Convex data smoke | Codex | 2026-06-22 | M1 pass or pivot | abandoned-with-reason | delete through Convex dashboard |  | docs/milestones/evidence/M1-preview-e2e/m1-post-pass-closeout-2026-06-28.md | Owner <provider-owner>; reason: Convex CLI 1.41.0 exposes deployment create/select/token but no deployment delete command; next review 2026-07-05 or post-M1 provider review. |
| m1-live-audit-vercel-project | vercel | project | preview | <vercel-team-id> | m1-live-audit | <vercel-project-id> | M1 Vercel preview deploy smoke | Codex | 2026-06-22 | M1 pass or pivot | cleaned | `pnpm dlx vercel@54.14.5 project remove m1-live-audit --scope <vercel-team-id> --no-color` | 2026-06-28 | docs/milestones/evidence/M1-preview-e2e/m1-post-pass-closeout-2026-06-28.md | Superseded by the 2026-06-28 M1 pass resources; removal was confirmed at the Vercel CLI prompt and later inspect reported no project. |
| m1-live-audit-vercel-deployment | vercel | deployment | preview | <vercel-team-id> | m1-live-audit preview deployment | <vercel-preview-url> | M1 deployed preview URL for Auth/Data smoke | Codex | 2026-06-22 | M1 pass or pivot | cleaned | deleted with parent Vercel project `m1-live-audit` | 2026-06-28 | docs/milestones/evidence/M1-preview-e2e/m1-post-pass-closeout-2026-06-28.md | Superseded by the 2026-06-28 M1 pass resources; URL returned `DEPLOYMENT_NOT_FOUND` after project removal. |
| m1-live-20260628-clerk-preview | clerk | application | preview | <provider-account-email> | tmp-agentstack-m1-live-20260627-211537-96116-preview | <clerk-app-id> | M1 preview Clerk auth smoke pass | Codex | 2026-06-28 | post-M1 review | active | retain until post-M1 review, then delete with Clerk platform application API or dashboard |  | docs/milestones/evidence/M1-preview-e2e/m1-live-preview-pass-2026-06-28.md | Retained as the successful M1 repro resource; created or reused by generated `m1:providers:bootstrap`; raw keys not recorded. |
| m1-live-20260628-clerk-jwt-template | clerk | jwt-template | preview | <provider-account-email> | convex | <clerk-jwt-template-id> | M1 Convex auth token template for Clerk integration | Codex | 2026-06-28 | post-M1 review | active | delete through Clerk dashboard if preview app is retained without this integration |  | docs/milestones/evidence/M1-preview-e2e/m1-live-preview-pass-2026-06-28.md | Ensured by generated `m1:providers:bootstrap` after live smoke showed Convex auth required the `convex` token template. |
| m1-live-20260628-clerk-smoke-user | clerk | user | preview | <provider-account-email> | m1 smoke user | <clerk-user-id> | M1 Clerk sign-in smoke for protected Convex data | Codex | 2026-06-27 | post-M1 review | active | delete through Clerk dashboard or Clerk users API |  | docs/milestones/evidence/M1-preview-e2e/m1-live-preview-pass-2026-06-28.md | Smoke-only user; client trust bypass was enabled for this M1 browser run. Email, password, sessions, and tokens are not recorded. |
| m1-live-20260628-convex-preview | convex | deployment | preview | <provider-owner>:tmp-agentstack-m1-live-20260627-211537-96116-preview | tmp-agentstack-m1-live-20260627-211537-96116-preview | <provider-owner>:tmp-agentstack-m1-live-20260627-211537-96116-preview:preview/tmp-agentstack-m1-live-20260627-211537-96116-preview | M1 protected Convex data smoke pass | Codex | 2026-06-28 | post-M1 review | active | delete through Convex dashboard |  | docs/milestones/evidence/M1-preview-e2e/m1-live-preview-pass-2026-06-28.md | Created by generated `m1:providers:bootstrap`; deploy key saved only in temp generated app `.agentstack/convex-preview.env`. |
| m1-live-20260628-vercel-project | vercel | project | preview | <vercel-team-id> | tmp-agentstack-m1-live-20260627-211537-96116 | <vercel-project-id> | M1 Vercel preview deploy smoke pass | Codex | 2026-06-28 | post-M1 review | active | retain until post-M1 review, then delete with `pnpm dlx vercel@54.14.5 project remove tmp-agentstack-m1-live-20260627-211537-96116 --scope <vercel-team-id> --no-color` or dashboard |  | docs/milestones/evidence/M1-preview-e2e/m1-live-preview-pass-2026-06-28.md | Retained as the successful M1 repro resource; created or reused by generated `m1:providers:bootstrap`; preview env configured by generated helper. |
| m1-live-20260628-vercel-deployment | vercel | deployment | preview | <vercel-team-id> | tmp-agentstack-m1-live-20260627-211537-96116 preview deployment | https://tmp-agentstack-m1-live-20260627-211537-96116-iq375zhic.vercel.app/ | M1 deployed preview URL with Auth/Data smoke pass | Codex | 2026-06-28 | post-M1 review | active | delete project or deployment through Vercel dashboard |  | docs/milestones/evidence/M1-preview-e2e/m1-live-preview-pass-2026-06-28.md | Deployed by generated `m1:preview:deploy -- --confirm-live-mutation`; smoke passed with signed-in Clerk and protected Convex data. |
| accidental-template-token-clerk-preview | clerk | application | preview | <provider-account-email> | __APP_SLUG__-preview | <clerk-app-id> | Accidental temp-script copy during M1 live validation | Codex | 2026-06-22 | immediate cleanup | cleaned | `pnpm exec clerk api /platform/applications/<clerk-app-id> --platform --method DELETE --yes` | 2026-06-28 | docs/milestones/evidence/M1-preview-e2e/m1-post-pass-closeout-2026-06-28.md | Not part of intended M1 path; delete returned `deleted: true` and app was absent from `clerk apps list`. |
| accidental-template-token-convex-preview | convex | deployment | preview | convex-selected-project | __APP_SLUG__-preview | __APP_SLUG__-preview | Accidental temp-script copy during M1 live validation | Codex | 2026-06-22 | immediate cleanup | abandoned-with-reason | delete through Convex dashboard after locating matching preview deployment |  | docs/milestones/evidence/M1-preview-e2e/m1-post-pass-closeout-2026-06-28.md | Owner <provider-owner>; reason: exact provider resource is not CLI-verifiable and Convex CLI 1.41.0 has no deployment delete command; next review 2026-07-05 or post-M1 provider review. |
