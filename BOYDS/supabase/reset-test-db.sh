#!/usr/bin/env bash
# Rebuild the local test database from scratch and apply every BOYD'S migration
# in order. Used by the integration tests, which run against real PostgreSQL so
# that row level security is proved rather than assumed.
set -euo pipefail

DB="${BOYDS_TEST_DB:-boyds_test}"
PGHOST="${PGHOST:-/tmp}"
PGPORT="${PGPORT:-54322}"
PGUSER="${PGUSER:-postgres}"
export PGHOST PGPORT PGUSER

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

psql -q -d postgres -c "drop database if exists ${DB} with (force);"
psql -q -d postgres -c "create database ${DB};"

# The Supabase platform pieces are created by a superuser, as Supabase itself
# does when it provisions a project.
psql -q -v ON_ERROR_STOP=1 -d "${DB}" -f "${HERE}/test-harness/00_supabase_stub.sql"

# The migrations are applied as the NON-superuser role that stands in for
# Supabase's `postgres`. A superuser bypasses every policy, which would let a
# migration pass here that fails, or behaves differently, in production.
for migration in "${HERE}"/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -U supabase_postgres -d "${DB}" -f "${migration}"
done

# Record the history the Supabase CLI records when it applies migrations, in the
# same table and shape, so scripts/verify-production.sql can be run against the
# test database exactly as it is run against production.
psql -q -v ON_ERROR_STOP=1 -U supabase_postgres -d "${DB}" <<'HISTORY'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version    text primary key,
  statements text[],
  name       text
);
HISTORY
for migration in "${HERE}"/migrations/*.sql; do
  file="$(basename "${migration}" .sql)"
  psql -q -v ON_ERROR_STOP=1 -U supabase_postgres -d "${DB}" \
    -c "insert into supabase_migrations.schema_migrations (version, name) values ('${file%%_*}', '${file#*_}')"
done

echo "Test database '${DB}' rebuilt with $(ls "${HERE}"/migrations/*.sql | wc -l) migrations."
