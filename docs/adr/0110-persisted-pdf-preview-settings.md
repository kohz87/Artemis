---
type: ADR
id: "0110"
title: "Persisted PDF preview settings"
status: active
date: 2026-05-22
---

## Context

ADR-0098 established in-app PDF previews using the webview/browser PDF renderer. That gives Artemis a lightweight embedded viewer, but renderer state such as page and zoom is not part of React state and resets when the app refreshes or the preview remounts.

## Decision

**Artemis persists lightweight PDF preview settings in renderer localStorage, keyed per PDF path, and applies them through the embedded PDF URL fragment.**

The persisted shape is intentionally small: page number and zoom percentage. The PDF remains a normal vault binary file and the viewer remains the webview/browser PDF object renderer from ADR-0098; Artemis controls the initial page/zoom chrome around that renderer instead of introducing a heavier PDF parsing dependency.

## Options considered

- **Option A (chosen): localStorage + PDF URL fragments** — simple, fast, works in web and Tauri, avoids a new dependency, and survives refreshes. The browser/webview renderer still owns deeper state such as text selection and internal scroll offset.
- **Option B: pdf.js/react-pdf** — gives Artemis full rendering control and richer events, but adds a large dependency and worker/CSP surface for a small settings persistence need.
- **Option C: vault-backed settings file** — portable across machines, but would dirty user vaults for UI preferences that are local to a device and browser/webview.

## Consequences

- PDF preview page and zoom survive app refreshes and remounts.
- Settings are local to the device/webview profile and do not create vault files.
- If browser/webview PDF fragment support changes, Artemis can keep the persisted settings and swap only the renderer adapter later.
