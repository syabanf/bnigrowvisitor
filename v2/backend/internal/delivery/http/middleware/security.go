package middleware

import (
	"net/http"
	"net/url"
	"slices"
	"strings"
)

// SecurityHeaders sets the defaults a JSON API should never be without. The
// API serves no HTML, so the CSP can be maximally restrictive.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
		// Nothing here belongs in a shared cache, and several endpoints return
		// chapter-scoped data that must never be served to another session.
		h.Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

// RequireSameOrigin is the CSRF guard for state-changing requests.
//
// SameSite=Lax already blocks cross-site POSTs from a plain form, but it is one
// browser default away from being the only defence, and it does nothing for a
// sibling subdomain. Checking the Origin against the same allowlist CORS uses
// closes that without a token round-trip, because the browser sets Origin on
// every cross-origin state-changing request and a page cannot forge it.
func RequireSameOrigin(allowed []string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isSafeMethod(r.Method) {
				next.ServeHTTP(w, r)
				return
			}

			origin := r.Header.Get("Origin")
			if origin == "" {
				// Same-origin fetches from some clients omit Origin; fall back
				// to Referer, and allow the request only if neither is present
				// (a non-browser caller such as curl, which CSRF cannot target).
				if ref := r.Header.Get("Referer"); ref != "" {
					origin = originOf(ref)
				} else {
					next.ServeHTTP(w, r)
					return
				}
			}

			if !slices.Contains(allowed, origin) {
				forbidden(w, "Origin tidak diizinkan.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func isSafeMethod(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	}
	return false
}

func originOf(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return ""
	}
	return strings.ToLower(u.Scheme + "://" + u.Host)
}
