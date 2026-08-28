package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/usecase"
)

type MCQAHandler struct{ visitors *usecase.VisitorUsecase }

func NewMCQAHandler(visitors *usecase.VisitorUsecase) *MCQAHandler {
	return &MCQAHandler{visitors: visitors}
}

// List returns the visitors far enough along the funnel to have an airtime
// result, so the MCQA screen never shows someone who has not attended.
func (h *MCQAHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	scope, _, err := ScopeFrom(r.Context(), q.Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}

	status := q.Get("status")
	if status == "" {
		status = string(domain.StatusAttended)
	}

	result, err := h.visitors.List(r.Context(), scope, domain.VisitorFilter{
		Status: status, MeetingID: q.Get("meetingId"), Search: q.Get("q"),
		Limit: atoi(q.Get("limit")), Offset: atoi(q.Get("offset")),
	})
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, result)
}

type airtimeRequest struct {
	// Pointer so an explicit null clears the result, distinct from an absent
	// field. Without that there would be no way to undo a mis-recorded choice.
	Choice *int `json:"attended_choice_number"`
}

func (h *MCQAHandler) Record(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	var req airtimeRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	visitor, err := h.visitors.RecordAirtime(r.Context(), scope, ActorFrom(r.Context()), chi.URLParam(r, "id"), req.Choice)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": visitor})
}

// Choices exposes the label map so the UI does not hard-code its own copy.
func (h *MCQAHandler) Choices(w http.ResponseWriter, r *http.Request) {
	type choice struct {
		Number int    `json:"number"`
		Label  string `json:"label"`
	}
	out := make([]choice, 0, len(domain.AirtimeChoice))
	for n := 1; n <= len(domain.AirtimeChoice); n++ {
		if label, ok := domain.AirtimeChoice[n]; ok {
			out = append(out, choice{Number: n, Label: label})
		}
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": out})
}
