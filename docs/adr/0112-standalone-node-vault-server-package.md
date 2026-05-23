---
type: ADR
id: "0112"
title: "Standalone Node vault server package for local web APIs"
status: active
date: 2026-05-23
---

## Context

ADR-0111 moved Artemis to a web-only architecture, but the local `/api/vault/*` implementation still lived inside `vite.config.ts` as Vite dev-server middleware. That coupled backend vault operations to frontend build tooling, made the Vite config difficult to review, and prevented reuse of the vault API outside Vite's lifecycle.

The frontend should continue to call relative `/api/vault/*` URLs in development, while the backend implementation should be runnable and testable as a normal Node module.

## Decision

**Move the local `/api/vault/*` implementation into `packages/vault-server/`, a standalone Node package that exports reusable request handlers and server lifecycle helpers.** Vite remains responsible for frontend dev/build concerns and proxies `/api/vault` requests to the independently launched Node vault server during development.

`pnpm dev` starts both the standalone vault server and Vite frontend. Developers may also run `pnpm dev:server` and `pnpm dev:frontend` in separate terminals when they need separate lifecycle control.

## Options considered

- **Option A (chosen): Workspace package with standalone Node HTTP server.** Separates frontend tooling from backend vault operations, gives the server its own tests/scripts, and preserves relative frontend API URLs through a Vite proxy. Cost: development now coordinates two processes.
- **Option B: Keep Vite middleware but split helper files under `src/server/`.** Reduces `vite.config.ts` size, but still ties backend startup and route handling to Vite's plugin lifecycle.
- **Option C: Introduce an Express/Fastify/Hono app.** Provides a richer backend framework, but adds dependency and migration surface before the current route set needs it.

## Consequences

- `vite.config.ts` should stay focused on Vite, Vitest, and proxy configuration; it should not define vault route handlers.
- Backend vault changes should target `packages/vault-server/src/` and include package-level tests where possible.
- The dev server port boundary is explicit: Vite defaults to `ARTEMIS_PORT=5202`, while the vault server defaults to `ARTEMIS_API_PORT=5302` on `127.0.0.1`.
- Production/build behavior remains frontend-only until a future ADR introduces a packaged or deployed server runtime.
- Revisit this decision if Artemis needs a persistent daemon, multi-user hosted backend, or packaged binary server instead of a local development Node process.
