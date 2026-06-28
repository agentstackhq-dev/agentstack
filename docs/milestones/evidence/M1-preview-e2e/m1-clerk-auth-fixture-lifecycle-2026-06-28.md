# M1 Clerk Auth Fixture Lifecycle

## Result

M1 Auth Fixture hardening added on 2026-06-28.

This records a generated-path improvement after the live M1 pass: future generated apps include `m1:auth:user` so Clerk preview smoke users can be created/reused, updated, used for browser sign-in, and deleted through a ledgered command path instead of manual Clerk dashboard/API patching.

## Command Surface

```bash
pnpm run m1:auth:user -- ensure --confirm-live-mutation --created-by <name>
pnpm run m1:auth:user -- update --confirm-live-mutation --created-by <name>
pnpm run m1:auth:user -- delete --confirm-live-mutation --created-by <name>
```

## Evidence Boundary

- User resource row: `clerk | user | preview`
- Evidence file: `docs/milestones/evidence/M1-preview-e2e/clerk-smoke-user.txt`
- Local credential state: `.agentstack/m1-auth-user.json`
- Evidence check: now requires the smoke-user evidence file and an active or cleaned ledger row
- Redaction: passwords, OTP codes, session tokens, cookies, provider stdout, and full user payloads are not stored

## Verification

The generated-path regression tests covered:

- confirmation gate before user mutation
- create/reuse flow
- credential rotation/update flow
- delete/cleanup flow
- active and cleaned ledger row replacement
- local credential state excluded from committed evidence
- `m1:evidence:check` refusal when Clerk smoke-user evidence is missing

No additional live provider resources were created for this hardening evidence note.
