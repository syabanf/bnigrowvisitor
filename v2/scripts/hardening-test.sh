#!/usr/bin/env bash
#
# Hardening test: probes the running stack for the failure modes that matter for
# a multi-tenant app — someone reading another chapter's data, granting
# themselves a role, replaying a forged session, or making the database do
# expensive work on request.
#
# Every check asserts an outcome rather than printing a response, so a
# regression fails the run instead of scrolling past. Read-only apart from the
# accounts it tries (and expects) to fail to create.
#
#   ./scripts/hardening-test.sh [base-url]     default http://localhost:8095
set -uo pipefail

BASE=${1:-http://localhost:8095}
API="$BASE/api"
JAR=$(mktemp -d)
trap 'rm -rf "$JAR"' EXIT

pass=0; fail=0
ok()   { pass=$((pass+1)); printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  \033[31mFAIL\033[0m  %s\n' "$1"; }
head() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# expect <label> <expected-codes...> -- <curl args...>
expect() {
  local label=$1; shift
  local codes=()
  while [ "$1" != "--" ]; do codes+=("$1"); shift; done
  shift
  local got; got=$(curl -s -o /dev/null -w '%{http_code}' "$@")
  for c in "${codes[@]}"; do
    if [ "$got" = "$c" ]; then ok "$label ($got)"; return; fi
  done
  bad "$label — expected ${codes[*]}, got $got"
}

login() { # login <email> <jar-name>
  local code
  code=$(curl -s -D "$JAR/$2.hdr" -c "$JAR/$2" -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' -H "Origin: $BASE" \
    -d "{\"email\":\"$1\",\"password\":\"demo123\"}" -o /dev/null -w '%{http_code}')
  printf '%s' "$code"
}

as() { local jar=$1; shift; curl -s -b "$JAR/$jar" -H "Origin: $BASE" "$@"; }

printf '\033[1mHardening test\033[0m  →  %s\n' "$BASE"

for who in national grow rise pic; do
  code=$(login "$who@demo.test" "$who.jar")
  [ "$code" = "200" ] || { echo "cannot log in as $who@demo.test ($code) — is the stack seeded?"; exit 1; }
done

# --------------------------------------------------------------------------
head 'Authentication'

for path in /auth/me /visitors /members /guests /activity /accounts /api-keys \
            /policies /master /governance/logins /dashboard/chapter /meetings; do
  expect "unauthenticated $path is refused" 401 -- "$API$path"
done

# A signature that does not verify must be rejected outright. Accepting a
# tampered cookie would mean the payload — including the role — is attacker-
# controlled.
sess=$(awk '/session/ {print $7}' "$JAR/grow.jar")
expect 'forged session signature is refused' 401 -- \
  "$API/auth/me" -H "Cookie: session=${sess%.*}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
expect 'session payload swapped for another is refused' 401 -- \
  "$API/auth/me" -H 'Cookie: session=eyJ1aWQiOiJhZG1pbiIsInJvbGUiOiJuYXRpb25hbCJ9.x'
expect 'empty session cookie is refused' 401 -- "$API/auth/me" -H 'Cookie: session='

# --------------------------------------------------------------------------
head 'CSRF'

expect 'write from a foreign Origin is refused' 403 -- \
  -X POST "$API/visitors" -b "$JAR/grow.jar" \
  -H 'Origin: https://evil.example' -H 'Content-Type: application/json' \
  -d '{"name":"CSRF","phone":"08120000000"}'
expect 'write with no Origin or Referer is refused' 403 -- \
  -X POST "$API/visitors" -b "$JAR/grow.jar" \
  -H 'Content-Type: application/json' -d '{"name":"CSRF","phone":"08120000000"}'
expect 'read from a foreign Origin is allowed (no state change)' 200 -- \
  "$API/visitors" -b "$JAR/grow.jar" -H 'Origin: https://evil.example'

# --------------------------------------------------------------------------
head 'Tenant isolation'

rise_id=$(as rise.jar "$API/visitors?limit=1" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
grow_id=$(as grow.jar "$API/visitors?limit=1" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

expect "chapter A cannot read chapter B's visitor by id" 403 404 -- \
  "$API/visitors/$rise_id" -b "$JAR/grow.jar"
expect "chapter A cannot modify chapter B's visitor" 403 404 -- \
  -X PATCH "$API/visitors/$rise_id" -b "$JAR/grow.jar" -H "Origin: $BASE" \
  -H 'Content-Type: application/json' -d '{"name":"hijacked","phone":"0812","status":"new"}'
expect "chapter A cannot delete chapter B's visitor" 403 404 -- \
  -X DELETE "$API/visitors/$rise_id" -b "$JAR/grow.jar" -H "Origin: $BASE"
expect 'chapterId query cannot cross scope' 200 403 -- \
  "$API/visitors?chapterId=00000000-0000-0000-0000-000000000000" -b "$JAR/grow.jar"

# The list must not merely hide other chapters in the UI — the rows must not be
# in the response at all.
if as grow.jar "$API/visitors?limit=200" | grep -q "$rise_id"; then
  bad "chapter B's visitor leaks into chapter A's list"
else
  ok "chapter list contains only its own rows"
fi

# --------------------------------------------------------------------------
head 'Privilege escalation'

expect 'chapter admin cannot reach national dashboard' 403 -- \
  "$API/dashboard/national" -b "$JAR/grow.jar"
expect 'chapter admin cannot list API keys' 403 -- "$API/api-keys" -b "$JAR/grow.jar"
expect 'chapter admin cannot read master data' 403 -- "$API/master" -b "$JAR/grow.jar"
expect 'chapter admin cannot read the login audit' 403 -- \
  "$API/governance/logins" -b "$JAR/grow.jar"
expect 'PIC cannot list accounts' 403 -- "$API/accounts" -b "$JAR/pic.jar"

expect 'chapter admin cannot mint a national account' 400 403 422 -- \
  -X POST "$API/accounts" -b "$JAR/grow.jar" -H "Origin: $BASE" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Esc","email":"esc1@x.test","password":"Str0ngPassphrase!","role":"national"}'
expect 'PIC cannot create an account at all' 403 -- \
  -X POST "$API/accounts" -b "$JAR/pic.jar" -H "Origin: $BASE" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Esc","email":"esc2@x.test","password":"Str0ngPassphrase!","role":"pic"}'
# Creating a PIC inside your own chapter is a chapter admin's job, so a 201 is
# the right answer here. What must not happen is the account landing in the
# chapter the request named. Asserting the status code alone called this a
# failure when the behaviour was correct — the placement is the thing to check.
own=$(as grow.jar "$API/auth/me" | sed -n 's/.*"chapter_id":"\([^"]*\)".*/\1/p')
foreign=$(as rise.jar "$API/auth/me" | sed -n 's/.*"chapter_id":"\([^"]*\)".*/\1/p')
planted=$(as grow.jar -X POST "$API/accounts" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Plant Probe\",\"email\":\"plantprobe@x.test\",\"password\":\"Str0ngPassphrase!\",\"role\":\"pic\",\"chapter_id\":\"$foreign\"}")
landed=$(printf '%s' "$planted" | sed -n 's/.*"chapter_id":"\([^"]*\)".*/\1/p')
if [ "$landed" = "$own" ]; then
  ok 'account created by a chapter admin stays in their own chapter'
elif [ "$landed" = "$foreign" ]; then
  bad 'chapter admin planted an account in another chapter'
else
  ok "cross-chapter account creation refused outright"
fi
probe_user=$(printf '%s' "$planted" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[ -n "$probe_user" ] && as national.jar -X DELETE "$API/accounts/$probe_user" -o /dev/null

# Mass assignment: a client-supplied chapter_id on a create must not move the
# row out of the caller's chapter.
planted=$(as grow.jar -X POST "$API/visitors" -H 'Content-Type: application/json' \
  -d '{"name":"Mass Assign Probe","phone":"081299990001","status":"new","chapter_id":"00000000-0000-0000-0000-000000000000"}')
if echo "$planted" | grep -q '00000000-0000-0000-0000-000000000000'; then
  bad 'client-supplied chapter_id was honoured on create'
else
  ok 'client-supplied chapter_id is ignored on create'
fi
probe_id=$(echo "$planted" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[ -n "$probe_id" ] && as grow.jar -X DELETE "$API/visitors/$probe_id" -o /dev/null

# --------------------------------------------------------------------------
head 'Injection'

for payload in "' OR '1'='1" "'; DROP TABLE visitors; --" "1' UNION SELECT null,null--" \
               "%27%20OR%201%3D1--" "\\'; SELECT pg_sleep(5); --"; do
  enc=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$payload")
  expect "SQL payload in ?q is handled: ${payload:0:22}" 200 -- \
    "$API/visitors?q=$enc" -b "$JAR/grow.jar"
done
expect 'SQL payload in ?status is handled' 200 400 -- \
  "$API/visitors?status=%27%20OR%201%3D1--" -b "$JAR/grow.jar"
expect 'malformed uuid in a path is handled' 400 404 -- \
  "$API/visitors/not-a-uuid" -b "$JAR/grow.jar"

# The table must still be there afterwards.
expect 'visitors table survived the injection probes' 200 -- \
  "$API/visitors?limit=1" -b "$JAR/grow.jar"

# JSON is not HTML, but the content type is what stops a stored payload from
# ever being parsed as markup by a browser that follows a link to the API.
ctype=$(curl -s -o /dev/null -w '%{content_type}' -b "$JAR/grow.jar" "$API/visitors?limit=1")
case "$ctype" in
  application/json*) ok "list responds as $ctype" ;;
  *) bad "list responds as $ctype, not application/json" ;;
esac
if curl -s -I -b "$JAR/grow.jar" "$API/visitors?limit=1" | grep -qi 'x-content-type-options: *nosniff'; then
  ok 'X-Content-Type-Options: nosniff present'
else
  bad 'X-Content-Type-Options: nosniff missing'
fi

# --------------------------------------------------------------------------
head 'Resource limits'

big=$(python3 -c 'print("x"*1500)')
expect 'over-long search term is handled, not fatal' 200 400 414 -- \
  "$API/visitors?q=$big" -b "$JAR/grow.jar"

n=$(as grow.jar "$API/visitors?limit=999999" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["data"]))')
if [ "$n" -le 200 ]; then ok "limit=999999 is clamped to $n rows"; else bad "limit=999999 returned $n rows"; fi
n=$(as grow.jar "$API/visitors?limit=-5" | python3 -c 'import sys,json;print(len(json.load(sys.stdin)["data"]))')
if [ "$n" -le 200 ]; then ok "negative limit is clamped to $n rows"; else bad "negative limit returned $n rows"; fi
expect 'absurd offset is clamped, not an error' 200 -- \
  "$API/visitors?offset=99999999999" -b "$JAR/grow.jar"

payload=$(python3 -c 'print("{\"name\":\"" + "a"*3000000 + "\"}")')
code=$(printf '%s' "$payload" | curl -s -o /dev/null -w '%{http_code}' -X POST "$API/visitors" \
  -b "$JAR/grow.jar" -H "Origin: $BASE" -H 'Content-Type: application/json' --data-binary @-)
case "$code" in
  413|400|422) ok "3MB request body is refused ($code)" ;;
  *) bad "3MB request body returned $code" ;;
esac

# --------------------------------------------------------------------------
head 'Rate limiting'

hits=0; limited=0
for _ in $(seq 1 25); do
  c=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' -H "Origin: $BASE" \
    -d '{"email":"ratelimit@demo.test","password":"nope"}')
  hits=$((hits+1)); [ "$c" = "429" ] && limited=$((limited+1))
done
if [ "$limited" -gt 0 ]; then
  ok "login flood throttled ($limited of $hits returned 429)"
else
  bad "login flood was never throttled ($hits attempts, no 429)"
fi

# --------------------------------------------------------------------------
head 'Session cookie'

# Read from the headers saved by the login at the top of the run, not from a
# fresh one: by this point the rate-limit probe above has used up the login
# allowance, and a 429 carries no cookie at all — which reads exactly like "no
# flags set". Capturing it into a variable inside login() did not work either,
# since login() runs in a $( ) subshell and the assignment dies with it. Both
# mistakes reported a correctly-configured cookie as insecure.
SETCOOKIE=$(grep -i '^set-cookie:' "$JAR/grow.jar.hdr")
if [ -z "$SETCOOKIE" ]; then bad 'no Set-Cookie header was captured'; fi
case "$SETCOOKIE" in *[Hh]ttp[Oo]nly*) ok 'session cookie is HttpOnly' ;; *) bad 'session cookie is not HttpOnly' ;; esac
case "$SETCOOKIE" in *[Ss]ame[Ss]ite=*) ok 'session cookie sets SameSite' ;; *) bad 'session cookie has no SameSite' ;; esac
case "$SETCOOKIE" in *[Pp]ath=/*) ok 'session cookie is scoped to a path' ;; *) bad 'session cookie has no Path' ;; esac
case "$BASE" in
  https://*)
    case "$SETCOOKIE" in *[Ss]ecure*) ok 'session cookie is Secure over https' ;; *) bad 'session cookie is not Secure over https' ;; esac ;;
  *)
    case "$SETCOOKIE" in
      *[Ss]ecure*) bad 'session cookie is Secure over plain http — the browser will drop it' ;;
      *) ok 'session cookie omits Secure over plain http (correct for this scheme)' ;;
    esac ;;
esac

# --------------------------------------------------------------------------
head 'External API'

expect 'external API without a key is refused' 401 -- "$BASE/external/v1/members"
expect 'external API with a bogus key is refused' 401 -- \
  "$BASE/external/v1/members" -H 'X-API-Key: bnik_deadbeefdeadbeefdeadbeef'
expect 'external API rejects a session cookie as a key' 401 -- \
  "$BASE/external/v1/members" -b "$JAR/grow.jar"

# --------------------------------------------------------------------------
head 'Transport headers'

hdrs=$(curl -s -I "$BASE/")
for h in x-frame-options x-content-type-options referrer-policy content-security-policy; do
  if echo "$hdrs" | grep -qi "^$h:"; then ok "$h present"; else bad "$h missing"; fi
done
if echo "$hdrs" | grep -qi '^server: *nginx/[0-9]'; then
  bad 'Server header leaks the nginx version'
else
  ok 'Server header does not leak a version'
fi

expect 'path traversal on static assets is refused' 400 403 404 -- \
  "$BASE/../../etc/passwd" --path-as-is
expect 'dotfile under the web root is not served' 403 404 -- "$BASE/.env"

# --------------------------------------------------------------------------
head 'Error responses'

body=$(curl -s "$API/visitors/00000000-0000-0000-0000-000000000000" -b "$JAR/grow.jar")
if echo "$body" | grep -qiE 'pgx|postgres|sql:|goroutine|/go/|panic'; then
  bad "error body leaks internals: $(echo "$body" | head -c 120)"
else
  ok 'error body carries no stack trace or driver detail'
fi

# Any account a probe managed to create is removed, so a second run starts from
# the same state as the first.
for stray in esc1@x.test esc2@x.test esc3@x.test plantprobe@x.test; do
  sid=$(as national.jar "$API/accounts?limit=200" \
    | python3 -c "import sys,json;print(next((u['id'] for u in json.load(sys.stdin)['data'] if u['email']=='$stray'), ''))" 2>/dev/null)
  [ -n "$sid" ] && as national.jar -X DELETE "$API/accounts/$sid" -o /dev/null
done

printf '\n\033[1m%d passed, %d failed\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
