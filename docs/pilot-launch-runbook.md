# FestaControl paid pilot launch

## Already enforced by the application

- Tenant RLS and server-side subscription write guards.
- Owner, manager, and staff roles with a three-user limit.
- Public proposal tokens stored only as SHA-256 hashes.
- Accepted proposal versions are immutable; duplicate acceptance is idempotent.
- Deposit confirmation, event creation, inventory reservation, and payment registration share one database transaction.
- Evolution webhooks fail closed when `EVOLUTION_WEBHOOK_SECRET` is absent.
- WhatsApp circuit breaker opens after three consecutive provider failures for five minutes.
- Demo and suspended tenants cannot perform external or write actions.

## Required before the first paid customer

These items require account ownership, payment confirmation, domain control, or credentials and cannot be completed by a repository deploy.

1. Rotate the database password and every previously shared legacy `service_role` key in the Supabase dashboard. Update Edge secrets and the backup workstation, then revoke the previous values.
2. Upgrade the Supabase organization to Pro and confirm managed backups/PITR for this project.
3. Configure custom SMTP, require email confirmation, configure CAPTCHA, and enable leaked-password protection. The last feature may require the paid plan.
4. Create a Sentry project, set `VITE_SENTRY_DSN` in Vercel and `SENTRY_DSN`/`SENTRY_ENVIRONMENT` in Supabase, then send one scrubbed test exception from each runtime.
5. Generate a random `EVOLUTION_WEBHOOK_SECRET`, configure it both in Supabase Edge secrets and Evolution webhook headers, and set `WEBHOOK_URL` to the production receiver.
6. Have counsel review `privacy.html`, `terms.html`, `acceptable-use.html`, and the subprocessors list.
7. Create the Mercado Pago commercial account and recurring link for R$ 99/month and R$ 990/year with a 14-day trial. During the first ten pilots, reconcile payment status only through `/admin`.

## Go/no-go evidence

- `npm ci`, lint, Edge tests, all-function `deno check`, build, and Playwright must pass.
- Run the two-tenant SQL checks and Supabase Security Advisor after every policy migration.
- Run `scripts/backup-restore.ps1` in both Backup and Restore modes after material schema changes and monthly.
- Confirm Edge logs contain the expected 401/403/404/410 responses without unexpected 500s.
- Do not promise certified electronic signatures or exclusive use of the official Meta API.
