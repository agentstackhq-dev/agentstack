# Auth

Clerk owns user identity for the generated B2B SaaS template. Keep auth behavior explicit:

- Web and mobile surfaces should show sign-in first, then sign-up.
- Product routes should rely on Convex membership checks for authorization.
- Signed-in users should see continue or sign-out actions instead of duplicate auth prompts.
- Use the SaaS spine helpers in `packages/domain/src/saas-spine.ts` for role and permission checks before adding surface-specific auth logic.
- Normalize Clerk webhook ingestion through `convex/saasSpine.ts` metadata and keep provider SDK code behind wrappers.

Use `pnpm run provider:clerk:preview` and `pnpm run provider:clerk:production` to print the bounded Clerk command plan. Provider inspection uses read and diagnostic commands only, such as `pnpm exec clerk doctor --mode agent`, `pnpm exec clerk env pull --mode agent`, and `pnpm exec clerk config pull --mode agent`. Provider plans may still render deterministic setup or review steps such as `pnpm exec clerk init -y` and the production `pnpm exec clerk deploy --mode agent` plan item separately; review those steps before running them outside Agentstack.

Expected local values are documented in `.env.example`. Keep real keys out of git and prefer provider-owned Clerk secrets over copied source values. Clerk env values such as `CLERK_SECRET_KEY`, publishable keys, and `CLERK_WEBHOOK_SIGNING_SECRET` should be synchronized through the Clerk CLI plan or dashboard review rather than pasted into generated source.
