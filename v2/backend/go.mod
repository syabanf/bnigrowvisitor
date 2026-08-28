module bni-visitor

go 1.26.4

// Pinned above the language version: govulncheck flagged seven standard-library
// vulnerabilities reachable from this code in 1.26.4, two of them in crypto/tls
// and net/http. All are fixed in 1.26.6.
toolchain go1.26.6

require (
	github.com/go-chi/chi/v5 v5.3.2
	github.com/go-chi/cors v1.2.2
	github.com/go-chi/httprate v0.16.0
	github.com/jackc/pgx/v5 v5.10.0
	golang.org/x/crypto v0.55.0
)

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/klauspost/cpuid/v2 v2.2.10 // indirect
	github.com/zeebo/xxh3 v1.0.2 // indirect
	golang.org/x/sync v0.22.0 // indirect
	golang.org/x/sys v0.47.0 // indirect
	golang.org/x/text v0.41.0 // indirect
)
