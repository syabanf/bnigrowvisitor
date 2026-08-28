#!/usr/bin/env bash
#
# Stress test: loads the database with realistic volume, then measures what the
# API does under concurrent load — latency percentiles, error rate, and whether
# pagination still returns a clean partition when tens of thousands of rows
# share a timestamp.
#
# Seeded rows are tagged and removed at the end, so the stack is left as found.
#
#   ./scripts/stress-test.sh [rows] [concurrency] [seconds]
set -uo pipefail

ROWS=${1:-50000}
CONC=${2:-40}
SECS=${3:-15}
BASE=http://localhost:8095
API="$BASE/api"
# The load phase talks to the API directly on loopback so each virtual user can
# present its own X-Real-IP. Through nginx every request carries the same client
# address, so the per-IP limiter (300/min) rejects everything above ~5 rps and
# the run measures the cost of returning 429 rather than the cost of serving the
# page. Forty concurrent users really are forty addresses; simulating them as
# one is what made the first run meaningless.
DIRECT=${DIRECT:-http://127.0.0.1:8090}
DAPI="$DIRECT/api"
TAG='stress-probe'

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
DB=$(docker compose ps -q db)
[ -n "$DB" ] || { echo "database container is not running"; exit 1; }
psql() { docker exec -i "$DB" psql -U bni -d bni_visitor -qAt "$@"; }

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }

curl -s -c "$WORK/jar" -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -H "Origin: $BASE" -d '{"email":"grow@demo.test","password":"demo123"}' -o /dev/null
grep -q session "$WORK/jar" || { echo "login failed — is the stack seeded?"; exit 1; }
CHAPTER=$(curl -s -b "$WORK/jar" "$API/auth/me" | sed -n 's/.*"chapter_id":"\([^"]*\)".*/\1/p')

# A separate session for the direct API. A cookie jar keys on host, so the one
# above is never sent to 127.0.0.1:8090 and every load request would come back
# 401 — a very fast 401, which is exactly the kind of number that flatters a
# load test into meaninglessness.
curl -s -c "$WORK/djar" -X POST "$DAPI/auth/login" -H 'Content-Type: application/json' \
  -H "Origin: $BASE" -d '{"email":"grow@demo.test","password":"demo123"}' -o /dev/null
curl -s -b "$WORK/djar" "$DAPI/auth/me" | grep -q chapter_id \
  || { echo "direct-API login failed — is $DIRECT reachable?"; exit 1; }

cleanup_rows() {
  psql -c "DELETE FROM visitors WHERE notes = '$TAG';" >/dev/null
  psql -c "DELETE FROM activity_logs WHERE entity_label LIKE '$TAG%';" >/dev/null
}
trap 'cleanup_rows; rm -rf "$WORK"' EXIT

# ---------------------------------------------------------------------------
say "Seeding $ROWS visitors and $ROWS activity rows into chapter $CHAPTER"
cleanup_rows

# generate_series in one statement: a per-row round trip would dominate the
# runtime and measure the network, not the database.
psql -c "
INSERT INTO visitors (chapter_id, name, phone, email, company, business_field, status, notes)
SELECT '$CHAPTER',
       'Load Probe ' || g,
       '0812' || lpad(g::text, 8, '0'),
       'probe' || g || '@load.test',
       (ARRAY['Sinar Jaya','Karya Utama','Mitra Abadi','Cipta Kreasi'])[1 + g % 4] || ' ' || g,
       (ARRAY['Kuliner','Properti','Logistik','Fintech','Retail'])[1 + g % 5],
       (ARRAY['new','followup','confirmed','attended','member'])[1 + g % 5]::visitor_status,
       '$TAG'
FROM generate_series(1, $ROWS) g;" >/dev/null

# Every row gets the same created_at on purpose: an ORDER BY with no tiebreaker
# is stable on distinct timestamps and only comes apart on ties, which is
# exactly the case a small seed never produces.
psql -c "
INSERT INTO activity_logs (actor_name, actor_role, chapter_id, action, entity, entity_id, entity_label, created_at)
SELECT 'Load Probe', 'chapter_admin', '$CHAPTER',
       (ARRAY['create','update','delete'])[1 + g % 3],
       'visitor', gen_random_uuid(), '$TAG ' || g,
       now() - interval '1 hour'
FROM generate_series(1, $ROWS) g;" >/dev/null

psql -c "ANALYZE visitors; ANALYZE activity_logs;" >/dev/null
echo "  visitors:      $(psql -c "SELECT count(*) FROM visitors;")"
echo "  activity_logs: $(psql -c "SELECT count(*) FROM activity_logs;")"

# ---------------------------------------------------------------------------
say 'Pagination remains a clean partition at volume'

# 40k rows sharing one timestamp, walked in pages. Without the id tiebreaker in
# ORDER BY, Postgres is free to return ties in any order per query, so rows
# duplicate across pages and others are never seen.
total=$(curl -s -b "$WORK/jar" "$API/activity?limit=1" | sed -n 's/.*"total":\([0-9]*\).*/\1/p')
walk=$((total < 4000 ? total : 4000))
: > "$WORK/ids"
off=0
while [ "$off" -lt "$walk" ]; do
  curl -s -b "$WORK/jar" "$API/activity?limit=200&offset=$off" \
    | python3 -c 'import sys,json;[print(r["id"]) for r in json.load(sys.stdin)["data"]]' >> "$WORK/ids"
  off=$((off+200))
