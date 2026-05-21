---
type: ADR
id: "0009"
title: "Keyword-only search (remove semantic indexing)"
status: active
date: 2026-03-24
---

## Context


## Decision

**Remove QMD semantic indexing entirely and keep only keyword-based search. Search uses `walkdir` to scan all `.md` files, matching against titles and content with case-insensitive substring matching and relevance scoring.**

## Options considered

- **Option A** (chosen): Keyword-only search via `walkdir` — zero dependencies, no indexing step, instant results, no binary to sign/bundle. Downside: no fuzzy or semantic matching.
- **Option B**: Keep QMD semantic search — richer search results, similarity matching. Downside: bundled Go binary, code-signing, indexing latency, maintenance burden.
- **Option C**: Replace QMD with a Rust-native embedding library — no external binary. Downside: large model files, cold start time, still needs indexing.

## Consequences

- No external search binary to bundle, sign, or install.
- No indexing step on vault open — search is instant.
- `search_vault` Tauri command scans files directly with `walkdir`, runs in a blocking Tokio task.
- Title matches rank higher than content-only matches; exact title matches rank highest.
- Re-evaluation trigger: if users report keyword search is insufficient for large vaults (9000+ notes).
