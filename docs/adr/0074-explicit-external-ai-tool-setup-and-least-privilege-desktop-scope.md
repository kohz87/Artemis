---
type: ADR
id: "0074"
title: "Explicit external AI tool setup and least-privilege desktop scope"
status: active
date: 2026-04-22
---

## Context


The product direction now favors least-privilege defaults. Fresh installs should not silently edit third-party config files, external AI tool setup must be intentional and reversible, and the desktop shell should only expose the filesystem paths that the active vault actually needs.

## Decision

**Tolaria now treats external AI tool wiring as an explicit user action and keeps the desktop shell scoped to the active vault.**

- The Tauri asset protocol remains enabled for local vault images, but its static config scope is empty. Tolaria grants recursive asset access only to the active vault at runtime when that vault is reloaded.
- App-managed Codex sessions use the CLI's normal approval and sandbox path by default instead of opting into the dangerous bypass mode automatically.

## Options considered

- **Explicit setup + runtime vault-only scope** (chosen): aligns with least-privilege defaults, keeps command-palette discoverability, preserves image loading and external-tool support, and makes every privileged step visible and reversible.
- **Keep startup auto-registration and global asset scope**: lowest friction, but it silently mutates third-party config and leaves the desktop shell effectively open to every local file path.

## Consequences

- Desktop asset access is constrained to the active vault instead of all filesystem paths, while note images and attachments continue to load normally.
- The command palette and status bar now expose an explicit external AI tools setup/remove flow that supports keyboard-only QA.
- Codex agent sessions are safer by default, at the cost of relying on the CLI's normal approval path instead of bypassing it automatically.
