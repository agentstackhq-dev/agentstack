# Mobile Builds

Use Agentstack to rehearse mobile build intent before running Expo or EAS directly:

```bash
pnpm run mobile:build:development
pnpm run mobile:build:preview
pnpm run mobile:build:preview:apply
pnpm run mobile:build:production
```

Expected preview output includes `PLAN mobile build preview` for the plan step and `APPLIED mobile build preview` for the apply step. Apply writes `.agentstack/builds/mobile-preview.json` and records `agentstack.mobile.build.completed` telemetry on the `mobile-build` journey.

This is a local mobile build rehearsal. It does not submit builds to Expo, EAS, Apple, or Google. The local artifact is the handoff contract for agents inside the current bounded provider rehearsal surface.

The Expo config in `apps/mobile/app.config.ts` reads `agentstack.config.json`, so app name, slug, environments, and EAS service settings stay tied to the Agentstack manifest. The EAS profiles live in `apps/mobile/eas.json`:

- `development`: internal dev-client builds.
- `preview`: internal release-candidate builds.
- `production`: store-distribution builds, guarded by the Agentstack production confirmation flow.

Production apply rehearsal is intentionally not exposed as a package script. Use the explicit confirmed command when you are ready to rehearse that path:

```bash
agentstack build mobile --env production --apply --confirm-production
```

Package-local scripts under `apps/mobile` also route through Agentstack wrappers:

```bash
pnpm run dev-client
pnpm run build:development
pnpm run build:preview
pnpm run build:preview:apply
pnpm run build:production
pnpm run provider:eas:preview
pnpm run provider:eas:production
```

Use `pnpm run provider:eas:preview` or `pnpm run provider:eas:production` to print the EAS command plan without executing provider commands. Generated projects install `eas-cli` locally, so planned commands use `pnpm exec eas`.

The EAS provider plan includes `eas project:init --non-interactive`, `eas env:list --environment <env>`, and `eas build -p all -e <profile> --json --non-interactive`. Env create/update/delete commands are planned from Agentstack provider operations and label values as coming from `.agentstack/env-values.json`; raw values and secrets are not printed.

EAS server env values must exist in EAS for EAS Build. Local `.env` files and CI variables are useful for local workflows, but they are not a replacement for EAS server env values used by build workers.

App-store submission is outside the current generated framework boundary. This slice plans builds only and does not run `eas submit`.

Keep generated mobile build files under source control. Do not commit `.agentstack/builds/` artifacts.
