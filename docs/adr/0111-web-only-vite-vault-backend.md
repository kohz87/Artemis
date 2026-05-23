---
type: ADR
id: "0111"
title: "Web-only Vite vault backend replaces Tauri desktop runtime"
status: active
date: 2026-05-23
supersedes:
  - "0001"
  - "0005"
  - "0014"
  - "0024"
  - "0030"
  - "0031"
  - "0052"
  - "0053"
  - "0054"
  - "0079"
  - "0083"
  - "0089"
  - "0094"
  - "0099"
  - "0104"
  - "0106"
---

## Context

Artemis no longer ships a Tauri desktop runtime or Rust backend. The `src-tauri` tree has been removed, frontend code no longer imports `@tauri-apps/*`, and vault operations now run through explicit TypeScript client functions backed by the local `/api/vault/*` middleware in `vite.config.ts` with browser-local fallback handlers for demos and tests.

The old architecture documents still treated Tauri IPC commands, Rust vault modules, native menus, native file-drop/clipboard bridges, desktop updater feeds, and mobile/iPad targets as active decisions. That made the current web-only codebase harder to reason about and caused ARCHITECTURE.md to describe components that no longer exist.

## Decision

**Artemis is a web-only React/Vite application whose vault boundary is the TypeScript web backend client plus local `/api/vault/*` routes; Tauri IPC, Rust backend modules, native menu/window/updater behavior, and native mobile packaging are no longer part of the active architecture.**

Current architecture documentation must describe the web backend surface (`src/backend/client.ts`, `src/backend/vault-api.ts`, `src/backend/web-command-handlers.ts`, and the Vite local API middleware) instead of Tauri commands or Rust modules.

## Options considered

- **Option A (chosen): Declare the web-only architecture and supersede Tauri-specific ADRs.** Matches the current source tree, keeps docs honest, and gives future work one boundary to target. Cost: historical Tauri ADRs remain in the archive but are no longer current.
- **Option B: Keep Tauri ADRs active as historical context.** Preserves old rationale, but active docs would continue to point developers at deleted files and APIs.
- **Option C: Reintroduce a desktop backend abstraction.** Could support future desktop packaging, but it would be speculative and would add complexity before there is an implementation.

## Consequences

- React code should call explicit backend client functions, not generic IPC shims or `invoke()`.
- Architecture docs should use web API route/function names such as `listVault()`, `saveNoteContent()`, `gitPull()`, and `GET /api/vault/list`.
- Tauri-specific behaviors are retired unless a future ADR reintroduces a native runtime.
- Release/update documentation now covers web builds and build-version stamping, not signed desktop updater artifacts.
- Keyboard/menu QA is browser-renderer QA; native accelerator/menu parity is no longer an active requirement.
- Gitignored visibility is currently renderer/settings-owned and the local web API scans non-hidden files without the old Rust `git check-ignore` boundary filter.

## Re-evaluation triggers

Revisit this decision if Artemis reintroduces a native shell, persistent local daemon, or packaged desktop/mobile runtime with a non-browser filesystem boundary.
