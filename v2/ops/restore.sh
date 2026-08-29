#!/bin/sh
#
# Restore from a dump written by backup.sh.
#
#   docker compose stop api
#   docker compose run --rm backup /ops/restore.sh                 # newest
#   docker compose run --rm backup /ops/restore.sh <file.sql.gz>   # a specific one
#   docker compose start api
#
# Stop the API first. The dump drops and recreates every table, and the API's
# pooled connections hold prepared statements against the old ones. Restoring
# underneath a running API leaves it in a state where logging in still succeeds
# but the next authenticated request returns 401 — which reads as a permissions
# bug, not as the restore that caused it. Observed, not theorised.
#
# Separate from the backup loop on purpose: a restore is destructive, and a
# backup job that could also restore is one stray environment variable away from
# overwriting the database it exists to protect.
set -eu

DIR=${BACKUP_DIR:-/backups}
file=${1:-}

if [ -z "$file" ]; then
  file=$(ls -1t "$DIR"/bni_visitor-*.sql.gz 2>/dev/null | head -1 || true)
  [ -n "$file" ] || { echo "tidak ada backup di $DIR" >&2; exit 1; }
fi
case "$file" in /*) ;; *) file="$DIR/$file" ;; esac
[ -f "$file" ] || { echo "tidak ada: $file" >&2; exit 1; }

# The dump carries DROP statements, so this replaces what is there. Confirmed
# explicitly rather than assumed: a restore is usually run in an emergency,
# which is exactly when a mistyped filename does the most damage.
echo "Ini akan MENIMPA database '$POSTGRES_DB' di $POSTGRES_HOST dengan:"
echo "  $file ($(wc -c < "$file") bytes)"
printf 'Ketik "ya" untuk lanjut: '
read -r answer
[ "$answer" = "ya" ] || { echo "dibatalkan"; exit 1; }

gunzip -c "$file" | psql -v ON_ERROR_STOP=1 -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB"
echo "restore selesai dari $(basename "$file")"
echo
echo "Restart API-nya sekarang kalau tadi tidak dihentikan:"
echo "  docker compose restart api"
echo "Koneksi yang masih hidup memegang prepared statement ke tabel yang barusan"
echo "diganti; tanpa restart, login tetap berhasil tapi request setelahnya 401."
