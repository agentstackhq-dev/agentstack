# M2 Live Preview Pass Evidence

Date: 2026-06-28

## Result

Result: PASS for the M2 package-owned live preview path.

The successful run used a fresh lean generated app at `/tmp/m2-live-20260628-094218-92482` and executed the path through the public `agentstack` bin plus generated package scripts. The generated app did not need copied docs, generated scripts, generated skills, root `convex/`, root `vercel.json`, or a generated provider ledger.

## Consumer Path

```text
agentstack create m2-live-20260628-094218-92482 --package-spec link:<agentstack-repo>/packages/agentstack
pnpm install
pnpm run validate
pnpm run provider:bootstrap -- --env preview --confirm-live-mutation
cd apps/convex && ../../node_modules/.bin/convex dev --once --configure new
pnpm run provider:bootstrap -- --env preview --confirm-live-mutation
pnpm run provider:link
pnpm run preview:deploy -- --confirm-live-mutation
pnpm run auth:user -- ensure --confirm-live-mutation
Playwright browser sign-in using the generated Clerk smoke user and Vercel bypass cookie
pnpm run preview:smoke -- --url <deploy-url> --dom-file .agentstack/m2-preview-dom.html
pnpm run evidence:check
pnpm run auth:user -- delete --confirm-live-mutation
pnpm run evidence:check
```

## Live Evidence

- `pnpm run provider:bootstrap -- --env preview --confirm-live-mutation`: PASS after the Convex project context was created under `apps/convex`.
- `pnpm run provider:link`: PASS and wrote only hidden `.agentstack/provider-links.json` plus hidden evidence.
- `pnpm run preview:deploy -- --confirm-live-mutation`: PASS.
- Final deploy URL: `<vercel-preview-url>`
- Browser smoke: PASS with `data-agentstack-auth-state="signed-in"` and `data-agentstack-protected-data-state="protected-data-loaded"`.
- `pnpm run preview:smoke -- --url <deploy-url> --dom-file .agentstack/m2-preview-dom.html`: PASS.
- `pnpm run evidence:check`: PASS before and after `auth:user delete`.
- `pnpm run auth:user -- delete --confirm-live-mutation`: PASS; the Clerk smoke user was removed after the smoke pass.

## Package Fixes Landed During Live Run

- Added package-owned M2 commands for provider bootstrap, provider link, preview deploy, auth-user lifecycle, smoke, and evidence check.
- Added `agentstack create --package-spec <spec>` so local package validation can generate an installable consumer app without manually editing `package.json`.
- Moved Convex provider context to `apps/convex` and kept deploy-key state in root `.agentstack/`.
- Resolved provider CLI binaries from the generated app root install while running them from app subdirectories.
- Linked and deployed Vercel from `apps/web/.vercel` so deployments belong to the generated app project, not an accidental `web` project.
- Passed Vite public runtime values as Vercel build env during deploy so the deployed app receives Clerk and Convex config.
- Fixed `pnpm run auth:user -- ensure` argument delimiter handling.
- Updated Clerk user metadata through `/users/{id}/metadata` instead of deprecated `public_metadata` on `PATCH /users/{id}`.
- Normalized deploy URL comparison in smoke evidence so trailing-slash differences do not fail coherent evidence.
- Expanded redacted provider failure detail to make CLI blockers actionable without exposing secrets.

## Friction Log

- Convex required interactive project setup. The package command now points to `cd apps/convex && pnpm exec convex dev --once --configure new or existing`; during setup, the generated app slug was entered explicitly, cloud deployment and the default region were selected, and Convex AI files were declined.
- `pnpm install` for local M2 validation initially failed because `agentstack@0.0.0` is not published to npm. `agentstack create --package-spec link:/...` now makes the local package-consumer path repeatable.
- Vercel Deployment Protection blocked anonymous browser smoke. Vercel automation bypass worked only after the URL belonged to the correct generated app project; Playwright used a one-off Vercel bypass cookie request, then loaded the app without global custom headers so Clerk CDN requests were not polluted.
- Vercel CLI initially deployed `apps/web` into an accidental project named `web`. The package now links and deploys from `apps/web`; the accidental Vercel project was removed.
- Vercel local CLI deployments can still produce production and preview target records. The package deploy now passes required Vite build env values directly in addition to syncing Vercel preview env.
- The generated root `package.json` still emits pnpm's warning that the `workspaces` field is not a pnpm workspace file. This did not block M2 because package-owned commands resolve root-installed provider CLI binaries and Vercel installs `apps/web` dependencies remotely, but it is a post-M2 product decision.

## Provider Cleanup

- The successful Clerk smoke user was deleted after the smoke pass.
- The accidental Clerk app from `/tmp/m2-live-20260628-093800-87726` was deleted and verified absent from `clerk apps list`.
- The accidental Vercel project `web` (`<vercel-project-id>`) was removed and verified absent from `vercel project ls`.
- Vercel automation bypass keys created for the accidental `web` project were revoked before project removal.
- The plain Vercel automation bypass key on the successful M2 project was revoked. Vercel refused removal of the remaining `VERCEL_AUTOMATION_BYPASS_SECRET` env-var bypass entry because at least one env-var bypass must remain; no secret value is recorded.
- Convex CLI has no project/deployment delete command in this flow; Convex resources are recorded in the provider ledger for dashboard cleanup/review.

## Verification

```text
pnpm vitest run packages/cli/src/run.test.ts -t "M2 provider bootstrap|M2 provider bootstrap state|M2 Clerk smoke|M2 smoke|M2 evidence|pnpm run delimiter|metadata endpoint"
PASS: 1 file, 7 tests

pnpm vitest run packages/create-agent-stack/src/generate.test.ts tests/e2e/prototype.test.ts packages/cli/src/run.test.ts -t "M2 provider bootstrap|M2 provider bootstrap state|M2 Clerk smoke|M2 smoke|M2 evidence|generates the M2 lean|local package dependency|creates and operates"
PASS: 3 files, 8 tests

pnpm typecheck
PASS

pnpm test
PASS: 28 files, 546 tests

git diff --check
PASS

diff -rq templates/b2b-saas packages/create-agent-stack/templates/b2b-saas
PASS
```
