package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"bni-visitor/internal/usecase"
)

// PublicHandler serves the endpoints that must work without a session: the
// attendance confirmation a visitor opens from a WhatsApp link.
type PublicHandler struct{ visitors *usecase.VisitorUsecase }

func NewPublicHandler(visitors *usecase.VisitorUsecase) *PublicHandler {
	return &PublicHandler{visitors: visitors}
}

type confirmResponse struct {
	Status  string `json:"status"`
	Name    string `json:"name,omitempty"`
	Meeting string `json:"meeting,omitempty"`
}

// Confirm marks a visitor as confirmed. The only credential is the visitor id
// in the URL, which is a v4 UUID — not guessable, and the action is narrow and
// idempotent, so there is nothing to escalate to.
//
// The response deliberately carries no phone, email or notes: anyone holding
// the link can call it, so it must not become a way to read a visitor's record.
func (h *PublicHandler) Confirm(w http.ResponseWriter, r *http.Request) {
	visitor, changed, err := h.visitors.ConfirmAttendance(r.Context(), chi.URLParam(r, "token"))
	if err != nil {
		// Includes not-found, which is the right answer for a bad or expired
		// link — and says nothing about whether the id exists.
		WriteError(w, err)
		return
	}

	status := "already"
	if changed {
		status = "confirmed"
	}
	WriteJSON(w, http.StatusOK, confirmResponse{
		Status:  status,
		Name:    visitor.Name,
		Meeting: visitor.MeetingName,
	})
}
