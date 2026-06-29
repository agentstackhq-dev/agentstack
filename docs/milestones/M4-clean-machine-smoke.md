# M4: Clean-Machine Generate + Smoke

Status: **locked** (M3 live pass exists; unlock only after explicit M4 packaging approach discussion)

## Hypothesis under test

A consumer can install Agentstack packages, generate an app, and run documented validation on a clean machine without monorepo source paths.

## Done when

- [ ] Versioned packages installable (npm or documented local pack flow)
- [ ] Clean-machine generate + local validate smoke documented and executed
- [ ] Evidence in `docs/milestones/evidence/M4-clean-machine-smoke/`

## Approach questions before unlock

- Use public npm publish, private/local npm registry, or local `pnpm pack` artifacts for the first smoke?
- Which versioned `agentstack` package artifact should the smoke install, and how should the global `agentstack` bin be exposed?
- What counts as a clean machine for this repo: a fresh temp directory on this Mac, a container, or another host?
- Which commands prove success without relying on monorepo source paths?
- What cleanup is expected for packed artifacts, temp generated apps, and any provider resources?

## Not this milestone

- Hosted control plane, full production gates

## Unlock condition

The user explicitly approves the M4 packaging approach after reviewing the M3 cleanup state. Do not infer unlock merely
because M3 live validation passed.
