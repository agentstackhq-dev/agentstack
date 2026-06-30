# Agentstack Validation

## Local Validation

Run:

```sh
corepack pnpm run validate
corepack pnpm run dev:check
```

`validate` checks the generated app structure, typed config, source policy, and local contracts. `dev:check` verifies the local web preflight without starting a long-running server.

## Framework Changes

When changing the Agentstack framework repo rather than a generated app, run focused tests for touched files, then:

```sh
corepack pnpm typecheck
corepack pnpm test
git diff --check
```

If templates change, verify the root template mirror and package template mirror:

```sh
diff -rq templates/b2b-saas packages/agentstack/templates/b2b-saas
```

## Evidence

Generated app runtime state and smoke artifacts belong under `.agentstack/`. Framework milestone evidence belongs under `docs/milestones/evidence/<milestone-id>/` in the framework repo and must be redacted.
