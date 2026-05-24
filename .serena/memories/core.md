# Core

- Artemis is a TypeScript/React app with a standalone Node vault server package.
- Top-level app code lives in `src/`; standalone backend code lives in `packages/vault-server/src/`.
- Main architecture docs: `docs/ARCHITECTURE.md`; ADRs in `docs/adr/` are append-only for structural choices.
- Project workflow and invariants are in `AGENTS.md`; follow them before repository edits.
- Read `mem:tech_stack` for dependencies/tooling, `mem:conventions` for code/task rules, `mem:suggested_commands` for common commands, and `mem:task_completion` for done criteria.