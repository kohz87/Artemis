---
type: ADR
id: "0012"
title: "Claude CLI subprocess for AI agent (replacing direct API)"
status: active
date: 2026-03-01
---

## Context


## Decision


## Options considered

- **Option C**: Use Anthropic Agent SDK from Rust — structured agent framework. Downside: SDK is Python/TypeScript, no Rust support.

## Consequences

- `claude_cli.rs` manages subprocess lifecycle: spawn, stream events, kill on cancel.
- The frontend (`useAiAgent` hook) processes NDJSON events for reasoning blocks, tool action cards, and response display.
- File operation detection (from Write/Edit tool inputs) triggers automatic vault reload.
- The simpler AI Chat panel still uses the Anthropic API directly for lightweight, no-tools conversations.
- Re-evaluation trigger: if Anthropic releases a Rust Agent SDK or if Claude CLI streaming format changes significantly.
