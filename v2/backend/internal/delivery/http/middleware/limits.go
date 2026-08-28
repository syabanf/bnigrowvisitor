package middleware

import (
	"net/http"
	"strings"
)

// DefaultMaxBody bounds a JSON request. Only the CSV upload was capped before,
// so every other endpoint would read an arbitrarily large body into memory
// before any handler had a chance to reject it.
const DefaultMaxBody = 1 << 20 // 1 MiB

// LimitBody caps the request body for state-changing requests. Routes that
// legitimately accept more — the CSV import — set their own larger limit, which
// replaces this one because MaxBytesReader wraps whatever body it is given.
func LimitBody(maxBytes int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Body == nil || isSafeMethod(r.Method) {
				next.ServeHTTP(w, r)
				return
			}
			// Multipart uploads are sized by their own route; wrapping them here
			// too would cap them at the smaller of the two.
			if strings.HasPrefix(r.Header.Get("Content-Type"), "multipart/form-data") {
				next.ServeHTTP(w, r)
				return
			}
			r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
			next.ServeHTTP(w, r)
		})
	}
}
