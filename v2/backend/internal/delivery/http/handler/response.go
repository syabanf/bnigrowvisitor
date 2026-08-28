// Package handler adapts use cases to HTTP. It is the only layer that knows
// about status codes, cookies, or JSON encoding.
package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"bni-visitor/internal/delivery/http/middleware"
	"bni-visitor/internal/domain"
	"bni-visitor/internal/platform/session"
)

func WriteJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if body == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(body); err != nil {
		// The status line is already sent, so there is nothing to correct —
		// record it and move on.
		slog.Error("gagal menulis response", "err", err)
	}
}

type errorBody struct {
	Error string `json:"error"`
}

// WriteError is the single mapping from domain failures to HTTP status codes.
// Keeping it in one function is what stops handlers from inventing their own
// codes for the same condition.
func WriteError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		WriteJSON(w, http.StatusNotFound, errorBody{err.Error()})
	case errors.Is(err, domain.ErrInvalidCredential):
		WriteJSON(w, http.StatusUnauthorized, errorBody{err.Error()})
	case errors.Is(err, domain.ErrForbidden), errors.Is(err, domain.ErrNoChapterScope):
		WriteJSON(w, http.StatusForbidden, errorBody{err.Error()})
	case errors.Is(err, domain.ErrValidation):
		WriteJSON(w, http.StatusBadRequest, errorBody{err.Error()})
	case errors.Is(err, domain.ErrConflict):
		WriteJSON(w, http.StatusConflict, errorBody{err.Error()})
	default:
		// Unexpected failures are logged in full but reported generically:
		// driver messages can carry table names and query fragments.
		slog.Error("unhandled error", "err", err)
		WriteJSON(w, http.StatusInternalServerError, errorBody{"Terjadi kesalahan pada server."})
	}
}

// Decode rejects unknown fields so a typo in a client payload surfaces as a
// 400 instead of being silently dropped.
func Decode(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return domain.ErrValidation
	}
	return nil
}

func SessionFrom(ctx context.Context) (*session.Payload, bool) {
	return middleware.SessionFrom(ctx)
}

func ScopeFrom(ctx context.Context, requested string) (domain.Scope, *session.Payload, error) {
	return middleware.ScopeFrom(ctx, requested)
}
