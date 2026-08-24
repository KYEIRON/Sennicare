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

psql -q -v ON_ERROR_STOP=1 -d "${DB}" -f "${HERE}/test-harness/00_supabase_stub.sql"

for migration in "${HERE}"/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "${DB}" -f "${migration}"
done

echo "Test database '${DB}' rebuilt with $(ls "${HERE}"/migrations/*.sql | wc -l) migrations."
