# Prisma Provider Matrix

This matrix is the current source of truth for choosing Prisma schema, generated client, migration directory, and verification commands across PostgreSQL, SQLite, and test-only databases.

## Provider Matrix

| Flow | Provider env | Database URL | Schema | Migration path | Generated client | Primary commands | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PostgreSQL app/dev/prod | `DB_PROVIDER=postgresql` | `postgresql://...` from `.env` | `prisma/schema.prisma` | `prisma/migrations` | `src/generated/prisma/` | `npm run prisma:generate`, `npm run prisma:migrate`, `npm run prisma:db:push` only for explicit sync work | `npm run prisma:generate`, schema/source tests |
| SQLite app/dev/local file | `DB_PROVIDER=sqlite` | `DATABASE_URL=file:./data/comfyui.db` or another explicit file URL | `prisma/schema.sqlite.prisma` | `prisma/migrations-sqlite` | `src/generated/prisma-sqlite/` | `npm run prisma:generate:sqlite`, `DB_PROVIDER=sqlite DATABASE_URL=file:./data/comfyui.db npm run prisma:db:push`, `npm run db:bootstrap:sqlite` | `npm run prisma:generate:sqlite`, SQLite runtime tests |
| Both generated clients | provider set per command | provider-specific URL | both schemas | both migration trees | both generated outputs | `npm run prisma:generate:all` | generated client imports and full test suite |
| test-only in-memory/file DB | test sets provider and URL explicitly | in-memory or temporary `file:` URL owned by the test | usually `prisma/schema.sqlite.prisma` | test fixture setup, not production migration | `src/generated/prisma-sqlite/` when SQLite runtime is used | `node --import tsx --test tests/test-zero-redundancy-schema-shape.test.ts` and targeted DB tests | isolated test DB bootstrap plus teardown |

## Rules

- Do not force PostgreSQL commands in a SQLite deployment or local SQLite verification.
- Do not rewrite `.env` just to make a Prisma command pass; set `DB_PROVIDER` and `DATABASE_URL` on the command when needed.
- `prisma.config.ts` selects `prisma/schema.prisma` and `prisma/migrations` unless `DB_PROVIDER=sqlite`.
- `prisma.config.ts` selects `prisma/schema.sqlite.prisma` and `prisma/migrations-sqlite` when `DB_PROVIDER=sqlite`.
- `src/generated/prisma/` and `src/generated/prisma-sqlite/` are generated code. Regenerate them; do not manually edit them.
- Schema changes that affect shared models must update both schemas or document the provider-specific difference in the same batch.
- Runtime deployment Prisma work must follow `agent-rules/deploy/prisma.md` and the deployment lock rules in `agent-rules/deploy/index.md`.

## Command Reference

```bash
# PostgreSQL client generation
npm run prisma:generate

# SQLite client generation
npm run prisma:generate:sqlite

# Generate both clients
npm run prisma:generate:all

# PostgreSQL migration in a PostgreSQL environment
npm run prisma:migrate

# SQLite db push for an explicit local file DB
DB_PROVIDER=sqlite DATABASE_URL=file:./data/comfyui.db npm run prisma:db:push

# SQLite local bootstrap
npm run db:bootstrap:sqlite

# Schema compatibility source-contract test
node --import tsx --test tests/test-zero-redundancy-schema-shape.test.ts
```
