#!/usr/bin/env bash
# =============================================================================
# BOYD'S — back up the business data from a Supabase project.
#
#   SUPABASE_DB_URL='postgresql://...'  ./scripts/backup-database.sh [directory]
#
# Writes one file, boyds-backup-<UTC timestamp>.sql, readable only by you.
# The default directory is ./backups, which is git-ignored. THE FILE CONTAINS
# CUSTOMER AND STAFF PERSONAL DATA. Keep it somewhere private and never commit it.
#
# What is in it:
#   * every row of BOYD'S own data (the `public` schema)
#   * the sign-in accounts (auth.users, auth.identities), so restored staff
#     records still point at a real account
#   * the migration version it was taken at, so a restore can check the target
#     schema is at least that new
#
# What is NOT in it, deliberately:
#   * the schema — that is the migrations, applied by deploy-database.sh
#   * job_status_transitions — that IS the job state machine, supplied by the
#     migrations; restoring an old copy into a newer schema would quietly roll
#     the rules back
#
# What is NOT in it, because it cannot be:
#   * the uploaded FILES — signatures, photos, proof of delivery. The database
#     holds only their metadata; the bytes live in Supabase Storage. Download
#     the `boyds-documents` bucket separately (see docs/DEPLOYMENT.md).
#
# Rehearsed: backed up a populated Supabase-like database, restored it into a
# fresh one with restore-database.sh, and compared every table's row count.
# =============================================================================
set -euo pipefail

OUT_DIR="${1:-./backups}"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL is not set. Nothing has been done." >&2
  exit 2
fi
for tool in psql pg_dump; do
  command -v "${tool}" >/dev/null 2>&1 || { echo "${tool} is required. Nothing has been done." >&2; exit 2; }
done

VERSION="$(psql "${SUPABASE_DB_URL}" -X -tA -c \
  "select coalesce(max(version), 'none') from supabase_migrations.schema_migrations")"
if [ "${VERSION}" = "none" ]; then
  echo "This project has no migration history — it is not a deployed BOYD'S database." >&2
  exit 1
fi

mkdir -p "${OUT_DIR}"
umask 077
FILE="${OUT_DIR}/boyds-backup-$(date -u +%Y%m%dT%H%M%SZ).sql"

{
  echo "-- BOYD'S data backup"
  echo "-- boyds-migration-version: ${VERSION}"
  echo "-- taken-at-utc: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "-- Restore ONLY with scripts/restore-database.sh, into an empty project."
  echo
  pg_dump "${SUPABASE_DB_URL}" --data-only --no-owner --no-privileges \
    --schema=public \
    --exclude-table-data=public.job_status_transitions
  pg_dump "${SUPABASE_DB_URL}" --data-only --no-owner --no-privileges \
    --table=auth.users --table=auth.identities
} > "${FILE}"

echo "Backed up to ${FILE} (migration ${VERSION}, $(wc -c < "${FILE}") bytes)."
echo "It contains personal data. Store it privately."
