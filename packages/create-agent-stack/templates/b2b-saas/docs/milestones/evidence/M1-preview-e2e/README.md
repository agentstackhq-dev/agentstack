# M1 Preview E2E Evidence

Store redacted evidence for the preview web + Clerk + Convex + Vercel validation path here.

## Expected Files

- `provider-ledger-<service>-<yyyy-mm-dd>.md` - redacted notes for real preview Clerk, Convex, and Vercel ledger rows.
- `provider-ledger-<service>-<yyyy-mm-dd>-active.md` - redacted notes when `m1:ledger:record -- --status active --replace` repairs explicit pending rows.
- `provider-bootstrap.txt` - redacted provider bootstrap evidence from `pnpm run m1:providers:bootstrap -- --confirm-live-mutation`.
- `provider-links.txt` - redacted provider-link evidence from `pnpm run m1:providers:link`.
- `deploy-url.txt` - the Vercel preview URL emitted by `m1:preview:deploy`; `m1:preview:smoke` may refresh it only after matching deploy evidence exists.
- `deploy-output.txt` - redacted PASS output or failed-stage blocker output from `pnpm run m1:preview:deploy -- --confirm-live-mutation`.
- `smoke-output.txt` - redacted PASS output or marker-missing blocker output from `pnpm run m1:preview:smoke` after the same URL has matching top-level PASS deploy evidence.
- `runbook.md` - redacted command sequence and blocker notes for the real M1 run.

## Evidence Rules

- Do not store raw API keys, Clerk secrets, Convex deploy keys, Vercel tokens, cookies, or session values.
- Do not commit raw DOM snapshots. Use `.agentstack/m1-preview-dom.html` as a temporary local file only.
- `smoke-output.txt` must not store the supplied DOM file path; it records only a redacted local temporary file marker.
- Do not paste raw provider CLI output when it contains provider identifiers or sensitive values.
- Record real resources in `docs/provider-resource-ledger.md` before create, link, adopt, inspect, or mutate actions.
- Use `m1:providers:bootstrap` as the primary M1 provider entrypoint; it records planned rows before create where needed and active rows after real resources exist.
- Update `runbook.md` as each real M1 step runs; keep unsuccessful attempts and blockers redacted.
- `m1:ledger:record` must restore the previous `docs/provider-resource-ledger.md` content and M1 provider-ledger evidence files if any individual service record fails.
- `m1:providers:link` must restore the previous `.agentstack/provider-links.json` state, remove stale `provider-links.txt`, and write no `provider-links.txt` success evidence if any individual link command fails.
- `m1:preview:deploy` must refuse with no deploy evidence writes unless `.agentstack/provider-links.json` and top-level `Result: PASS` `provider-links.txt` exist from a passing `m1:providers:link` run.
- Failed `m1:preview:deploy` attempts that reach provider execution must remove stale `deploy-url.txt` and keep only redacted `deploy-output.txt` failure evidence.
- Any `m1:preview:deploy` attempt that reaches provider execution must remove stale `smoke-output.txt`; Auth/Data evidence must come from `m1:preview:smoke` after the current deploy result.
- `m1:preview:smoke` must refuse with no local evidence writes unless `deploy-url.txt` and `deploy-output.txt` exist from a passing `m1:preview:deploy` run, `deploy-output.txt` has a top-level `Result: PASS`, and both deploy evidence files match the `--url` value.
- `m1:evidence:check` must reject the bundle unless provider-link, deploy, and smoke evidence each have a top-level `Result: PASS`.
- `m1:evidence:check` must reject the bundle unless `.agentstack/provider-links.json` still contains active Clerk, Convex, and Vercel preview links.
- `m1:evidence:check` must reject the bundle unless `deploy-url.txt`, `deploy-output.txt`, and `smoke-output.txt` all name the same preview URL.
- `m1:evidence:check` must reject the bundle unless the smoke `Checked at` timestamp is not older than deploy `Checked at`.
- `m1:evidence:check` must reject the bundle if `runbook.md` is still marked not-run or contains unresolved runbook placeholders.
- `m1:evidence:check` must reject the bundle unless all six required command-step result lines are present.
- `m1:evidence:check` must reject the bundle unless all six final required M1 checkbox review lines are present.
- `m1:evidence:check` must reject the bundle if `runbook.md` records any step result as `fail` or `not run`, or any final required M1 checkbox as `fail` or `unchanged`.
- Run `pnpm run m1:evidence:check` before marking the M1 Evidence checkbox complete.
- Keep Auth/Data unchecked until `smoke-output.txt` shows `Auth state: signed-in`, `Protected data state: protected-data-loaded`, and `Workspace id: present (redacted)` from the deployed preview URL.
