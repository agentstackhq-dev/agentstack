# M1: Preview E2E (web + Clerk + Convex + Vercel)

Status: **complete** — validated on 2026-06-28

Hypothesis: [validation-hypothesis.md](../validation-hypothesis.md)

## Hypothesis under test

Generated Agentstack guidance + CLI can get a **preview** SaaS path live with less manual provider coordination than doing Clerk/Convex/Vercel setup by hand.

## Scope

**In:** Preview environment only. Web surface only (no EAS/mobile for M1).

**Providers:** Clerk (preview application), Convex (preview deployment), Vercel (preview project + deploy).

**Out:** Production, EAS builds, billing, hosted control plane, npm publish, broad proof taxonomy expansion.

## Done when (all required)

- [x] **Generate** — App created from B2B SaaS template (`create-agent-stack` or equivalent local generate) with valid anchors
- [x] **Ledger** — Preview resources recorded in [provider-resource-ledger.md](../provider-resource-ledger.md) with owner, purpose, cleanup
- [x] **Connect** — Preview Clerk + Convex + Vercel linked or adopted via Agentstack CLI (live or local path as implemented)
- [x] **Deploy** — Web app deployed to a Vercel preview URL via supported ledger-gated apply/deploy path
- [x] **Auth Fixture** — Clerk smoke user lifecycle is ledgered and repeatable for create/reuse, update, use, and cleanup in preview auth testing
- [x] **Auth** — Clerk sign-in works on the deployed preview URL
- [x] **Data** — Signed-in user can call one protected Convex query or mutation from the web app
- [x] **Evidence** — Redacted bundle in [evidence/M1-preview-e2e/](./evidence/M1-preview-e2e/) with runbook, commands (redacted), deploy URL, smoke result

Optional stretch (not required for M1 pass):

- [ ] `agentstack validate --live --env preview` passes for the connected preview subset

## Allowed infra work this milestone

- Minimal proof/link/adopt changes so preview connect succeeds (narrow: Clerk/Vercel/Convex preview only)
- Clerk web auth in generated template
- One protected Convex function + web client call
- Smoke check script or documented manual smoke steps
- Fixes to generated docs/skills that mismatched real provider steps discovered during spike

## Not this milestone

- EAS, production envs, billing webhooks, UI primitive library
- New diagnostic-only CLI surfaces (`Candidate identity evidence`, partial drift slices, plan-only reconcile expansions)
- Quality gate additions (format/lint/generated) unless they block milestone CI
- Expanding `consumer-production-readiness-progress.md`

## Required E2E path

1. Generate app → `pnpm run validate` (local structure)
2. Run `pnpm run provider:preview:plan` to see intended provider lifecycle
3. Run `pnpm run m1:providers:bootstrap -- --confirm-live-mutation` to create/reuse, ledger, and locally configure preview Clerk, Convex, and Vercel
4. Run `pnpm run m1:providers:link`
5. Run `pnpm run m1:preview:deploy -- --confirm-live-mutation`
6. Run `pnpm run m1:auth:user -- ensure --confirm-live-mutation` to create/reuse and ledger the Clerk smoke user
7. Sign in on the Vercel preview URL and capture the deployed DOM
8. Run `pnpm run m1:preview:smoke -- --url <deploy-url> --dom-file .agentstack/m1-preview-dom.html`
9. Complete the runbook with redacted facts and run `pnpm run m1:evidence:check`

`m1:ledger:record` is a repair/fallback command for known existing resources or damaged rows. Do not make it the default M1 path while `m1:providers:bootstrap` can be run.

## Current blocker

None for M1. The generated app path reached real Clerk, Convex, and Vercel resources, deployed to Vercel preview, signed in through Clerk, loaded protected Convex data, and passed the generated evidence check.

## Last E2E attempt

| Field | Value |
| --- | --- |
| Date | 2026-06-28 |
| Actor | Codex |
| App path | `/tmp/agentstack-m1-live-20260627-211537-96116` |
| Result | Generate PASS; provider bootstrap PASS; provider link PASS; Convex apply PASS; Vercel preview deploy PASS; Auth Fixture PASS; Auth PASS; protected Convex data PASS; evidence check PASS |
| Deploy URL | `https://tmp-agentstack-m1-live-20260627-211537-96116-iq375zhic.vercel.app/` |
| Commands run | See [m1-live-preview-pass-2026-06-28.md](./evidence/M1-preview-e2e/m1-live-preview-pass-2026-06-28.md) |
| Evidence | [m1-live-preview-pass-2026-06-28.md](./evidence/M1-preview-e2e/m1-live-preview-pass-2026-06-28.md) |
| Friction notes | Vercel Deployment Protection was bypassed by using an authenticated browser path. The live Auth/Data fix required the generated web runtime to wait for Convex auth before protected queries and the bootstrap helper to ensure the Clerk `convex` JWT template. The Clerk smoke user used for browser sign-in had client trust bypass enabled for this M1 run and is ledgered for cleanup review; generated M1 now includes `m1:auth:user` so future runs can create/reuse, update, and delete that fixture without manual Clerk API patching. |
| Next smallest step | Human pass criteria review and M2 approach discussion. Do not start M2 until that discussion happens. |

## Post-pass queue (max 3)

1. Treat the generated docs/skills M1 path as a provider-path spike only; do not add more generated guidance to consumer apps.
2. Decide whether to retain or delete the successful 2026-06-28 M1 repro resources in [provider-resource-ledger.md](../provider-resource-ledger.md).
3. Review Convex dashboard-only cleanup rows marked `abandoned-with-reason`; Clerk and Vercel superseded resources were cleaned in [m1-post-pass-closeout-2026-06-28.md](./evidence/M1-preview-e2e/m1-post-pass-closeout-2026-06-28.md).

## Pass criteria review

When all required checkboxes are checked, human reviews:

- Did the generated docs/skills path prove provider orchestration while exposing the wrong generated consumer shape?
- Where did we need external provider docs?
- Can the framework move that overhead behind package-owned CLI, typed schema diagnostics, and hidden `.agentstack/` state?

Then implement the lean generated-surface correction required by [M2](./M2-agent-completes-m1.md), or record kill/pivot in the hypothesis doc.
