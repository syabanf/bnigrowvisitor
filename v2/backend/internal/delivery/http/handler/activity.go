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
	q := r.URL.Query()
	scope, _, err := ScopeFrom(r.Context(), q.Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}

	limit, offset := PageWindow(q.Get("limit"), q.Get("offset"))
	filter := domain.ActivityFilter{
		Action: q.Get("action"),
		Entity: q.Get("entity"),
		Limit:  limit,
		Offset: offset,
	}

	// Counted before the page is read so an insert landing between the two
	// cannot make the total smaller than the rows already on screen.
	total, err := h.logs.Count(r.Context(), scope, filter)
	if err != nil {
		WriteError(w, err)
		return
	}
	logs, err := h.logs.List(r.Context(), scope, filter)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{
		"data": logs, "total": total, "limit": limit, "offset": offset,
	})
}
