package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"

	"bni-visitor/internal/domain"
)

type apiKeyCtxKey int

const apiKeyKey apiKeyCtxKey = iota

// RequireAPIKey authenticates a machine caller on the external API.
//
// Deliberately separate from the session middleware: an integration has no
// cookie, no chapter and no user, so reusing the session path would mean
// inventing a fake identity for it. The two never mix — a browser cookie cannot
// reach these routes and a key cannot reach the internal ones.
func RequireAPIKey(keys domain.APIKeyRepository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			presented := extractKey(r)
			if presented == "" {
				writeStatus(w, http.StatusUnauthorized, "API key wajib disertakan.")
				return
			}

			// Hash before lookup: the database stores only the digest, so the
			// plaintext is never compared and never logged.
			sum := sha256.Sum256([]byte(presented))
			key, err := keys.FindByHash(r.Context(), hex.EncodeToString(sum[:]))
			if err != nil {
				// One message for "no such key", "deactivated" and "expired".
				// Distinguishing them would tell an attacker which guesses were
				// close.
				writeStatus(w, http.StatusUnauthorized, "API key tidak valid.")
				return
			}

			// Best-effort bookkeeping; a failure here must not fail the request.
			_ = keys.TouchLastUsed(r.Context(), key.ID)

			ctx := context.WithValue(r.Context(), apiKeyKey, key)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireScope gates one route on what the key is allowed to do. Applied per
// route rather than once for the whole mount, because reading members and
// recording a renewal are not the same permission — collapsing them is how
// "readonly" came to mean "refused everywhere".
func RequireScope(required domain.APIScope) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key, ok := APIKeyFrom(r.Context())
			if !ok {
				writeStatus(w, http.StatusUnauthorized, "API key wajib disertakan.")
				return
			}
			if !domain.APIScope(key.Scope).Allows(required) {
				// Names what was needed. Unlike an authentication failure there
				// is nothing to protect here — the caller already holds a valid
				// key, and telling them which scope the route wants is the
				// difference between a fixable error and a mystery.
				writeStatus(w, http.StatusForbidden,
					"Scope API key tidak mencukupi: butuh '"+string(required)+"'.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func APIKeyFrom(ctx context.Context) (*domain.APIKey, bool) {
	k, ok := ctx.Value(apiKeyKey).(*domain.APIKey)
	return k, ok
}

// extractKey accepts either an Authorization: Bearer header or X-API-Key.
// Bearer is the convention most HTTP clients already handle; the dedicated
// header is what integrations built against the previous app were using.
func extractKey(r *http.Request) string {
	if auth := r.Header.Get("Authorization"); auth != "" {
		if token, found := strings.CutPrefix(auth, "Bearer "); found {
			return strings.TrimSpace(token)
		}
	}
	return strings.TrimSpace(r.Header.Get("X-API-Key"))
}
