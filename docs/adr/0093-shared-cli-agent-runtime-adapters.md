---
type: ADR
id: "0093"
title: "Shared CLI agent runtime adapters"
status: active
date: 2026-04-29
---

## Context


That duplication made small runtime fixes expensive because they had to be repeated across several adapter files. It also kept Codex-specific command and event mapping inside `ai_agents.rs`, making the top-level module both an orchestrator and a bespoke adapter.

## Decision

**Tolaria uses `cli_agent_runtime.rs` as the shared runtime scaffold for app-managed CLI agents, while `ai_agents.rs` only normalizes and dispatches requests to per-agent adapter modules.**


Codex now lives in `codex_cli.rs`, matching the Claude, OpenCode, and Pi adapter boundary. `ai_agents.rs` remains the Tauri-facing orchestrator that chooses an adapter and maps Claude's legacy event enum into the normalized event stream.

## Options Considered

- **Shared runtime scaffold with thin adapters** (chosen): reduces repeated process lifecycle code without hiding provider-specific command/config/event behavior.
- **One trait object per agent**: more uniform on paper, but adds indirection without removing much current complexity.
- **Fully generic event mapping**: over-abstracts the JSON schemas and makes provider-specific edge cases harder to test.

## Consequences

- Runtime lifecycle fixes should usually start in `cli_agent_runtime.rs`.
- New agent adapters should use the shared request/prompt/process helpers and keep only command, config, discovery, and event mapping local.
- `ai_agents.rs` should not grow provider-specific runtime code again; it should normalize the frontend request, dispatch to an adapter, and map any legacy event shape.
- The shared scaffold deliberately does not erase provider differences. Authentication messages, permission semantics, and transient config formats remain adapter-owned and must stay covered by adapter tests.
