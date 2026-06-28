# M1 Preview E2E Runbook

Status: not run

Use this file during the real M1 preview run. Replace bracketed notes with redacted facts as each step completes. Do not paste raw provider CLI output, tokens, cookies, Clerk secrets, Convex deploy keys, Vercel tokens, provider dashboard payloads, or raw DOM snapshots.

## Scope

- Environment: preview
- Surfaces: web only
- Providers: Clerk preview application, Convex preview deployment, Vercel preview project/deploy
- Out of scope: EAS/mobile, production, billing, hosted control plane

## Operator Inputs

- Owner account/project: `[redacted owner or account label]`
- Created by: `[operator name]`
- Created at: `[yyyy-mm-dd]`
- Provider external ids/urls: recorded in `docs/provider-resource-ledger.md` only
- Provider auth/account handoffs: `[redacted login or project-selection note, or none]`

## Command Log

### 1. Preview Provider Plans

```bash
pnpm run provider:clerk:preview
pnpm run provider:convex:preview
pnpm run provider:vercel:preview
```

Result: `[not run | pass | fail]`

Notes: `[redacted notes or blocker]`

### 2. Bootstrap Preview Providers

```bash
pnpm run m1:providers:bootstrap -- --confirm-live-mutation --created-by <name>
```

Result: `[not run | pass | fail]`

This command is the primary M1 Ledger + Connect entrypoint. It creates or reuses real Clerk, Convex, and Vercel preview resources through provider CLIs, records planned rows before create when needed, replaces them with active rows once real resources exist, saves local provider config, and writes redacted bootstrap evidence.

Evidence file:

- `provider-bootstrap.txt`

If a provider CLI requires auth or account/project selection, record the exact redacted handoff and rerun the same command after the user completes it.

Use `m1:ledger:record` only as a fallback when repairing rows or recording known existing resources that bootstrap cannot discover:

```bash
export M1_CLERK_EXTERNAL_ID=<real-id-or-url>
export M1_CONVEX_EXTERNAL_ID=<real-id-or-url>
export M1_VERCEL_EXTERNAL_ID=<real-id-or-url>
pnpm run m1:ledger:record -- --owner <owner-account-or-project> --created-by <name> --created-at <yyyy-mm-dd> --status active --replace
```

Notes: `[redacted notes or blocker]`

### 3. Link Local Provider State

```bash
pnpm run m1:providers:link
```

Result: `[not run | pass | fail]`

Requires active Clerk, Convex, and Vercel M1 ledger rows.

Evidence file:

- `provider-links.txt`

Notes: `[redacted notes or blocker]`

### 4. Deploy Preview

```bash
pnpm run m1:preview:deploy -- --confirm-live-mutation
```

Result: `[not run | pass | fail]`

Requires active Clerk, Convex, and Vercel M1 ledger rows plus `.agentstack/provider-links.json` and `provider-links.txt` evidence from a passing `m1:providers:link` run before provider execution.

Evidence files:

- `deploy-url.txt` after Vercel emits a preview URL
- `deploy-output.txt` with `Result: PASS` or a redacted `Result: FAIL` blocker after provider execution starts; failed attempts that reach provider execution remove stale `deploy-url.txt`; any attempts that reach provider execution remove stale `smoke-output.txt`

Notes: `[redacted notes or blocker]`

### 5. Deployed Auth And Data Smoke

```bash
pnpm run m1:preview:smoke -- --url <deploy-url> --dom-file .agentstack/m1-preview-dom.html
```

Result: `[not run | pass | fail]`

Requires matching `deploy-url.txt` and `Result: PASS` `deploy-output.txt` from the prior `m1:preview:deploy` step before the helper reads the DOM or writes smoke evidence.

Evidence file:

- `smoke-output.txt` with `Result: PASS` or a redacted `Result: FAIL` marker blocker after deploy evidence matches the same URL

Notes: `[redacted notes or blocker]`

Do not check Auth/Data from local builds, local placeholder output, runtime-placeholder output, unmatched deploy URLs, or signed-out state.

If smoke captures a Vercel Deployment Protection login page instead of the app, record that blocker here. Continue only after Vercel access is resolved by a Vercel-authenticated browser, a Protection Bypass for Automation secret supplied to the browser/test, or disabling protection for this M1 preview.

### 6. Evidence Bundle Check

```bash
pnpm run m1:evidence:check
```

Result: `[not run | pass | fail]`

Requires matching preview URLs across `deploy-url.txt`, `deploy-output.txt`, and `smoke-output.txt`.

Requires `.agentstack/provider-links.json` to contain active Clerk, Convex, and Vercel preview links.

Notes: `[redacted notes or blocker]`

## Final M1 Checkbox Review

All required M1 checkbox review values must be `pass` before `m1:evidence:check` can pass.

- Ledger: `[pass | fail | unchanged]`
- Connect: `[pass | fail | unchanged]`
- Deploy: `[pass | fail | unchanged]`
- Auth: `[pass | fail | unchanged]`
- Data: `[pass | fail | unchanged]`
- Evidence: `[pass | fail | unchanged]`

Smallest next step: `[next action or blocker]`
