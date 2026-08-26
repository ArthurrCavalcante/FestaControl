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
- The inbox sends real WhatsApp replies through the protected `send-message` function.
- A company can enable one welcome reply. An atomic delivery ledger prevents duplicate sends when webhooks repeat.
- WhatsApp images, documents and audio up to 10 MB are copied to private tenant Storage and opened with short-lived signed URLs.
- Explicit temporary provider rejections are retried twice; ambiguous network failures are not retried automatically to avoid duplicate messages.
- Activation analytics are allowlisted and remove properties that may contain PII.
- The internal pilot panel reports application errors and failed queue events from the last 24 hours.

## Free setup available now

These controls do not require Supabase Pro:

1. Create a free Cloudflare Turnstile widget, set `VITE_TURNSTILE_SITE_KEY` in the frontend and configure its secret in Supabase Auth CAPTCHA settings. The login, signup and password recovery flows already forward the token.
2. Create a Sentry free account and configure `VITE_SENTRY_DSN`, `SENTRY_DSN` and `SENTRY_ENVIRONMENT`. Without a DSN the application continues normally and retains the internal health counters.
3. Deploy the WhatsApp functions only after an Evolution server is reachable and `EVOLUTION_API_URL`, `EVOLUTION_GLOBAL_API_KEY`, `EVOLUTION_WEBHOOK_SECRET` and `WEBHOOK_URL` are present. The connection flow configures the per-instance webhook and its secret header automatically, but it cannot create a real WhatsApp session without that external server.
4. Use the dashboard checklist to complete company data, inventory, team and the first proposal. WhatsApp remains optional during activation.
5. The pilot admin health panel must show tenant integrity and whether Sentry is actually configured in each runtime. "Inativo" means the DSN still needs an account-owned setup.

## Required before the first paid customer

These items require account ownership, payment confirmation, domain control, or credentials and cannot be completed by a repository deploy.

1. Rotate the database password and every previously shared legacy `service_role` key in the Supabase dashboard. Update Edge secrets and the backup workstation, then revoke the previous values.
2. Upgrade the Supabase organization to Pro and confirm managed backups/PITR for this project.
3. Configure custom SMTP and require email confirmation. Leaked-password protection requires Supabase Pro; CAPTCHA can be configured on the free plan as described above.
4. Create a Sentry project, set `VITE_SENTRY_DSN` in Vercel and `SENTRY_DSN`/`SENTRY_ENVIRONMENT` in Supabase, then send one scrubbed test exception from each runtime.
5. Generate a random `EVOLUTION_WEBHOOK_SECRET` in Supabase Edge secrets and set `WEBHOOK_URL` to the production receiver. The application passes the matching header to Evolution when the company connects.
6. Have counsel review `privacy.html`, `terms.html`, `acceptable-use.html`, and the subprocessors list.
7. Create the Mercado Pago commercial account and recurring link for R$ 99/month and R$ 990/year with a 14-day trial. During the first ten pilots, reconcile payment status only through `/admin`.

## Go/no-go evidence

- `npm ci`, lint, Edge tests, all-function `deno check`, build, and Playwright must pass.
- Run the two-tenant SQL checks and Supabase Security Advisor after every policy migration.
- Run `scripts/backup-restore.ps1` in both Backup and Restore modes after material schema changes and monthly.
- Confirm Edge logs contain the expected 401/403/404/410 responses without unexpected 500s.
- Do not promise certified electronic signatures or exclusive use of the official Meta API.
