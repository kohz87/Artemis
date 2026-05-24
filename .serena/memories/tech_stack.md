# Tech Stack

- Package manager: pnpm.
- Root package is ESM TypeScript (`type: module`) with Vite 7, React 19, Vitest 4, Playwright, ESLint 9, Tailwind 4.
- Vault backend package: `@artemis/vault-server`, Node ESM TypeScript under `packages/vault-server/src/`, run in dev with `node --experimental-strip-types`.
- Backend tests run through root Vitest config from package script: `pnpm --filter @artemis/vault-server test`.