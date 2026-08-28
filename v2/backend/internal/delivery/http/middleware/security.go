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
				// Referer is a fallback, not a reliable one: this API answers
				// with Referrer-Policy: no-referrer, so a browser sends none.
				// It is read anyway for clients that ignore that.
				origin = originOf(r.Header.Get("Referer"))
			}

			// No Origin and no Referer is refused rather than waved through.
			// The earlier reasoning — that only a non-browser caller omits
			// Origin, and CSRF cannot target one — holds for browsers as they
			// behave today, but it makes the guard depend on the absence of a
			// header: anything that strips Origin in transit, a corporate
			// proxy or a privacy extension, turns the check off silently.
			//
			// Nothing legitimate lands here. Every browser sends Origin on a
			// cross-origin state change, and on a same-origin one too since
			// 2020. A server-to-server caller has the key-authenticated API
			// under /external, which this middleware does not cover.
			if origin == "" {
				forbidden(w, "Origin tidak diizinkan.")
				return
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
