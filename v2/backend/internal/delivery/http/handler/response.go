// Package handler adapts use cases to HTTP. It is the only layer that knows
// about status codes, cookies, or JSON encoding.
package handler

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"io"
	"log/slog"
	"net/http"

	"bni-visitor/internal/delivery/http/middleware"
	"bni-visitor/internal/domain"
	"bni-visitor/internal/platform/session"
	"bni-visitor/internal/usecase"
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

// DecodeOptional is Decode for a request whose body may legitimately be absent,
// leaving dst at its zero value.
//
// The renewal endpoint documents its body as optional — "no date given means
// renew for a year" — and then rejected an empty body with 400, because an
// empty stream is io.EOF to the decoder. The simplest possible call, renew this
// member, was the one that did not work.
//
// Only an entirely empty body is forgiven. Malformed JSON, or a body with a
// field nobody recognises, is still refused: a typo in a field name that was
// silently ignored would look like a successful call that changed nothing.
func DecodeOptional(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) {
			return nil
		}
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

// ActorFrom turns the verified session into the audit actor. Built here so no
// handler has to remember which fields the log needs.
func ActorFrom(ctx context.Context) usecase.Actor {
	p, ok := middleware.SessionFrom(ctx)
	if !ok {
		return usecase.Actor{}
	}
	return usecase.Actor{ID: p.Sub, Name: p.Email, Role: p.Role}
}

// PageWindow bounds a limit/offset pair coming off the query string. The use
// cases clamp their own windows; this exists for the handlers that talk to a
// repository directly, so no route can be talked into reading a whole table.
//
// Malformed input is treated as unset rather than rejected — a stray query
// parameter should not fail a read.
func PageWindow(limitRaw, offsetRaw string) (int, int) {
	const (
		defaultLimit = 50
		maxLimit     = 200
		maxOffset    = 100_000
	)
	limit := atoi(limitRaw)
	if limit <= 0 || limit > maxLimit {
		limit = defaultLimit
	}
	offset := atoi(offsetRaw)
	if offset < 0 {
		offset = 0
	}
	// A deep offset makes Postgres walk every row it skips, so an unbounded one
	// is a cheap way to make the database do expensive work.
	if offset > maxOffset {
		offset = maxOffset
	}
	return limit, offset
}

// PathID reads a uuid path segment.
//
// A segment that is not a uuid cannot name a row, so it is a miss, not a server
// error. Left to Postgres it becomes SQLSTATE 22P02 — a 500, and a log line
// holding whatever the caller put in the URL. Checking the shape here means the
// query is never issued at all.
func PathID(r *http.Request, key string) (string, error) {
	raw := chi.URLParam(r, key)
	if _, err := uuid.Parse(raw); err != nil {
		return "", domain.ErrNotFound
	}
	return raw, nil
}
