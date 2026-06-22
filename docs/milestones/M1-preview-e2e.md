# M1: Preview E2E (web + Clerk + Convex + Vercel)

Status: **active**

Hypothesis: [validation-hypothesis.md](../validation-hypothesis.md)

## Hypothesis under test

Generated Agentstack guidance + CLI can get a **preview** SaaS path live with less manual provider coordination than doing Clerk/Convex/Vercel setup by hand.

## Scope

**In:** Preview environment only. Web surface only (no EAS/mobile for M1).

**Providers:** Clerk (preview application), Convex (preview deployment), Vercel (preview project + deploy).

**Out:** Production, EAS builds, billing, hosted control plane, npm publish, broad proof taxonomy expansion.

## Done when (all required)

- [ ] **Generate** — App created from B2B SaaS template (`create-agent-stack` or equivalent local generate) with valid anchors
- [ ] **Ledger** — Preview resources recorded in [provider-resource-ledger.md](../provider-resource-ledger.md) with owner, purpose, cleanup
- [ ] **Connect** — Preview Clerk + Convex + Vercel linked or adopted via Agentstack CLI (live or local path as implemented)
- [ ] **Deploy** — Web app deployed to a Vercel preview URL via supported ledger-gated apply/deploy path
- [ ] **Auth** — Clerk sign-in works on the deployed preview URL
- [ ] **Data** — Signed-in user can call one protected Convex query or mutation from the web app
- [ ] **Evidence** — Redacted bundle in [evidence/M1-preview-e2e/](./evidence/M1-preview-e2e/) with runbook, commands (redacted), deploy URL, smoke result

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

## Suggested E2E path (spike order)

1. Generate app → `pnpm run validate` (local structure)
2. Add planned ledger rows for Clerk application, Convex deployment, Vercel project (preview)
3. `agentstack provider plan` / inspect / inventory / link or adopt (preview)
4. Convex apply + Vercel preview deploy apply (ledger-gated)
5. Wire Clerk env to web; deploy; sign in
6. Protected Convex call from web
7. Capture evidence

Adjust based on what the repo actually supports today — document gaps honestly.

## Current blocker

_none recorded yet — run spike thread to fill this in_

## Last E2E attempt

| Field | Value |
| --- | --- |
| Date | — |
| Actor | — |
| App path | — |
| Result | not attempted |
| Commands run | — |
| Friction notes | — |
| Next smallest step | Run spike thread per [THREAD-KICKOFF.md](./THREAD-KICKOFF.md) |

## Unblock queue (from spike; max 3)

1. _pending spike_
2. —
3. —

## Pass criteria review

When all required checkboxes are checked, human reviews:

- Did we use generated docs/skills for the path?
- Where did we need external provider docs?
- Is meta-framework overhead acceptable?

Then unlock [M2](./M2-agent-completes-m1.md) or record kill/pivot in hypothesis doc.
