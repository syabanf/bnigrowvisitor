#!/bin/sh
#
# Scheduled logical backup. Runs as its own container so pg_dump matches the
# server version — a dump taken by an older client can fail to restore, and an
# incident is the wrong time to discover that.
set -eu

DIR=${BACKUP_DIR:-/backups}
KEEP_DAYS=${BACKUP_KEEP_DAYS:-14}
EVERY=${BACKUP_INTERVAL_SECONDS:-86400}

mkdir -p "$DIR"

dump_once() {
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  target="$DIR/bni_visitor-$stamp.sql.gz"
  # Written under a temporary name and renamed only on success. A dump
  # interrupted midway would otherwise sit in the directory looking exactly like
  # a good one, and be the newest thing a restore picks.
  partial="$target.partial"

  if pg_dump --no-owner --no-privileges --clean --if-exists \
       -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     | gzip -9 > "$partial"
  then
    mv "$partial" "$target"
    echo "$(date -u +%FT%TZ) backup ok: $(basename "$target") ($(wc -c < "$target") bytes)"
  else
    rm -f "$partial"
    echo "$(date -u +%FT%TZ) backup GAGAL" >&2
    return 1
  fi
}

prune() {
  # Never prune down to nothing. If every backup is older than the window —
  # because the job was stopped for a month — deleting them all leaves no
  # recovery point at all, which is worse than keeping a stale one.
  total=$(find "$DIR" -name 'bni_visitor-*.sql.gz' | wc -l)
  if [ "$total" -le 1 ]; then
    return 0
  fi
  find "$DIR" -name 'bni_visitor-*.sql.gz' -mtime "+$KEEP_DAYS" -print -delete |
    while read -r gone; do
      echo "$(date -u +%FT%TZ) dihapus (>$KEEP_DAYS hari): $(basename "$gone")"
    done
}

echo "$(date -u +%FT%TZ) backup dimulai: tiap ${EVERY}s, simpan ${KEEP_DAYS} hari, tujuan $DIR"

while true; do
  # A failed dump must not kill the loop: a database that is briefly down should
  # cost one backup, not every future one.
  dump_once || true
  prune || true
  sleep "$EVERY"
done
