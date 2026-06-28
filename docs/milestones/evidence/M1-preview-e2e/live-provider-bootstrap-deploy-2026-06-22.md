# M1 Live Provider Bootstrap And Deploy

Date: 2026-06-22

## Scope

- Generated app path: `/tmp/agentstack-m1-live-QaRT3J/m1-live-audit`
- Providers touched: Clerk preview application, Convex cloud project/preview deployment, Vercel preview project/deployment
- Raw provider ids, deploy keys, Clerk keys, Vercel project ids, cookies, and DOM snapshots are not stored in this repo evidence.

## Command Outcomes

- `pnpm install` in the generated app passed. Local generated CLIs resolved: Clerk 1.5.0, Convex 1.41.0, Vercel 54.14.5.
- `pnpm run provider:preview:plan` passed with Clerk, Convex, Vercel, and EAS ledger state reported as missing. M1 continued only with Clerk, Convex, and Vercel.
- First `pnpm run m1:providers:bootstrap -- --confirm-live-mutation --created-by Codex` reached real Clerk and recorded an active Clerk preview application, then failed because Convex had no project context.
- `pnpm exec convex dev --once --configure new` created a real Convex cloud project/dev deployment after interactive project name, cloud deployment, and region prompts. It then exposed the real next blocker: `CLERK_JWT_ISSUER_DOMAIN` was missing from Convex env.
- Direct Convex preview creation found two real CLI contract gaps:
  - `--expiration "in 7 days"` is rejected by Convex; current max is 5 days.
  - Convex token creation needs the full deployment reference `team:project:preview/name` and the `.agentstack` directory must exist before `--save-env .agentstack/convex-preview.env`.
- Updated `m1:providers:bootstrap` now uses 5-day preview deployments, full Convex deployment references, creates `.agentstack`, derives Clerk issuer from the Clerk publishable key, sets `CLERK_JWT_ISSUER_DOMAIN` in Convex, and sets `VITE_CLERK_PUBLISHABLE_KEY` plus `VITE_CONVEX_URL` in Vercel preview env.
- After those fixes, `pnpm run m1:providers:bootstrap -- --confirm-live-mutation --created-by Codex` passed for Clerk, Convex, and Vercel.
- `pnpm run m1:providers:link` passed for Clerk, Convex, and Vercel.
- `pnpm run m1:preview:deploy -- --confirm-live-mutation` passed. Convex apply succeeded, Vercel preview deploy succeeded, and the generated deploy URL was `<vercel-preview-url>`.
- Playwright opened the deploy URL and received Vercel's Deployment Protection login page instead of the generated app.
- `pnpm run m1:preview:smoke -- --url <vercel-preview-url> --dom-file .agentstack/m1-preview-dom.html` failed with a specific Vercel Deployment Protection blocker plus missing signed-in/protected-data markers.
- `pnpm run m1:evidence:check` failed as expected because smoke output is not PASS and the generated runbook has not been completed.

## Current M1 Checkbox State

- Generate: PASS
- Ledger: PASS for intended M1 Clerk, Convex, and Vercel preview resources in the generated app
- Connect: PASS for generated local provider-link state
- Deploy: PASS for Convex apply plus Vercel preview deployment
- Auth: FAIL, blocked before Clerk by Vercel Deployment Protection
- Data: FAIL, blocked before Clerk by Vercel Deployment Protection
- Evidence: FAIL until signed-in smoke and runbook are complete

## Blocker

Vercel Standard Deployment Protection is enabled for the preview deployment. The URL redirects to Vercel login before the generated app loads.

Accepted next handoffs:

- authenticate in a Vercel-authorized browser, then sign into Clerk and capture the post-sign-in DOM for `m1:preview:smoke`;
- configure Vercel Protection Bypass for Automation and pass the bypass secret as the `x-vercel-protection-bypass` header during smoke; or
- disable Deployment Protection for this M1 preview/project in Vercel settings.

## Cleanup Note

During the live run, a manual temp-app script copy briefly restored the raw `__APP_SLUG__` template token and created accidental `__APP_SLUG__-preview` provider resources. They are not part of the intended M1 path and should be cleaned up in provider dashboards or via provider CLIs before considering this spike closed.

## Verification

- `pnpm vitest run packages/create-agent-stack/src/generate.test.ts -t "generated M1 provider bootstrap records live-created provider resources"` passed.
- `pnpm vitest run packages/create-agent-stack/src/generate.test.ts` passed: 30 tests.
