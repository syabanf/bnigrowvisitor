package handler

import (
	"net/http"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/usecase"
)

type APIDocsHandler struct{ baseURL string }

func NewAPIDocsHandler(baseURL string) *APIDocsHandler {
	return &APIDocsHandler{baseURL: baseURL}
}

// Docs describes the external API.
//
// Behind a session and national-only: it names the base URL and the shape of
// every endpoint, which is reference material for whoever holds a key, not
// something to publish to anyone who asks.
func (h *APIDocsHandler) Docs(w http.ResponseWriter, r *http.Request) {
	if !role(r).IsNational() {
		WriteError(w, domain.ErrForbidden)
		return
	}
	WriteJSON(w, http.StatusOK, usecase.BuildAPIDocs(h.baseURL))
}
