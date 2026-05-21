---
type: ADR
id: "0062"
title: "Selectable CLI AI agents with a shared panel architecture"
status: active
date: 2026-04-13
---

## Context

Tolaria's AI panel, onboarding flow, and status surfaces were built around a single CLI dependency: Claude Code. That worked for the first release, but it made every UI and backend seam agent-specific. Adding Codex as a second supported CLI agent would have duplicated large parts of the app: separate availability checks, a second onboarding path, another status badge, and yet another streaming hook.


## Decision


## Options considered

- **Option A** (chosen): shared agent registry + backend adapter layer — one panel, one preference, one onboarding path, and a clear place to add future CLI agents.
- **Option B**: keep the UI Claude-specific and bolt on Codex as a second special case — lowest short-term cost, but every new agent multiplies the number of bespoke checks, prompts, and command handlers.
- **Option C**: split the product into separate per-agent panels — clearer ownership per integration, but fragments the UX and makes command-palette / status-bar interactions inconsistent.

## Consequences

- Positive: new CLI agents can be added by implementing one backend adapter and registering one frontend definition.
- Positive: onboarding and settings now explain the AI capability of the app at the product level rather than assuming Claude Code is the only valid path.
- Positive: the default agent is installation-local, matching ADR-0004's rule that machine-specific tool preferences belong in app settings rather than the vault.
- Negative: event normalization is now Tolaria-owned; backend adapters must translate each CLI's stream format into a common event model.
- Negative: some user guidance becomes agent-specific again at the edge, such as install links and authentication errors (`claude` login vs `codex login`).
- Re-evaluate if one agent needs capabilities the shared panel cannot express cleanly, or if Tolaria ever moves from CLI subprocesses to a dedicated local SDK/runtime.
