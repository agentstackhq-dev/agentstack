# M1 Post-Pass Closeout

Date: 2026-06-28
Actor: Codex
Scope: M1 cleanup and pass-review evidence only. M2 was not started.

## Provider Cleanup

Retained the successful 2026-06-28 M1 pass resources so the team can review the exact live repro before choosing the M2 approach.

Cleaned Clerk resources:

- `m1-live-audit-preview` application `<clerk-app-id>`
- accidental `__APP_SLUG__-preview` application `<clerk-app-id>`

Evidence:

- `clerk apps list --json` showed both pending apps before cleanup.
- `clerk api /platform/applications/<application-id> --platform --method DELETE --yes` returned `deleted: true` for both apps.
- A follow-up `clerk apps list --json` omitted both deleted apps and still showed the retained M1 pass app `<clerk-app-id>`.
- Direct platform GET still returned the deleted application records immediately after deletion, so the ledger uses the delete response plus absence from the active application list as cleanup evidence. Raw publishable keys from provider output are not recorded.

Cleaned Vercel resources:

- `m1-live-audit` project `<vercel-project-id>`
- child deployment URL `<vercel-preview-url>`

Evidence:

- `vercel project inspect m1-live-audit --scope <vercel-team-id> --no-color` found the old project before cleanup.
- `vercel project remove m1-live-audit --scope <vercel-team-id> --no-color` prompted that the project and deployments would be permanently removed; Codex confirmed that targeted prompt.
- Follow-up inspect reported no project for `m1-live-audit`.
- `curl -I <vercel-preview-url>` returned HTTP 404 with `x-vercel-error: DEPLOYMENT_NOT_FOUND`.
- Follow-up inspect still found the retained M1 pass Vercel project `<vercel-project-id>`.

Convex cleanup status:

- `convex@1.41.0 deployment --help` exposes `select`, `create`, and `token`.
- `convex@1.41.0 deployment token --help` exposes token create/delete only.
- No Convex project or deployment delete command was available through the template-pinned CLI.
- The superseded `m1-live-audit` Convex project/deployment and the accidental `__APP_SLUG__-preview` Convex row remain dashboard-cleanup items and are marked `abandoned-with-reason` in the ledger with next review 2026-07-05 or post-M1 provider review.

## Pass Review Notes

Generated path usage:

- The final pass used the generated M1 sequence: generate, `m1:providers:bootstrap`, `m1:providers:link`, `m1:preview:deploy`, `m1:auth:user`, browser sign-in, `m1:preview:smoke`, and `m1:evidence:check`.
- The generated smoke/evidence path now requires a Clerk smoke user fixture file, which prevents a repeated manual-only Clerk auth workaround from counting as complete evidence.

External provider friction:

- Vercel Deployment Protection still requires either an authenticated browser path, a protection-bypass setup, or a project-level policy decision for future automation.
- Clerk user lifecycle is now generated as `m1:auth:user ensure|update|delete`, including create/reuse, update, use, and cleanup support for preview smoke testing.
- Clerk platform application cleanup worked through the platform API, but direct GET behavior after delete is not a clean absence check; future cleanup automation should use delete response plus active app list verification.
- Convex cleanup remains weaker because the pinned CLI does not expose project/deployment deletion.

Meta-framework overhead readout:

- M1 proved the framework can coordinate real Clerk, Convex, and Vercel resources into a deployed preview with authenticated protected data.
- The largest remaining repeatability risk is not app generation; it is provider environment policy and live-resource lifecycle ergonomics, especially Vercel protection and Convex dashboard-only cleanup.
- No M2 execution was started. The next decision is whether M2 should measure a fresh agent repeating M1 as-is, or first tighten provider automation policy for protection bypass and cleanup.
