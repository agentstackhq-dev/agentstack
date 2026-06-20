# Workflows

- Inspect: run `pnpm run inspect`, then `pnpm run skills:inspect` when agent guidance is relevant.
- Validate: run `pnpm run validate` before completion; use `pnpm run doctor` for repair hints.
- Preview: rehearse sync with `pnpm run preview:plan`, then apply with `pnpm run preview:apply` only when requested.
- Deploy: rehearse deploys with `pnpm run preview:deploy`; use `pnpm run preview:deploy:apply` for local apply artifacts.
- Mobile: use the generated mobile build scripts and treat `.agentstack/builds/` as local rehearsal output.
