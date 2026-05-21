---
type: ADR
id: "0103"
title: "Adapter-specific AI permission semantics"
status: active
date: 2026-04-30
supersedes: "0092"
---

## Context


## Decision

**Tolaria treats the permission mode as a product contract first and maps it conservatively per adapter.**

- Shared AI system prompts are mode-aware on every turn, including turns with note context snapshots.
- Vault Safe tells agents not to use or advertise shell, terminal, Bash, script execution, git, or command-line tools.
- Power User tells shell-capable agents that local shell commands are available for the active vault and should remain scoped to that vault.
- Claude Code Safe excludes Bash; Power User includes and pre-approves Bash without dangerous bypass flags.
- Codex Safe uses the CLI's read-only sandbox plus untrusted approval policy; Power User uses workspace-write plus never-ask approval so shell-capable Codex turns remain low-friction across the session.
- OpenCode Safe denies bash and external directories; Power User allows bash while still denying external directories.

## Consequences

- Mode behavior is no longer described solely by generic UI copy; adapter docs and tests define the exact mapping.
- Future adapters must either implement both modes explicitly or document that Power User maps to the same conservative behavior.
- If Tolaria adds a stronger warning or dangerous mode later, it needs a separate ADR and UI language.
