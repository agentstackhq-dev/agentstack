# Agentstack Skills

Agent guidance lives under `skills/agentstack/`. Run `agentstack skills inspect` or `pnpm run skills:inspect` to list the available guidance files before delegating work.

The generated Agentstack skill has no MCP dependency. It is plain repository documentation that agents can read from the workspace.

Use `skills/agentstack/SKILL.md` first, then open the referenced workflow, guardrail, and observability docs when the task needs that detail.

Guidance anchors are owned by the framework validation contract. If an older generated project is upgraded to a framework version that expects this skill pack, copy or regenerate `skills/agentstack/` and `docs/agentstack/skills.md`, then run `pnpm run skills:inspect` and `pnpm run validate`.
