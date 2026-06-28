# Agentstack Validation Hypothesis

This generated project validates the first Agentstack bet: an agent-first meta-framework can take a developer or coding agent from a generated B2B SaaS template to a working preview web app with less manual provider coordination than setting up Clerk, Convex, and Vercel directly.

For M1, that bet is executable. The generated `m1:providers:bootstrap` command should create or reuse real preview provider resources, ledger them, and leave local provider state ready for link and deploy. Provider CLI login links and one-time account/project selection are acceptable handoffs; undocumented dashboard setup and manual resource transcription are not.

## What Would Validate M1

Complete this path using generated Agentstack docs, package scripts, and CLI commands:

1. Generate an app from the B2B SaaS template.
2. Run `pnpm run m1:providers:bootstrap -- --confirm-live-mutation` to create/reuse, ledger, and locally configure preview Clerk, Convex, and Vercel resources.
3. Run `pnpm run m1:providers:link`.
4. Deploy the web app to a Vercel preview URL with `pnpm run m1:preview:deploy -- --confirm-live-mutation`.
5. Run `pnpm run m1:auth:user -- ensure --confirm-live-mutation` to create/reuse and ledger the Clerk smoke user fixture.
6. Sign in with Clerk on that URL.
7. Call one protected Convex query or mutation as the signed-in user.
8. Produce a redacted evidence bundle under `docs/milestones/evidence/M1-preview-e2e/`.

Success means Agentstack orchestrated the path against real provider state. It does not require automating provider auth prompts, but it must not hide missing resource setup behind vague instructions.

## What Would Falsify M1

- Generated guidance does not match real commands or provider behavior.
- `m1:providers:bootstrap` cannot create/reuse, ledger, and configure the M1 provider resources after required CLI auth/account selection.
- Completing preview requires significant steps not covered by generated docs or scripts.
- Local rehearsal output is mistaken for live provider evidence.
- Provider resources are created, linked, inspected, or mutated without ledger rows.
- The redacted evidence bundle cannot prove deploy, auth, and protected data access.

## Current Scope

M1 is preview only and web only. It includes Clerk preview application, Convex preview deployment, and Vercel preview project/deploy. It excludes EAS/mobile, production, billing, hosted control plane, and broad provider proof expansion.

See `docs/milestones/M1-preview-e2e.md` for the active checklist.
