#!/usr/bin/env bash
# =============================================================================
# BOYD'S — apply the database migrations to a Supabase project, safely.
#
#   SUPABASE_DB_URL='postgresql://...'  ./scripts/deploy-database.sh           # dry run
#   SUPABASE_DB_URL='postgresql://...'  ./scripts/deploy-database.sh --apply   # apply
#
# 1. PREFLIGHT  scripts/preflight-production.sql — stops on any STOP row.
# 2. PLAN       supabase db push --dry-run — lists what would be applied.
# 3. APPLY      supabase db push — only with --apply.
# 4. VERIFY     scripts/verify-production.sql — stops on any STOP row.
#
# A dry run is the default. Applying migrations to production cannot be undone
# by this script, so it is never the thing that happens by accident.
#
# The connection string is read from SUPABASE_DB_URL and never printed, logged
# or written anywhere. Get it from Supabase → Project Settings → Database →
# Connection string (the "Session pooler" URI works from any network). Keep it
# out of chat, out of files, and out of shell history (prefix the command with
# a space in bash, or set the variable in a separate step).
#
# Rehearsed end to end against a local database built to behave like hosted
# Supabase (supabase/test-harness/00_supabase_stub.sql).
# =============================================================================
set -euo pipefail

SUPABASE_CLI_VERSION="2.117.0"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "${HERE}")"

APPLY=false
for arg in "$@"; do
  case "${arg}" in
    --apply) APPLY=true ;;
    *) echo "Unknown argument: ${arg}" >&2; exit 2 ;;
  esac
done

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "SUPABASE_DB_URL is not set. Nothing has been done." >&2
  exit 2
fi

for tool in psql npx; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "${tool} is required and was not found. Nothing has been done." >&2
    exit 2
  fi
done

supabase_cli() {
  (cd "${ROOT}" && npx --yes "supabase@${SUPABASE_CLI_VERSION}" "$@")
}

run_checks() {
  # Prints the checks as a table, and fails if any row is STOP.
  local script="$1"
  local output
  output="$(psql "${SUPABASE_DB_URL}" -v ON_ERROR_STOP=1 -X -q -tA -F ' | ' -f "${script}")"
  echo "${output}" | cut -d'|' -f2- | sed 's/^/   /'
  if echo "${output}" | grep -q '| STOP |'; then
    return 1
  fi
}

echo "== 1. Preflight"
if ! run_checks "${HERE}/preflight-production.sql"; then
  echo
  echo "PREFLIGHT STOPPED. No migration has been applied. Resolve every STOP row first." >&2
  exit 1
fi

echo
echo "== 2. Plan"
supabase_cli db push --dry-run --db-url "${SUPABASE_DB_URL}" 2>&1 \
  | grep -vE '^\{|file name must match' | sed 's/^/   /'

if [ "${APPLY}" != true ]; then
  echo
  echo "Dry run only. Nothing was applied. Re-run with --apply to apply the plan above."
  exit 0
fi

echo
echo "== 3. Apply"
supabase_cli db push --yes --db-url "${SUPABASE_DB_URL}" 2>&1 \
  | grep -vE '^\{|file name must match|^NOTICE' | sed 's/^/   /'

echo
echo "== 4. Verify"
if ! run_checks "${HERE}/verify-production.sql"; then
  echo
  echo "VERIFICATION STOPPED. The migrations were applied, but the project is NOT fit" >&2
  echo "to put into service. Do not point the application at it until every STOP is resolved." >&2
  exit 1
fi

echo
echo "Database deployed and verified."
