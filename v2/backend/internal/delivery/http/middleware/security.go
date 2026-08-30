package middleware

import (
	"fmt"
	"log/slog"
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
func RequireSameOrigin(allowed []string, environment string) func(http.Handler) http.Handler {
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
				slog.Warn("permintaan write tanpa Origin maupun Referer ditolak",
					"method", r.Method, "path", r.URL.Path)
				forbidden(w, "Origin tidak diizinkan.")
				return
			}

			if !slices.Contains(allowed, origin) {
				// Logged with both sides every time. This check blocks real
				// users far more often than attackers — a deployment reached
				// on a hostname nobody added to CORS_ORIGIN cannot log in at
				// all — and "Origin tidak diizinkan" on its own says neither
				// which origin was rejected nor where to fix it.
				slog.Warn("origin ditolak oleh penjaga CSRF",
					"origin", origin, "diizinkan", allowed, "path", r.URL.Path)
				forbidden(w, rejectionMessage(origin, allowed, environment))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// rejectionMessage names the problem outside production.
//
// The origin is the caller's own, so telling them it was rejected reveals
// nothing they did not send; naming the allowlist does say something about the
// configuration, which is why the detailed form is kept out of production. The
// server log always has both.
func rejectionMessage(origin string, allowed []string, environment string) string {
	if environment == "production" {
		return "Origin tidak diizinkan."
	}
	return fmt.Sprintf(
		"Origin %s tidak ada di daftar izin. Tambahkan ke CORS_ORIGIN (sekarang: %s), lalu jalankan ulang API.",
		origin, strings.Join(allowed, ", "))
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
