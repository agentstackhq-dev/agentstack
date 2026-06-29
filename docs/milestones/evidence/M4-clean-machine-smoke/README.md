# M4 Clean-Machine Smoke Evidence

Evidence for [M4](../../M4-clean-machine-smoke.md).

## What to store here

- dated smoke summaries after a real local-pack clean-consumer run
- packed tarball names and versions used for the run
- redacted command summaries for package pack, generate, install, `validate`, and `dev:check`
- proof the generated app depends on packed tarball specs instead of source `link:` specs
- explicit confirmation that live provider commands and mutations were not run
- blocker summaries when tarball installability, bin exposure, or generated app validation fails

## What not to store

- raw secrets, provider tokens, cookies, payment details, or webhook signing secrets
- evidence claiming M4 passed before generate, install, `validate`, and `dev:check` have all run from the clean consumer workspace
- M5 release automation, public npm publishing output, or live provider bootstrap/link/billing output
