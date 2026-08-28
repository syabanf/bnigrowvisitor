package handler

import (
	"net/http"

	"bni-visitor/internal/domain"
)

type ActivityHandler struct{ logs domain.ActivityLogRepository }

func NewActivityHandler(logs domain.ActivityLogRepository) *ActivityHandler {
	return &ActivityHandler{logs: logs}
}

func (h *ActivityHandler) List(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}

	limit := atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	logs, err := h.logs.List(r.Context(), scope, limit)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": logs, "total": len(logs)})
}
