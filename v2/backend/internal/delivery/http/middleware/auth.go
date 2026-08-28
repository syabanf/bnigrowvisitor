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
func RequireSession(sm *session.Manager) func(http.Handler) http.Handler {
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
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusUnauthorized)
	json.NewEncoder(w).Encode(map[string]string{"error": "Tidak ada sesi."})
}
