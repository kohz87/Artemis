---
type: ADR
id: "0091"
title: "Gemini CLI external AI setup"
status: active
date: 2026-04-28
---

## Context



## Decision


Vault guidance keeps `AGENTS.md` as the canonical shared source. `restore_vault_ai_guidance` can create or repair a managed `GEMINI.md` shim that imports `AGENTS.md`, while bootstrap and repair flows continue to seed only required Tolaria guidance (`AGENTS.md` and `CLAUDE.md`) plus type scaffolding. Custom `GEMINI.md` files are classified as custom and are not overwritten.

The setup dialog documents that Gemini CLI still needs its own install and sign-in. Tolaria does not store Gemini credentials or model-provider API keys.

## Options Considered

- **Generate `GEMINI.md` automatically for every vault**: simpler discovery, but turns an optional third-party compatibility file into startup side effect and dirties vaults for users who do not use Gemini.

## Consequences

- Gemini users can create a managed `GEMINI.md` shim without duplicating the canonical `AGENTS.md` guidance.
- Existing vault bootstrap and repair remain non-invasive for users who do not use Gemini.
- Native QA requires a local Gemini CLI install and authentication for an end-to-end Gemini prompt; otherwise the app can still verify the generated config and documentation paths.
