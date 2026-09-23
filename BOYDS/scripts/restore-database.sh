#!/usr/bin/env bash
# =============================================================================
# BOYD'S — restore a backup into an EMPTY Supabase project.
#
#   SUPABASE_DB_URL='postgresql://...'  ./scripts/deploy-database.sh --apply
#   SUPABASE_DB_URL='postgresql://...'  ./scripts/restore-database.sh <backup.sql>
#
# The schema comes first, from the migrations. This script then loads the data
# and verifies the result. It refuses to run against a project that already
# holds BOYD'S data: restoring over live records would duplicate or clash with
# them, and there is no safe automatic way to merge the two.
#
# Everything is loaded in ONE transaction. If any row fails, nothing is kept.
#
# Triggers are paused during the load (session_replication_role = replica), the
# same method as Supabase's own documented restore. That is necessary: the job
# state machine would otherwise refuse to insert a job directly at COMPLETED,
# and the audit trail would record every restored row as a new change.
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP="${1:-}"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL is not set. Nothing has been done." >&2
  exit 2
fi
if [ -z "${BACKUP}" ] || [ ! -f "${BACKUP}" ]; then
  echo "Usage: restore-database.sh <backup.sql>. Nothing has been done." >&2
  exit 2
fi

BACKUP_VERSION="$(grep -m1 -oE 'boyds-migration-version: [0-9A-Za-z_]+' "${BACKUP}" | awk '{print $2}')"
if [ -z "${BACKUP_VERSION}" ]; then
  echo "That file is not a BOYD'S backup (no migration version in its header)." >&2
  exit 2
fi

query() { psql "${SUPABASE_DB_URL}" -X -tA -v ON_ERROR_STOP=1 -c "$1"; }

TARGET_VERSION="$(query "select coalesce(max(version), 'none') from supabase_migrations.schema_migrations" 2>/dev/null || echo none)"
if [ "${TARGET_VERSION}" = "none" ]; then
  echo "The target has no BOYD'S schema. Run deploy-database.sh --apply first." >&2
  exit 1
fi
if [[ "${TARGET_VERSION}" < "${BACKUP_VERSION}" ]]; then
  echo "The target schema (${TARGET_VERSION}) is OLDER than the backup (${BACKUP_VERSION})." >&2
  echo "Deploy the current migrations first. Nothing has been done." >&2
  exit 1
fi

EXISTING="$(query "select (select count(*) from public.users) + (select count(*) from public.customers) + (select count(*) from public.jobs)")"
if [ "${EXISTING}" != "0" ]; then
  echo "The target already holds BOYD'S data (${EXISTING} users, customers and jobs)." >&2
  echo "Restore only into an empty project. Nothing has been done." >&2
  exit 1
fi

echo "== Restoring backup taken at migration ${BACKUP_VERSION} into schema ${TARGET_VERSION}"
[ "${TARGET_VERSION}" = "${BACKUP_VERSION}" ] || \
  echo "   Note: the schema is newer than the backup. Newer migrations must not have removed anything the backup holds."

# The migrations seed three reference tables. The backup holds the business's
# own copy of them — possibly edited since — so the seeded rows make way.
psql "${SUPABASE_DB_URL}" -X -q -v ON_ERROR_STOP=1 --single-transaction \
  -c "set client_min_messages = warning" \
  -c "set session_replication_role = replica" \
  -c "truncate public.industries, public.job_types, public.service_areas cascade" \
  -f "${BACKUP}" \
  -c "set session_replication_role = origin" > /dev/null

echo "   Loaded."
echo
echo "== Verify"
OUTPUT="$(psql "${SUPABASE_DB_URL}" -X -q -v ON_ERROR_STOP=1 -tA -F ' | ' -f "${HERE}/verify-production.sql")"
echo "${OUTPUT}" | cut -d'|' -f2- | sed 's/^/   /'
if echo "${OUTPUT}" | grep -q '| STOP |'; then
  echo
  echo "VERIFICATION STOPPED. The data is loaded but the project is not fit for service." >&2
  exit 1
fi
echo
echo "Restored and verified."
