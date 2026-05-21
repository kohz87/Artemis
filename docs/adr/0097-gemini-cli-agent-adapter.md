---
type: ADR
id: "0097"
title: "Gemini CLI agent adapter"
status: active
date: 2026-04-29
---

## Context


Gemini CLI supports headless `--prompt` execution with JSON output, configurable approval modes, tool exclusion, and settings-file overrides through `GEMINI_CLI_SYSTEM_SETTINGS_PATH`. Those features are enough to launch Gemini from Tolaria without mutating the user's durable `~/.gemini/settings.json` during app-managed sessions.

## Decision

Tolaria adds Gemini CLI as a first-class `AiAgentId`. The frontend agent definitions, onboarding prompt, install links, default-agent normalization, status badge, command registry, settings persistence, and mock Tauri status payloads include `gemini`.

The desktop backend adds a Gemini adapter that:

- discovers `gemini` through the process path, login shell, and common local/toolchain install locations
- runs `gemini --output-format json --approval-mode <mode> --prompt <prompt>` from the active vault
- maps Gemini JSON responses into Tolaria's existing AI panel stream events


## Options Considered

- **Write app-managed Gemini config into `~/.gemini/settings.json`**: reuses the external setup path, but would blur the consent boundary and risk overwriting user preferences during normal AI panel usage.
- **Use interactive Gemini sessions**: could preserve richer CLI state, but does not fit Tolaria's current one-request stream lifecycle and would make cleanup/auth/error handling harder.

## Consequences

- Gemini appears anywhere users can choose, install, or switch local AI agents.
- End-to-end native Gemini QA requires the Gemini CLI to be installed and authenticated, but missing/auth failures now produce agent-specific guidance.
- Safe and Power User behavior is limited by Gemini's own approval/tool semantics; if Gemini changes those names, the adapter tests and docs need updating.
