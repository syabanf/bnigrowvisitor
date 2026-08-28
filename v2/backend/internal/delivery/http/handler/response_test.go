package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"bni-visitor/internal/domain"
)

// WriteError is the single place domain failures become status codes. If two
// handlers ever answered differently for the same condition, it would be
// because someone bypassed this — so the mapping is pinned here.
func TestWriteErrorStatusMapping(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
	}{
		{"not found", domain.ErrNotFound, http.StatusNotFound},
		{"bad credentials", domain.ErrInvalidCredential, http.StatusUnauthorized},
		{"forbidden", domain.ErrForbidden, http.StatusForbidden},
		{"no chapter scope is a refusal, not a server error", domain.ErrNoChapterScope, http.StatusForbidden},
		{"validation", domain.ErrValidation, http.StatusBadRequest},
		{"conflict", domain.ErrConflict, http.StatusConflict},
		{"anything else", errors.New("boom"), http.StatusInternalServerError},

		// Wrapped errors must map the same way, or adding context to an error
		// silently turns a 400 into a 500.
		{"wrapped validation", fmt.Errorf("konteks: %w", domain.ErrValidation), http.StatusBadRequest},
		{"wrapped forbidden", fmt.Errorf("konteks: %w", domain.ErrForbidden), http.StatusForbidden},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			WriteError(rec, tc.err)
			if rec.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d", rec.Code, tc.wantStatus)
			}
			if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/json") {
				t.Errorf("Content-Type = %q, want JSON", ct)
			}
		})
	}
}

// An unexpected error must not leak the driver's message: those carry table
// names and query fragments.
func TestWriteErrorHidesInternalDetail(t *testing.T) {
	rec := httptest.NewRecorder()
	WriteError(rec, errors.New(`pq: relation "users" does not exist`))

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(body["error"], "users") || strings.Contains(body["error"], "relation") {
		t.Errorf("internal detail leaked to the client: %q", body["error"])
	}
}

func TestDecodeRejectsUnknownFields(t *testing.T) {
	type payload struct {
		Name string `json:"name"`
	}

	// A typo in a client payload should surface as a 400, not be dropped so
	// quietly that nobody notices the field never arrived.
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"nmae":"Budi"}`))
	var dst payload
	if err := Decode(req, &dst); err != domain.ErrValidation {
		t.Errorf("err = %v, want ErrValidation", err)
	}

	ok := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"Budi"}`))
	if err := Decode(ok, &dst); err != nil {
		t.Errorf("a valid body should decode: %v", err)
	}
	if dst.Name != "Budi" {
		t.Errorf("Name = %q", dst.Name)
	}
}

func TestDecodeRejectsMalformedJSON(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{ not json`))
	var dst struct{}
	if err := Decode(req, &dst); err != domain.ErrValidation {
		t.Errorf("err = %v, want ErrValidation", err)
	}
}

func TestWriteJSONSetsStatusAndBody(t *testing.T) {
	rec := httptest.NewRecorder()
	WriteJSON(rec, http.StatusCreated, map[string]string{"id": "abc"})

	if rec.Code != http.StatusCreated {
		t.Errorf("status = %d", rec.Code)
	}
	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["id"] != "abc" {
		t.Errorf("body = %v", body)
	}
}
