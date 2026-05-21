---
type: ADR
id: "0090"
title: "Pi CLI agent adapter"
status: active
date: 2026-04-28
---

## Context



## Decision

Tolaria adds Pi as a supported CLI agent id (`pi`) and launches app-managed Pi sessions through a dedicated adapter module.


Pi availability follows the existing desktop pattern: check the inherited `PATH`, the user's login shell, and common local/toolchain install locations. Pi authentication remains owned by the Pi CLI; Tolaria only surfaces setup errors and does not store provider API keys.

## Options Considered


## Consequences

- The AI panel, settings, command palette, status bar, onboarding, and stream normalization now treat Pi as a first-class supported agent.
- Pi support stays isolated in Pi-specific modules instead of expanding the shared `ai_agents.rs` hotspot.
