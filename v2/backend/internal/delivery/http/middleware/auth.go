// Package middleware holds cross-cutting HTTP concerns.
package middleware

import (
	"context"
	"encoding/json"
	"net/http"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/platform/session"
)

type ctxKey int

const sessionKey ctxKey = iota

// RequireSession rejects anything without a valid signed cookie before the
// request reaches a handler, so no handler has to remember to check.
//
// Verifying the signature is not enough: it proves we issued the token, not
// that the account is still allowed in. The validator lookup is what makes
// deactivating a user take effect immediately instead of whenever their cookie
// happens to expire. It is one indexed primary-key read on an already-open
// pool; caching it would trade correctness (a stale allow) for a saving this
// app's scale does not need.
func RequireSession(sm *session.Manager, validator domain.SessionValidator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(session.CookieName)
			if err != nil {
				unauthorized(w)
				return
			}
			payload, err := sm.Verify(cookie.Value)
			if err != nil {
				unauthorized(w)
				return
			}

			user, err := validator.ActiveUser(r.Context(), payload.Sub)
			if err != nil {
				unauthorized(w)
				return
			}

			// Re-read the role and chapter from the database rather than
			// trusting the copy inside the token: a demotion or a chapter move
			// must bite straight away, and the token still carries whatever was
			// true when it was minted.
			payload.Role = string(user.Role)
			payload.ChapterID = user.ChapterID
			payload.OrganizationID = user.OrganizationID

			ctx := context.WithValue(r.Context(), sessionKey, payload)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func SessionFrom(ctx context.Context) (*session.Payload, bool) {
	p, ok := ctx.Value(sessionKey).(*session.Payload)
	return p, ok
}

// ScopeFrom derives the caller's permitted chapter scope. requested is client
// input; ResolveScope decides whether it is allowed to matter.
func ScopeFrom(ctx context.Context, requested string) (domain.Scope, *session.Payload, error) {
	p, ok := SessionFrom(ctx)
	if !ok {
		return domain.Scope{}, nil, domain.ErrForbidden
	}
	scope, err := domain.ResolveScope(domain.Role(p.Role), p.ChapterID, p.OrganizationID, requested)
	return scope, p, err
}

func unauthorized(w http.ResponseWriter) {
	writeStatus(w, http.StatusUnauthorized, "Tidak ada sesi.")
}

func forbidden(w http.ResponseWriter, message string) {
	writeStatus(w, http.StatusForbidden, message)
}

func writeStatus(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
