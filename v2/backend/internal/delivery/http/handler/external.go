package handler

import (
	"net/http"
	"time"

	"bni-visitor/internal/domain"
)

// ExternalHandler serves the machine-facing API that finance integrations use.
//
// Its responses are deliberately narrower than the internal ones: an
// integration needs membership status and renewal dates, not phone numbers,
// notes, or who referred whom.
type ExternalHandler struct {
	members domain.MemberRepository
}

func NewExternalHandler(members domain.MemberRepository) *ExternalHandler {
	return &ExternalHandler{members: members}
}

type externalMember struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	ChapterID   string     `json:"chapter_id"`
	ChapterName string     `json:"chapter_name,omitempty"`
	Status      string     `json:"status"`
	JoinedDate  *time.Time `json:"joined_date,omitempty"`
	RenewalDate *time.Time `json:"renewal_date,omitempty"`
	IsOverdue   bool       `json:"is_overdue"`
}

func toExternal(m domain.Member, now time.Time) externalMember {
	return externalMember{
		ID: m.ID, Name: m.Name, ChapterID: m.ChapterID, ChapterName: m.ChapterName,
		Status: string(m.Status), JoinedDate: m.JoinedDate, RenewalDate: m.RenewalDate,
		// Derived rather than stored, so it can never disagree with the date
		// it is derived from.
		IsOverdue: m.RenewalDate != nil && m.RenewalDate.Before(now),
	}
}

func (h *ExternalHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	// A key is not tied to a chapter, so the scope is national by construction.
	// It is still an explicit Scope value rather than an empty one, because
	// "national" is a decision, not an accident.
	scope := domain.Scope{IsNational: true}

	filter := domain.MemberFilter{
		Status: q.Get("status"),
		Search: q.Get("q"),
		Limit:  atoi(q.Get("limit")),
		Offset: atoi(q.Get("offset")),
	}
	if filter.Limit <= 0 || filter.Limit > 200 {
		filter.Limit = 100
	}

	members, err := h.members.List(r.Context(), scope, filter)
	if err != nil {
		WriteError(w, err)
		return
	}
	total, err := h.members.Count(r.Context(), scope, filter)
	if err != nil {
		WriteError(w, err)
		return
	}

	now := time.Now()
	out := make([]externalMember, 0, len(members))
	for _, m := range members {
		out = append(out, toExternal(m, now))
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"data": out, "total": total, "limit": filter.Limit, "offset": filter.Offset,
	})
}

func (h *ExternalHandler) GetMember(w http.ResponseWriter, r *http.Request) {
	id, idErr := PathID(r, "id")
	if idErr != nil {
		WriteError(w, idErr)
		return
	}
	member, err := h.members.FindByID(r.Context(), id)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": toExternal(*member, time.Now())})
}

type renewalRequest struct {
	// YYYY-MM-DD. Optional: omitted means "renewed today, next due in a year".
	RenewalDate string `json:"renewal_date"`
}

// Renew records a completed membership renewal. This is the write the finance
// integration exists for, which is why the key's scope is checked at the route.
func (h *ExternalHandler) Renew(w http.ResponseWriter, r *http.Request) {
	id, idErr := PathID(r, "id")
	if idErr != nil {
		WriteError(w, idErr)
		return
	}
	member, err := h.members.FindByID(r.Context(), id)
	if err != nil {
		WriteError(w, err)
		return
	}

	var req renewalRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}

	now := time.Now()
	next := parseDate(req.RenewalDate)
	if next == nil {
		// Extend from whichever is later: renewing early must not shorten the
		// membership, and renewing late must not backdate it.
		base := now
		if member.RenewalDate != nil && member.RenewalDate.After(now) {
			base = *member.RenewalDate
		}
		extended := base.AddDate(1, 0, 0)
		next = &extended
	}

	member.RenewalDate = next
	member.LastRenewedAt = &now
	member.Status = domain.MemberActive

	if err := h.members.Update(r.Context(), member); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": toExternal(*member, now)})
}
