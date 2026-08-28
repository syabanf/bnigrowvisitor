package handler

import (
	"net/http"
	"time"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/usecase"
)

type MemberHandler struct{ members *usecase.MemberUsecase }

func NewMemberHandler(members *usecase.MemberUsecase) *MemberHandler {
	return &MemberHandler{members: members}
}

func (h *MemberHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	scope, _, err := ScopeFrom(r.Context(), q.Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}

	result, err := h.members.List(r.Context(), scope, domain.MemberFilter{
		Status: q.Get("status"), Search: q.Get("q"),
		Limit: atoi(q.Get("limit")), Offset: atoi(q.Get("offset")),
	})
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, result)
}

type memberRequest struct {
	Name          string `json:"name"`
	Phone         string `json:"phone"`
	Email         string `json:"email"`
	BusinessField string `json:"business_field"`
	Company       string `json:"company"`
	JoinedDate    string `json:"joined_date"`
	RenewalDate   string `json:"renewal_date"`
	Status        string `json:"status"`
	Notes         string `json:"notes"`
	ChapterID     string `json:"chapter_id"`
}

func (req memberRequest) toInput() usecase.MemberInput {
	return usecase.MemberInput{
		Name: req.Name, Phone: req.Phone, Email: req.Email,
		BusinessField: req.BusinessField, Company: req.Company,
		JoinedDate: parseDate(req.JoinedDate), RenewalDate: parseDate(req.RenewalDate),
		Status: req.Status, Notes: req.Notes, ChapterID: req.ChapterID,
	}
}

func (h *MemberHandler) Get(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	id, idErr := PathID(r, "id")
	if idErr != nil {
		WriteError(w, idErr)
		return
	}
	m, err := h.members.Get(r.Context(), scope, id)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": m})
}

func (h *MemberHandler) Create(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	var req memberRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	m, err := h.members.Create(r.Context(), scope, ActorFrom(r.Context()), req.toInput())
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusCreated, map[string]any{"data": m})
}

func (h *MemberHandler) Update(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	var req memberRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	id, idErr := PathID(r, "id")
	if idErr != nil {
		WriteError(w, idErr)
		return
	}
	m, err := h.members.Update(r.Context(), scope, ActorFrom(r.Context()), id, req.toInput())
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": m})
}

func (h *MemberHandler) Delete(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	id, idErr := PathID(r, "id")
	if idErr != nil {
		WriteError(w, idErr)
		return
	}
	if err := h.members.Delete(r.Context(), scope, ActorFrom(r.Context()), id); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// parseDate accepts a bare YYYY-MM-DD. An unparseable or empty value yields nil
// so "not provided" and "explicitly cleared" stay distinguishable upstream.
func parseDate(s string) *time.Time {
	if s == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &t
}
