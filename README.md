# Agentstack

Agentstack is an agent-first control framework for B2B SaaS teams building on Convex, Clerk, React, React Native, Vercel, Expo/EAS, and OpenTelemetry.

This prototype proves the local command contract: generate a project, validate the framework manifest, initialize cloud state, and validate the project against that state from the CLI. It does not provision real provider resources yet.

The current cloud implementation is a filesystem-backed local-cloud adapter. Real Convex, Clerk, Vercel, EAS, and telemetry adapters will implement the same validation, sync, and inspection contracts.

## Local Smoke

From the repository root:

```bash
pnpm install
pnpm typecheck
pnpm test

rm -rf tmp/acme-crm
mkdir -p tmp
cd tmp
../node_modules/.bin/tsx ../packages/create-agent-stack/src/bin.ts acme-crm
cd acme-crm
../../node_modules/.bin/tsx ../../packages/cli/src/bin.ts validate
../../node_modules/.bin/tsx ../../packages/cli/src/bin.ts init cloud
../../node_modules/.bin/tsx ../../packages/cli/src/bin.ts validate --cloud
```

Expected smoke output includes:

```text
Created acme-crm
PASS validate
APPLIED development
APPLIED preview
```

## Prototype Commands

- `create-agent-stack <app-name>` copies the B2B SaaS template into a new project directory.
- `agentstack validate` checks the local Agentstack manifest and command contract.
- `agentstack init cloud` applies development and preview state through the local-cloud adapter.
- `agentstack validate --cloud` compares the project manifest with the adapter state.
