# FestaControl backup and restore

The script stores encrypted database and Storage artifacts outside the repository. Never place credentials in this file, command history, or a versioned environment file.

## Prerequisites

- PostgreSQL 17 client and server on local port `5433`.
- OpenSSL from Git for Windows.
- Local environment variables `SUPABASE_DB_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, and `FestaControl_BACKUP_PASSPHRASE`.
- `FestaControl_LOCAL_PG_PASSWORD` for restore. The workstation installer creates this variable.
- Set `SUPABASE_DB_HOST` and `SUPABASE_DB_USER` only when the direct database host is unavailable and a session pooler must be used.

## Create and verify a backup

```powershell
.\scripts\backup-restore.ps1 -Mode Backup
.\scripts\backup-restore.ps1 -Mode Restore
```

The default destination is `C:\Users\Daniele\Documents\FestaControl-Backups`. Each set contains `database.dump.enc`, `storage.zip.enc`, `manifest.json`, and, after a successful restore, `restore-report.json`.

The backup is accepted only when encrypted artifact checksums, restored core-table counts, and every exported Storage object hash match. Plaintext temporary files are removed from the Windows temporary directory in a `finally` block.

The local PostgreSQL restore omits Supabase-managed extension objects (`pg_net`, `supabase_vault`, and related extension schemas) that are unavailable outside Supabase. The application schemas checked by the drill are still `public`, `auth`, and `storage`; this omission does not alter the encrypted production dump.

## Recovery drill

Run the restore command after every material schema change and at least monthly. Record the operator, date, duration, backup-set path, and the result from `restore-report.json`. A checksum without a successful restore is not recovery evidence.

The archive contains application data and Supabase-managed schemas present in `pg_dump`. A production recovery must still follow Supabase incident procedures for Auth configuration, Edge secrets, and provider-side credentials, which are intentionally not stored in this backup.
