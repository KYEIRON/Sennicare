#!/usr/bin/env bash
# Start a local PostgreSQL instance for BOYD'S integration tests.
#
# BOYD'S row level security is the authoritative authorisation boundary, so it
# is tested against a real database rather than mocked. This script starts one.
#
# In normal development, `supabase start` (Docker) provides the same thing plus
# the rest of the Supabase stack. This exists so the security tests can run
# anywhere PostgreSQL is installed, including CI without Docker.
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-/var/lib/postgresql/boydsdata}"
PGPORT="${PGPORT:-54322}"
PGSOCKET="${PGSOCKET:-/tmp}"

if [ ! -d "${PGDATA}/base" ]; then
  echo "Initialising PostgreSQL cluster at ${PGDATA}"
  mkdir -p "${PGDATA}"
  chown -R postgres:postgres "$(dirname "${PGDATA}")"
  chmod 700 "${PGDATA}"
  su postgres -c "${PGBIN}/initdb -D ${PGDATA} -U postgres --auth=trust"
fi

if su postgres -c "${PGBIN}/pg_ctl -D ${PGDATA} status" >/dev/null 2>&1; then
  echo "PostgreSQL already running on port ${PGPORT}."
else
  su postgres -c "${PGBIN}/pg_ctl -D ${PGDATA} -o '-p ${PGPORT} -k ${PGSOCKET}' -l ${PGDATA}/server.log start"
fi