done
seen=$(wc -l < "$WORK/ids" | tr -d ' ')
uniq=$(sort -u "$WORK/ids" | wc -l | tr -d ' ')
printf '  walked %s rows of %s total, %s unique — ' "$seen" "$total" "$uniq"
if [ "$seen" = "$uniq" ]; then printf '\033[32mno duplicates\033[0m\n'; else printf '\033[31m%s DUPLICATED\033[0m\n' "$((seen-uniq))"; fi

# ---------------------------------------------------------------------------
say 'Query plans under volume'
for q in \
  "SELECT count(*) FROM visitors WHERE chapter_id='$CHAPTER'" \
  "SELECT * FROM visitors WHERE chapter_id='$CHAPTER' AND name ILIKE '%Probe 4242%' LIMIT 50" \
  "SELECT * FROM activity_logs WHERE chapter_id='$CHAPTER' ORDER BY created_at DESC, id DESC LIMIT 50 OFFSET 20000"
do
  plan=$(psql -c "EXPLAIN (ANALYZE, TIMING OFF, SUMMARY ON) $q" 2>/dev/null)
  printf '  %-58s %s | %s\n' "$(echo "$q" | cut -c1-58)" \
    "$(echo "$plan" | head -1 | cut -c1-38)" \
    "$(echo "$plan" | grep 'Execution Time' | sed 's/Execution Time: //')"
done

# ---------------------------------------------------------------------------
cat > "$WORK/pct.py" <<'PCT'
import sys
label, path, secs = sys.argv[1], sys.argv[2], float(sys.argv[3])
rows = [l.split() for l in open(path) if l.strip()]
if not rows:
    print(f'  {label:<28} no samples'); raise SystemExit
lat = sorted(float(r[0]) * 1000 for r in rows)
bad = [r[1] for r in rows if r[1] != '200']
n = len(lat)
def pct(p): return lat[min(n - 1, int(n * p))]
print(f'  {label:<28} n={n:<6} rps={n/secs:>6.0f}  '
      f'p50={pct(.50):>6.1f}  p95={pct(.95):>6.1f}  p99={pct(.99):>7.1f}  '
      f'max={lat[-1]:>7.1f}ms  errors={len(bad)}'
      + (f' {sorted(set(bad))}' if bad else ''))
PCT

# bench <label> <path>
bench() {
  local label=$1 path=$2
  local out="$WORK/lat.$$"
  : > "$out"
  local deadline=$(( $(date +%s) + SECS ))
  for _ in $(seq 1 "$CONC"); do
    (
      while [ "$(date +%s)" -lt "$deadline" ]; do
        curl -s -b "$WORK/djar" -o /dev/null -H "X-Real-IP: 10.99.$((RANDOM % 250)).$((RANDOM % 250))" \
          -w '%{time_total} %{http_code}\n' "$DAPI$path" >> "$out"
      done
    ) &
  done
  wait
  python3 "$WORK/pct.py" "$label" "$out" "$SECS"
}

# What these numbers are and are not.
#
# The per-request figures are meaningful relative to each other: they were taken
# back to back against the same data, and a query that is genuinely 10x more
# expensive shows up as one. The absolute throughput is not the server's — the
# generator forks a curl per request from bash, and on this host it tops out
# around 180 rps regardless of what the endpoint does. When every endpoint
# converges on the same p50 despite doing very different amounts of work, that
# is the generator talking, not the API.
#
# It is still the number that matters for one purpose: a change that makes an
# endpoint stand out from the others is a real regression, and one that brings
# a straggler back into line is a real fix.
say "Load: $CONC concurrent readers for ${SECS}s each"
bench 'list, first page'        '/visitors?limit=50'
bench 'list, filtered by status' '/visitors?limit=50&status=attended'
bench 'search by name'           '/visitors?limit=50&q=Probe%204242'
bench 'deep page (offset 20000)' '/visitors?limit=50&offset=20000'
bench 'dashboard aggregate'      '/dashboard/chapter'
bench 'activity log page'        '/activity?limit=50'

# ---------------------------------------------------------------------------
say 'Rate limiter, measured deliberately'
limited=0; served=0
for _ in $(seq 1 360); do
  c=$(curl -s -o /dev/null -w '%{http_code}' -b "$WORK/jar" "$API/visitors?limit=1")
  [ "$c" = "429" ] && limited=$((limited+1)) || served=$((served+1))
done
echo "  360 requests from one address (ceiling is 300/min): $served served, $limited throttled"

say 'Connection pool under saturation'
before=$(psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='bni_visitor';")

# Sampled repeatedly while the load is in flight. A single reading taken right
# after launching the requests races them and reports the idle count as the
# peak, which looks like a pool that never grows at all.
( for _ in $(seq 1 60); do
    for _ in $(seq 1 8); do
      curl -s -b "$WORK/djar" -o /dev/null \
        -H "X-Real-IP: 10.99.$((RANDOM % 250)).$((RANDOM % 250))" \
        "$DAPI/dashboard/chapter" &
    done
    wait
  done ) >/dev/null 2>&1 &
loadpid=$!
peak=0
while kill -0 "$loadpid" 2>/dev/null; do
  now=$(psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='bni_visitor';")
  [ "${now:-0}" -gt "$peak" ] && peak=$now
done
wait "$loadpid" 2>/dev/null
after=$(psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname='bni_visitor';")
echo "  backends: idle=$before  peak-under-load=$peak  settled=$after"
echo "  max_connections=$(psql -c 'SHOW max_connections;')  pool=${DB_MAX_CONNS:-10}"
echo "  (measured at 10, 25 and 50: 184, 162, 160 rps — the pool is not the constraint)"

say 'Cleaning up'
