# Agent Rules

- This repository is green-field. There are no pre-existing Agentstack users, installations, or public compatibility contracts.
- Do not add legacy support, backward-compatibility fallbacks, dual old/new code paths, migration shims, deprecated aliases, or "support older versions" behavior unless the user explicitly approves it for a named reason.
- When a design changes, replace the old path coherently across code, templates, docs, tests, and generated guidance. Do not preserve the old path just in case.
- Treat compatibility code as tech debt by default. If you believe compatibility is required, stop and ask before implementing it.
- Keep generated templates, package-local template mirrors, docs, tests, and validation gates aligned in the same change.
- Run the focused tests for the files you changed, then run `pnpm typecheck` and `pnpm test` before finalizing framework changes.
