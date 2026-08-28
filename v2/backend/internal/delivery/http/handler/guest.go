package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/usecase"
)

type GuestHandler struct{ guests *usecase.GuestUsecase }

func NewGuestHandler(guests *usecase.GuestUsecase) *GuestHandler {
	return &GuestHandler{guests: guests}
}

func (h *GuestHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	scope, _, err := ScopeFrom(r.Context(), q.Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	result, err := h.guests.List(r.Context(), scope, domain.GuestFilter{
		MeetingID: q.Get("meetingId"), Search: q.Get("q"),
		Limit: atoi(q.Get("limit")), Offset: atoi(q.Get("offset")),
	})
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, result)
}

type guestRequest struct {
	Name          string  `json:"name"`
	Gender        string  `json:"gender"`
	BusinessField string  `json:"business_field"`
	Company       string  `json:"company"`
	Phone         string  `json:"phone"`
	Email         string  `json:"email"`
	ReferralName  string  `json:"referral_name"`
	MeetingID     *string `json:"meeting_id"`
	VisitDate     string  `json:"visit_date"`
	MeetingFormat string  `json:"meeting_format"`
	SourceType    string  `json:"source_type"`
	Notes         string  `json:"notes"`
	ChapterID     string  `json:"chapter_id"`
}

func (req guestRequest) toInput() usecase.GuestInput {
	return usecase.GuestInput{
		Name: req.Name, Gender: req.Gender, BusinessField: req.BusinessField,
		Company: req.Company, Phone: req.Phone, Email: req.Email,
		ReferralName: req.ReferralName, MeetingID: req.MeetingID,
		VisitDate: parseDate(req.VisitDate), MeetingFormat: req.MeetingFormat,
		SourceType: req.SourceType, Notes: req.Notes, ChapterID: req.ChapterID,
	}
}

func (h *GuestHandler) Get(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	g, err := h.guests.Get(r.Context(), scope, chi.URLParam(r, "id"))
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": g})
}

func (h *GuestHandler) Create(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	var req guestRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	g, err := h.guests.Create(r.Context(), scope, ActorFrom(r.Context()), req.toInput())
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusCreated, map[string]any{"data": g})
}

func (h *GuestHandler) Update(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	var req guestRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	g, err := h.guests.Update(r.Context(), scope, ActorFrom(r.Context()), chi.URLParam(r, "id"), req.toInput())
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": g})
}

func (h *GuestHandler) Delete(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	if err := h.guests.Delete(r.Context(), scope, ActorFrom(r.Context()), chi.URLParam(r, "id")); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}
