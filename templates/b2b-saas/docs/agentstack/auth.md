# Auth

Clerk owns user identity for the generated B2B SaaS template. Keep auth behavior explicit:

- Web and mobile surfaces should show sign-in first, then sign-up.
- Product routes should rely on Convex membership checks for authorization.
- Signed-in users should see continue or sign-out actions instead of duplicate auth prompts.

Expected local values are documented in `.env.example`. Keep real keys out of git and prefer `.agentstack/env-values.json` for prototype validation data.
