# M1 Live Preview Pass

## Result

M1 preview E2E passed against real Clerk, Convex, and Vercel resources on 2026-06-28.

Generated app path:

- `/tmp/agentstack-m1-live-20260627-211537-96116`

Deploy URL:

- `https://tmp-agentstack-m1-live-20260627-211537-96116-iq375zhic.vercel.app/`

## Redacted Command Results

All commands were run from the generated app. Raw provider stdout, DOM snapshots, cookies, sessions, passwords, tokens, deploy keys, and sensitive environment values are not stored in this evidence file.

```bash
pnpm run m1:providers:bootstrap -- --confirm-live-mutation --created-by Codex
```

Result: `PASS`

Evidence highlights:

- Clerk preview application: created or reused and linked.
- Clerk JWT template: `convex` template created or reused for Convex auth.
- Convex preview deployment: ensured; deploy key saved only in the generated app local `.agentstack/convex-preview.env`.
- Convex preview env: Clerk issuer configured.
- Vercel preview project: created or reused and linked.
- Vercel preview env: web runtime configured.

```bash
AGENTSTACK_CLI_BIN=<agentstack-repo>/packages/cli/src/bin.ts \
AGENTSTACK_TSX_BIN=<agentstack-repo>/node_modules/.bin/tsx \
pnpm run m1:providers:link
```

Result: `PASS`

Evidence highlights:

- Clerk preview application linked.
- Convex preview deployment linked.
- Vercel preview project linked.
- Provider mutation: none.

```bash
pnpm run m1:preview:deploy -- --confirm-live-mutation
```

Result: `PASS`

Evidence highlights:

- Convex apply completed.
- Vercel apply completed.
- Deploy URL: `https://tmp-agentstack-m1-live-20260627-211537-96116-iq375zhic.vercel.app`

```bash
pnpm run m1:preview:smoke -- --url <deploy-url> --dom-file .agentstack/m1-preview-dom.html
```

Result: `PASS`

Evidence highlights:

- Auth state: `signed-in`
- Protected data state: `protected-data-loaded`
- Workspace id: present and redacted.
- DOM snapshot source: local temporary file, not committed.

```bash
pnpm run m1:evidence:check
```

Result: `PASS`

Evidence highlights:

- Checked provider ledger rows.
- Checked provider bootstrap evidence.
- Checked provider link evidence.
- Checked deploy evidence.
- Checked smoke evidence.
- Checked runbook.

## Provider Resource Summary

Exact provider IDs are recorded in `docs/provider-resource-ledger.md`, not duplicated here.

- Clerk preview application: active row recorded.
- Clerk JWT template for Convex auth: active row recorded.
- Clerk smoke user: active row recorded for cleanup review.
- Convex preview deployment: active row recorded.
- Vercel preview project: active row recorded.
- Vercel preview deployment: active row recorded.

## Notes

- The previous Vercel Deployment Protection blocker was bypassed by using an authenticated browser path for this smoke.
- The generated app needed to wait for Convex auth before calling the protected query.
- The bootstrap helper needed to ensure the Clerk `convex` JWT template because `ConvexProviderWithClerk` requests that token template.
- The Clerk smoke user used for the browser run had client trust bypass enabled for M1 sign-in and is ledgered for cleanup review.
- The generated app runbook final checkbox review recorded Ledger, Connect, Deploy, Auth, Data, and Evidence as `pass`.
