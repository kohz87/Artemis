# Task Completion

- Minimum repository checks before commit/push: `pnpm lint && npx tsc --noEmit && pnpm test && pnpm test:coverage`.
- Vault server changes should at least run `pnpm --filter @artemis/vault-server test` and `pnpm --filter @artemis/vault-server typecheck` before broader checks.
- For core flows touching vault open, note create/save/delete, search, wikilink navigation, git commit/push, or conflict resolution, add/run an appropriate Playwright smoke or regression test.
- Update `docs/ARCHITECTURE.md`, `docs/ABSTRACTIONS.md`, or `docs/GETTING-STARTED.md` when changing web backend commands, hooks/components, data model, or integrations.
- Done in the project workflow means commit and successful push to `origin main` without bypassing hooks.