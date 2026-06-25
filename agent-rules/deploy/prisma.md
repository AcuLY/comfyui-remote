# Prisma During Deploy

If Prisma schema changed, choose the provider from the actual deployment target and database connection before syncing schema.

## SQLite Target

If current `.env` has `DB_PROVIDER=sqlite`, or `DATABASE_URL` is a `file:` URL, local deployment uses the SQLite schema:

```powershell
$env:DB_PROVIDER="sqlite"; npx prisma generate
$env:DB_PROVIDER="sqlite"; npx prisma db push
```

## PostgreSQL Target

Run PostgreSQL commands only when the actual deployment target uses PostgreSQL and `DATABASE_URL` starts with `postgresql://` or `postgres://`:

```powershell
$env:DB_PROVIDER="postgresql"; npx prisma generate
$env:DB_PROVIDER="postgresql"; npx prisma db push
```

Do not force PostgreSQL `db push` in a local SQLite environment, and do not temporarily rewrite `.env` database connection values just to pass a command.
