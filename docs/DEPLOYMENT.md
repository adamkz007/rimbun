# Deployment and Verification Guide

## Pre-deploy checklist

- Set `NEXT_PUBLIC_SUPABASE_URL` to the deployed Supabase project URL.
- Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the project anon key.
- Set `SUPABASE_SERVICE_ROLE_KEY` if staff invite/admin flows are enabled.
- Configure Supabase Auth redirect URLs for your production app origin.
- Confirm clinic module flags in `clinics.settings.modules` match enabled product areas.
- Run the CI-equivalent commands locally before release:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm typecheck:test`
  - `pnpm test`
  - `pnpm test:integration`
  - `pnpm build`
  - `pnpm test:e2e`

## Local development workflow

```bash
supabase start
supabase db reset
npm run db:seed:reference
cp .env.example .env.local
supabase status -o env   # copy URL and keys into .env.local
npm run dev
```

Demo users seeded by `supabase/seed/002_bootstrap_clinic.sql`:

- `admin@demo.rimbun.local`
- `doctor@demo.rimbun.local`
- `nurse@demo.rimbun.local`
- `reception@demo.rimbun.local`

Password for all demo users: `Rimbun123!`

## Auth URL alignment

Local Supabase auth is configured for the Next.js dev server at `http://127.0.0.1:3000`.
Use the same host in your browser during local testing to avoid cookie/redirect mismatches.

## Backup and restore

Local database backup:

```bash
supabase db dump --local -f backup.sql
```

Restore into a fresh local database:

```bash
supabase db reset
psql "$DATABASE_URL" -f backup.sql
```

For hosted Supabase projects, use the Supabase dashboard backup/PITR features or `supabase db dump --linked`.

## CI pipeline

GitHub Actions runs on push and pull request:

1. Lint, typecheck, unit tests
2. Integration tests against local Supabase (`pnpm test:integration`)
3. Production build
4. Playwright E2E against `pnpm start` with seeded Supabase data

## Test layers

- Unit tests: pure helpers in `tests/*.test.ts`
- Integration tests: Supabase RPC + RLS in `tests/integration/*.test.ts`
- E2E tests: browser smoke flows in `e2e/*.spec.ts`
