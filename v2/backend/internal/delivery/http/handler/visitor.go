package handler

import (
	"net/http"
	"strconv"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/usecase"
)

type VisitorHandler struct {
	visitors *usecase.VisitorUsecase
}

func NewVisitorHandler(visitors *usecase.VisitorUsecase) *VisitorHandler {
	return &VisitorHandler{visitors: visitors}
}

func (h *VisitorHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	scope, _, err := ScopeFrom(r.Context(), q.Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}

	filter := domain.VisitorFilter{
		Status:    q.Get("status"),
		MeetingID: q.Get("meetingId"),
		PICID:     q.Get("picId"),
		Search:    q.Get("q"),
		Limit:     atoi(q.Get("limit")),
		Offset:    atoi(q.Get("offset")),
	}

	result, err := h.visitors.List(r.Context(), scope, filter)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, result)
}

func (h *VisitorHandler) Get(w http.ResponseWriter, r *http.Request) {
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
	v, err := h.visitors.Get(r.Context(), scope, id)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": v})
}

// Optional fields are pointers so an absent one is distinguishable from one
// sent empty. On update that is the difference between leaving a value alone and
// clearing it — sending only a status used to blank the email, company and
// notes along with it.
//
// Fields a read returns but a write does not accept are declared and ignored.
// The decoder rejects unknown fields, which is right — a mistyped name should
// not be silently dropped — but it meant the list screen could not send a row
// back the way it had received it, and changing a status from the list returned
// 400 every time.
type visitorRequest struct {
	Name          string  `json:"name"`
	Phone         string  `json:"phone"`
	Email         *string `json:"email"`
	BusinessField *string `json:"business_field"`
	Company       *string `json:"company"`
	Gender        *string `json:"gender"`
	ReferralName  *string `json:"referral_name"`
	MeetingID     *string `json:"meeting_id"`
	PICID         *string `json:"pic_id"`
	Status        string  `json:"status"`
	Notes         *string `json:"notes"`
	ChapterID     string  `json:"chapter_id"`

	// Read-only, accepted and discarded so a client may echo a row back.
	ID          string  `json:"id"`
	ChapterName string  `json:"chapter_name"`
	MeetingName string  `json:"meeting_name"`
	MeetingDate *string `json:"meeting_date"`
	PICName     string  `json:"pic_name"`
	CreatedBy   *string `json:"created_by"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`

	AttendedChoiceNumber *int   `json:"attended_choice_number"`
	AttendedChoiceNote   string `json:"attended_choice_note"`
}

func (r visitorRequest) toInput() usecase.VisitorInput {
	return usecase.VisitorInput{
		Name: r.Name, Phone: r.Phone, Email: r.Email, BusinessField: r.BusinessField,
		Company: r.Company, Gender: r.Gender, ReferralName: r.ReferralName,
		MeetingID: r.MeetingID, PICID: r.PICID, Status: r.Status,
		Notes: r.Notes, ChapterID: r.ChapterID,
	}
}

func (h *VisitorHandler) Create(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}

	var req visitorRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}

	v, err := h.visitors.Create(r.Context(), scope, ActorFrom(r.Context()), req.toInput())
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusCreated, map[string]any{"data": v})
}

func (h *VisitorHandler) Update(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}

	var req visitorRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}

	id, idErr := PathID(r, "id")
	if idErr != nil {
		WriteError(w, idErr)
		return
	}
	v, err := h.visitors.Update(r.Context(), scope, ActorFrom(r.Context()), id, req.toInput())
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": v})
}

func (h *VisitorHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
	if err := h.visitors.Delete(r.Context(), scope, ActorFrom(r.Context()), id); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// atoi treats malformed input as "unset" and lets the use case apply its own
// default, rather than failing the request over a stray query parameter.
func atoi(s string) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return n
}
