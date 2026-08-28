package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/usecase"
)

type MessagingHandler struct{ messaging *usecase.MessagingUsecase }

func NewMessagingHandler(messaging *usecase.MessagingUsecase) *MessagingHandler {
	return &MessagingHandler{messaging: messaging}
}

func (h *MessagingHandler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	templates, err := h.messaging.ListTemplates(r.Context(), scope)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": templates})
}

type templateRequest struct {
	Name      string `json:"name"`
	Body      string `json:"body"`
	IsDefault bool   `json:"is_default"`
}

func (h *MessagingHandler) SaveTemplate(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	var req templateRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	// An empty id means create; chi gives "" on the collection route.
	t, err := h.messaging.SaveTemplate(r.Context(), scope, chi.URLParam(r, "id"), req.Name, req.Body, req.IsDefault)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": t})
}

func (h *MessagingHandler) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	if err := h.messaging.DeleteTemplate(r.Context(), scope, chi.URLParam(r, "id")); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *MessagingHandler) Blast(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	scope, _, err := ScopeFrom(r.Context(), q.Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}

	templateID := q.Get("templateId")
	if templateID == "" {
		WriteError(w, domain.ErrValidation)
		return
	}

	messages, err := h.messaging.BuildBlast(r.Context(), scope, templateID, domain.VisitorFilter{
		Status: q.Get("status"), MeetingID: q.Get("meetingId"), PICID: q.Get("picId"),
		Limit: atoi(q.Get("limit")),
	})
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": messages, "total": len(messages)})
}
