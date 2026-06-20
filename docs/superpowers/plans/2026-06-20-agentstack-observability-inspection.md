# Agentstack Observability Inspection Commands

## Goal

Give agents richer, provider-neutral observability commands so they can inspect traces, journeys, errors, webhooks, components, and environment differences from the same redacted wide-event stream used by the current prototype.

This advances the end-to-end spec without claiming hosted telemetry or OTLP adapters are implemented yet. The concrete backend remains local `.agentstack/events.jsonl`; the command shape is intentionally compatible with future control-plane or OTLP-backed adapters.

## Architecture

- `@agentstack/telemetry` owns event filtering, redaction, time-window parsing, and summarization helpers.
- `@agentstack/cli` exposes agent-facing `observe` modes that compose those helpers and record command telemetry.
- Generated docs and the spin-up site teach the inspection workflows as incident-debugging tools.
- Tests prove the commands work with production-like events while redacting sensitive fields.

## Commands

Keep existing commands:

```bash
agentstack observe query --env production --surface convex --event billing.*
agentstack observe timeline --journey billing --env preview
```

Add spec-aligned modes:

```bash
agentstack observe trace --id trace_123 --env production
agentstack observe journey --id journey_123 --include-state
agentstack observe errors --env production --since 2h --group-by component
agentstack observe webhook clerk --env production --since 24h
agentstack observe component convex:billing.applySubscriptionUpdate --env production
agentstack observe compare --env preview,production --journey onboarding
```

## Work Items

1. Extend telemetry query support.
   - Add optional filters for `component`, `releaseId`, `actorId`, `command`, `since`, and `errorClass`.
   - Keep output redacted and chronologically sorted.
   - Add helpers to detect error events, group errors, and compare event counts by environment.

2. Extend CLI observe modes.
   - Preserve current `query` and `timeline`.
   - Add `trace`, `journey`, `errors`, `webhook`, `component`, and `compare`.
   - Make missing option failures actionable.
   - Emit `agentstack.observe.completed` telemetry for every successful mode.

3. Add focused tests.
   - Telemetry tests cover new filters, since windows, error grouping, and environment comparison.
   - CLI tests seed JSONL events and assert redacted output for the new modes.
   - E2E prototype exercises at least one richer inspection command in the generated app flow.

4. Update generated docs and spin-up pages.
   - Generated `docs/agentstack/observability.md` explains the modes and limitations.
   - `AGENTS.md` points agents to richer inspection paths.
   - Spin-up telemetry/lab pages visualize incident inspection and update examples.
   - Keep template mirror parity between `templates/b2b-saas` and `packages/create-agent-stack/templates/b2b-saas`.

## Verification

Run:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
git diff --check
```

Also verify template mirror parity and smoke the LAN spin-up site for updated pages.

## Out Of Scope

- Real OTLP export.
- Hosted control-plane telemetry indexing.
- Provider dashboard links.
- Production permission enforcement beyond redaction and local command shape.
