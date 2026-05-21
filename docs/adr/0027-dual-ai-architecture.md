---
type: ADR
id: "0027"
title: "Dual AI architecture (API chat + CLI agent)"
status: superseded
superseded_by: "0028"
date: 2026-03-01
---

## Context


## Decision


## Options considered

- **Option A** (chosen): Dual architecture — optimized for each use case. Chat is fast and simple; agent is powerful with tool access. Downside: two codepaths to maintain.
- **Option B**: Single agent for both — always use Claude CLI. Downside: overkill for simple questions, slower startup, unnecessary tool overhead.

## Consequences

- AI Chat: `AIChatPanel` + `useAIChat` hook → Rust `ai_chat` command → Anthropic API. Default model: Haiku 3.5 (fast, cheap).
- Both panels share a toggle in the breadcrumb bar (Sparkle icon).
- Context builder (`ai-context.ts`) provides structured JSON with active note, linked notes, open tabs, vault metadata.
- Token budget: 60% of 180k context limit (~108k tokens max).
- Chat requires an Anthropic API key in settings; agent uses Claude CLI's own authentication.
- Re-evaluation trigger: if Anthropic releases an SDK that handles both simple chat and tool calling efficiently.
