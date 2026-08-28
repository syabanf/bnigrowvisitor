package handler

import (
	"net/http"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/usecase"
)

type DashboardHandler struct{ dashboard *usecase.DashboardUsecase }

func NewDashboardHandler(dashboard *usecase.DashboardUsecase) *DashboardHandler {
	return &DashboardHandler{dashboard: dashboard}
}

func (h *DashboardHandler) Chapter(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	data, err := h.dashboard.Chapter(r.Context(), scope)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, data)
}

func (h *DashboardHandler) National(w http.ResponseWriter, r *http.Request) {
	sess, ok := SessionFrom(r.Context())
	if !ok {
		WriteError(w, domain.ErrForbidden)
		return
	}
	// Guarded at the edge: the national view aggregates every chapter, so a
	// chapter-bound account must not reach it at all.
	if !domain.Role(sess.Role).IsNational() {
		WriteError(w, domain.ErrForbidden)
		return
	}
	data, err := h.dashboard.National(r.Context())
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, data)
}
