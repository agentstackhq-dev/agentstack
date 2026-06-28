# M1: Preview E2E

Status: active

Hypothesis: [validation-hypothesis.md](../validation-hypothesis.md)

## Scope

Preview environment only. Web surface only. M1 covers Clerk preview application, Convex preview deployment, and Vercel preview project/deploy.

Out of scope for M1: EAS/mobile, production, billing, hosted control plane, and broad provider proof expansion.

## Done When

- [x] **Generate** - App created from the B2B SaaS template with generated anchors.
- [ ] **Ledger** - Preview Clerk, Convex, and Vercel resources recorded in [provider-resource-ledger.md](../provider-resource-ledger.md) with owner, purpose, cleanup, status, and evidence path.
- [ ] **Connect** - Preview Clerk, Convex, and Vercel linked or adopted through generated Agentstack commands after valid ledger rows exist.
- [ ] **Deploy** - Web app deployed to a Vercel preview URL through the supported ledger-gated path.
- [ ] **Auth Fixture** - Clerk smoke user is created/reused, updated if needed, ledgered, and cleanable through generated M1 commands.
- [ ] **Auth** - Clerk sign-in works on the deployed preview URL.
- [ ] **Data** - Signed-in user can call `workspaceStatus.protectedStatus` from the deployed web app.
- [ ] **Evidence** - Redacted bundle exists in [evidence/M1-preview-e2e/](./evidence/M1-preview-e2e/) with ledger notes, deploy URL, smoke output, and runbook or command notes.

## Required Order

1. Run the aggregate preview plan to see the intended provider lifecycle:

   ```bash
   pnpm run provider:preview:plan
   ```

2. Bootstrap the real M1 preview providers:

   ```bash
   pnpm run m1:providers:bootstrap -- --confirm-live-mutation --created-by <name>
   ```

   This is the primary Ledger + Connect entrypoint for M1. It uses local provider CLIs to create or reuse the Clerk preview application, Convex preview deployment, and Vercel project, records planned rows before create where needed, replaces them with active rows after real resources exist, saves Convex deploy-key env to `.agentstack/convex-preview.env`, and writes redacted `provider-bootstrap.txt` evidence.

   If a provider CLI requires authentication or account/project selection, run the command it prints and rerun this bootstrap command. That handoff is a real blocker; do not replace it with dashboard guesswork.

   Use `m1:ledger:record` only as a fallback when repairing rows or recording known existing resources that bootstrap cannot discover:

   ```bash
   export M1_CLERK_EXTERNAL_ID=<real-id-or-url>
   export M1_CONVEX_EXTERNAL_ID=<real-id-or-url>
   export M1_VERCEL_EXTERNAL_ID=<real-id-or-url>
   pnpm run m1:ledger:record -- --owner <owner-account-or-project> --created-by <name> --created-at <yyyy-mm-dd> --status active --replace
   ```

3. Link local provider state only after bootstrap recorded matching active ledger rows:

   ```bash
   pnpm run m1:providers:link
   ```

4. Run the explicit ledger-gated deploy helper only after active ledger rows, `.agentstack/provider-links.json`, and `provider-links.txt` evidence from `m1:providers:link` exist:

   ```bash
   pnpm run m1:preview:deploy -- --confirm-live-mutation
   ```

5. Capture the Vercel URL from `docs/milestones/evidence/M1-preview-e2e/deploy-url.txt`; `deploy-output.txt` must also show `Result: PASS`.
6. Create or reuse the Clerk smoke user fixture before browser sign-in:

   ```bash
   pnpm run m1:auth:user -- ensure --confirm-live-mutation --created-by <name>
   ```

   This writes local-only credentials to `.agentstack/m1-auth-user.json`, records the Clerk preview user in `docs/provider-resource-ledger.md`, requests client-trust bypass where supported, and writes redacted `clerk-smoke-user.txt` evidence. Use `update` to rotate credentials or repair metadata, and `delete` after review to delete only the ledgered smoke user and mark the row cleaned.

7. Open the deployed URL, sign in with Clerk, wait for protected Convex data to load, and run:

   ```bash
   pnpm run m1:preview:smoke -- --url <deploy-url> --dom-file .agentstack/m1-preview-dom.html
   ```

   The smoke helper refuses before reading the DOM or writing `smoke-output.txt` unless `deploy-url.txt` and `deploy-output.txt` came from a passing `m1:preview:deploy` run for the same URL.

8. Check the local redacted evidence bundle before marking Evidence complete:

   ```bash
   pnpm run m1:evidence:check
   ```

## Evidence Rules

- Do not check Auth/Data from local placeholder output, local builds, or `signed-out` state.
- Do not check Auth/Data until `m1:auth:user -- ensure --confirm-live-mutation` has written `clerk-smoke-user.txt` and a Clerk smoke-user ledger row.
- Do not check Auth/Data from `m1:preview:smoke` unless it used matching PASS deploy evidence for the same preview URL.
- Do not check Deploy from local preview rehearsal output.
- Do not ledger, link, apply, inspect, or smoke EAS for M1 unless mobile scope is explicitly unlocked.
- Do not commit raw DOM snapshots, provider tokens, Clerk secrets, Convex deploy keys, Vercel tokens, cookies, or session values.
- Store only redacted evidence under `docs/milestones/evidence/M1-preview-e2e/`.
- `m1:evidence:check` is local-only. It validates the redacted bundle and does not call provider CLIs, mutate providers, write local state, or append telemetry.

## Current Blocker

Run `pnpm run m1:providers:bootstrap -- --confirm-live-mutation --created-by <name>` against authenticated provider CLIs. If it fails, the blocker is the first concrete provider CLI auth/account/project action printed by that command.

## Next Smallest Step

Run `pnpm run m1:providers:bootstrap -- --confirm-live-mutation --created-by <name>`, then continue to `m1:providers:link` only after it passes.
