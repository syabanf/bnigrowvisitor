package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

func TestSecurityHeaders(t *testing.T) {
	rec := httptest.NewRecorder()
	SecurityHeaders(okHandler()).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))

	want := map[string]string{
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options":        "DENY",
		"Referrer-Policy":        "no-referrer",
		// Chapter-scoped responses must never sit in a shared cache.
		"Cache-Control": "no-store",
	}
	for header, value := range want {
		if got := rec.Header().Get(header); got != value {
			t.Errorf("%s = %q, want %q", header, got, value)
		}
	}
	if rec.Header().Get("Content-Security-Policy") == "" {
		t.Error("CSP header missing")
	}
}

func TestRequireSameOrigin(t *testing.T) {
	allowed := []string{"http://localhost:8095", "http://localhost:5173"}
	guard := RequireSameOrigin(allowed, "development")(okHandler())

	tests := []struct {
		name       string
		method     string
		origin     string
		referer    string
		wantStatus int
	}{
		// Reads are not state-changing, so CSRF does not apply to them.
		{"GET is never blocked", http.MethodGet, "https://penyerang.example", "", http.StatusOK},
		{"HEAD is never blocked", http.MethodHead, "https://penyerang.example", "", http.StatusOK},
		{"OPTIONS is never blocked", http.MethodOptions, "https://penyerang.example", "", http.StatusOK},

		{"POST from the app is allowed", http.MethodPost, "http://localhost:8095", "", http.StatusOK},
		{"POST from the dev server is allowed", http.MethodPost, "http://localhost:5173", "", http.StatusOK},

		// The attack this exists to stop.
		{"POST from another site is refused", http.MethodPost, "https://penyerang.example", "", http.StatusForbidden},
		{"PATCH from another site is refused", http.MethodPatch, "https://penyerang.example", "", http.StatusForbidden},
		{"DELETE from another site is refused", http.MethodDelete, "https://penyerang.example", "", http.StatusForbidden},

		// Some clients omit Origin on same-origin requests; Referer is the
		// fallback, and its origin is what gets checked.
		{"falls back to Referer", http.MethodPost, "", "http://localhost:8095/visitors", http.StatusOK},
		{"a foreign Referer is refused", http.MethodPost, "", "https://penyerang.example/x", http.StatusForbidden},

		// A write with neither header is refused. It used to pass, on the
		// reasoning that only a non-browser caller omits both — but that makes
		// the guard depend on the absence of a header, so anything that strips
		// Origin in transit disables it silently. Server-to-server callers use
		// the key-authenticated API, which this middleware does not cover.
		{"no Origin and no Referer is refused", http.MethodPost, "", "", http.StatusForbidden},
		{"a GET with neither header still passes", http.MethodGet, "", "", http.StatusOK},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, "/api/visitors", nil)
			if tc.origin != "" {
				req.Header.Set("Origin", tc.origin)
			}
			if tc.referer != "" {
				req.Header.Set("Referer", tc.referer)
			}

			rec := httptest.NewRecorder()
			guard.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tc.wantStatus)
			}
		})
	}
}

func TestOriginOf(t *testing.T) {
	tests := []struct{ in, want string }{
		{"http://localhost:8095/visitors?a=1", "http://localhost:8095"},
		{"https://Grow.BNI-VH.com/path", "https://grow.bni-vh.com"},
		{"not a url", ""},
		{"", ""},
	}
	for _, tc := range tests {
		if got := originOf(tc.in); got != tc.want {
			t.Errorf("originOf(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

// The message a rejected browser sees. This check blocks real users far more
// often than attackers — a deployment reached on a hostname nobody added to
// CORS_ORIGIN cannot log in at all — so outside production it has to say which
// origin was refused and where to fix it, not just that something was refused.
func TestRejectedOriginMessageIsActionableOutsideProduction(t *testing.T) {
	allowed := []string{"http://localhost:8095"}

	dev := rejectionMessage("http://bni-vh.example.id", allowed, "development")
	if !strings.Contains(dev, "http://bni-vh.example.id") {
		t.Errorf("pesan development harus menyebut origin yang ditolak: %q", dev)
	}
	if !strings.Contains(dev, "CORS_ORIGIN") {
		t.Errorf("pesan development harus menyebut knob yang memperbaikinya: %q", dev)
	}

	// In production it stays terse: the allowlist is configuration, and the
	// caller already knows their own origin, so naming it buys nothing there.
	prod := rejectionMessage("http://bni-vh.example.id", allowed, "production")
	if strings.Contains(prod, "CORS_ORIGIN") || strings.Contains(prod, "localhost:8095") {
		t.Errorf("pesan production tidak boleh membocorkan konfigurasi: %q", prod)
	}
}
