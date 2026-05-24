# Suggested Commands

- Install/use dependencies with `pnpm`.
- Root dev server: `pnpm dev`; web-only dev server: `pnpm dev:web`; vault server dev: `pnpm dev:server` or `pnpm --filter @artemis/vault-server dev`.
- Root checks: `pnpm lint`, `npx tsc --noEmit`, `pnpm test`, `pnpm test:coverage`.
- Vault server focused checks: `pnpm --filter @artemis/vault-server test`, `pnpm --filter @artemis/vault-server typecheck`.
- Playwright core smoke: `pnpm playwright:smoke`; full smoke regression: `pnpm playwright:regression`.