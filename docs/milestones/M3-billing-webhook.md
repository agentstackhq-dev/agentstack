# M3: Billing Webhook + Entitlement Gate

Status: **locked** (unlock after M2 passes)

## Hypothesis under test

The generated SaaS spine can handle one billing webhook → entitlement update → gated UI/feature path on preview.

## Done when

- [ ] Stripe (or configured billing provider) webhook ingested idempotently on preview
- [ ] Entitlement state updates in Convex
- [ ] Web UI reflects entitlement gate (allow/deny one feature)
- [ ] Redacted evidence in `docs/milestones/evidence/M3-billing-webhook/`

## Not this milestone

- Full billing UI, production billing, mobile

## Unlock condition

M2 pass + explicit decision to continue meta-framework validation beyond auth/deploy.
