# CI/CD Setup

## GitHub Actions Workflow

Il workflow `ci.yml` esegue i seguenti check automatici per l'app web-only:

### 1. Tests
- Frontend: `pnpm test:coverage`

### 2. Test Coverage
- Vitest con coverage reporting
- Upload advisory su Codecov del report LCOV frontend (`coverage/lcov.info`)
- Threshold configurabile in `vitest.config.ts`

### 3. Code Health (CodeScene)
- Code health gates su ogni PR/push
- Fail se hotspot o average code health scendono sotto le soglie in `.codescene-thresholds`
- Richiede secrets configurati (vedi sotto)

### 4. Documentation Check
- Verifica che se cambia codice in `src/` o `packages/`, anche `docs/` venga aggiornato
- **Warning only** — non blocca il merge, solo un reminder
- Skip con `[skip docs]` nel commit message
- Aggiorna docs solo se la modifica invalida architettura/astrazioni/design già documentati

### 5. Lint & Build
- TypeScript type check
- Vite build
- ESLint per frontend

## Setup Required

### CodeScene Secrets
Aggiungi questi secrets nel repository GitHub (Settings → Secrets → Actions):

```
CODESCENE_PAT=<your-codescene-pat>
CODESCENE_PROJECT_ID=<your-project-id>
```

Il PAT di CodeScene è lo stesso che usi localmente (~/.codescene/token).
Il project ID lo trovi nella dashboard CodeScene.

### Codecov Setup
- Installa/attiva il repo in Codecov una volta sola tramite GitHub App / import del repository.
- Nessun `CODECOV_TOKEN` richiesto in GitHub Actions: `ci.yml` usa OIDC (`id-token: write` + `use_oidc: true`).
- Il workflow carica `coverage/lcov.info` (Vitest) in modalità advisory: se Codecov non ha ancora il repository importato o torna 404, la CI non fallisce.

### Telemetry Secrets For Release Builds
Aggiungi anche questi secrets per i workflow `release.yml` e `release-stable.yml`:

```
VITE_SENTRY_DSN=<frontend sentry dsn>
VITE_POSTHOG_KEY=<posthog project api key>
VITE_POSTHOG_HOST=https://eu.i.posthog.com
```

Senza questi valori, i build distribuiti possono mantenere i toggle telemetry nelle Settings ma non inizializzare davvero PostHog/Sentry.

### Coverage Thresholds
Configura in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    coverage: {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
      // Fail CI se sotto threshold
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
})
```

## Local Testing

Prima di pushare, puoi testare localmente:

```bash
# Run tests + coverage
pnpm test:coverage

# Type check and build
pnpm exec tsc --noEmit
pnpm build

# Lint
pnpm lint

# CodeScene (local)
codescene delta-analysis --base-revision origin/main
```

## Workflow Triggers

- **Push**: su `main`
- **Pull Request**: verso `main`
- **Manuale**: `workflow_dispatch`

Nota: l'upload a Codecov gira su push a `main` e sulle PR dello stesso repository. Le PR da fork saltano l'upload per evitare problemi di permessi OIDC. L'upload è non bloccante perché la soglia di coverage è già applicata da `pnpm test:coverage`.

## Status Checks

Tutti i check devono passare prima di poter fare merge.
Se un check fallisce, vedrai il dettaglio nei logs di GitHub Actions.
