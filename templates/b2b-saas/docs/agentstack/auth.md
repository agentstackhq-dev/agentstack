# Auth

Clerk owns user identity for the generated B2B SaaS template. Keep auth behavior explicit:

- Web and mobile surfaces should show sign-in first, then sign-up.
- Product routes should rely on Convex membership checks for authorization.
- Signed-in users should see continue or sign-out actions instead of duplicate auth prompts.
- Use the SaaS spine helpers in `packages/domain/src/saas-spine.ts` for role and permission checks before adding surface-specific auth logic.
- Normalize Clerk webhook ingestion through `convex/saasSpine.ts` metadata and keep provider SDK code behind wrappers.

Expected local values are documented in `.env.example`. Keep real keys out of git and prefer `.agentstack/env-values.json` for prototype validation data.
