# Conventions

- Work on `main`; no feature branches/PRs for Artemis workflow. Never use `--no-verify`.
- TDD is mandatory for code behavior changes: write failing regression/feature test, verify red, implement, verify green.
- Do not overwrite unrelated local dirt; check git status before edits. Existing demo-vault dirt is disposable QA residue only if isolated there.
- User-facing UI copy belongs in `src/lib/locales/en.json` and all locale files via `pnpm l10n:translate`.
- Prefer existing app abstractions/components; `src/backend/web-command-handlers.ts` is browser demo fallback, not preferred app integration surface.
- CodeScene gate applies to touched code files: capture/review file-level score before and after edits; new scorable files should score 10.0.