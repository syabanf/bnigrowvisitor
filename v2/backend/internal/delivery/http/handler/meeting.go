package handler

import (
	"net/http"

	"bni-visitor/internal/domain"
)

type MeetingHandler struct {
	meetings domain.MeetingRepository
	chapters domain.ChapterRepository
}

func NewMeetingHandler(meetings domain.MeetingRepository, chapters domain.ChapterRepository) *MeetingHandler {
	return &MeetingHandler{meetings: meetings, chapters: chapters}
}

func (h *MeetingHandler) List(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	limit, offset := PageWindow(r.URL.Query().Get("limit"), r.URL.Query().Get("offset"))
	filter := domain.MeetingFilter{
		Search: r.URL.Query().Get("q"), Limit: limit, Offset: offset,
	}

	total, err := h.meetings.Count(r.Context(), scope, filter)
	if err != nil {
		WriteError(w, err)
		return
	}
	meetings, err := h.meetings.List(r.Context(), scope, filter)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{
		"data": meetings, "total": total, "limit": limit, "offset": offset,
	})
}

type meetingRequest struct {
	Title       string `json:"title"`
	MeetingDate string `json:"meeting_date"`
	Location    string `json:"location"`
}

func (h *MeetingHandler) Create(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	var req meetingRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}

	date := parseDate(req.MeetingDate)
	if req.Title == "" || date == nil {
		WriteError(w, domain.ErrValidation)
		return
	}
	// A chapter-bound caller cannot choose the chapter; a national one without
	// a selection has nothing to attach the meeting to.
	if scope.ChapterID == nil {
		WriteError(w, domain.ErrValidation)
		return
	}

	m := &domain.Meeting{
		ChapterID: *scope.ChapterID, Title: req.Title,
		MeetingDate: *date, Location: req.Location,
	}
	if err := h.meetings.Create(r.Context(), m); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusCreated, map[string]any{"data": m})
}

func (h *MeetingHandler) Update(w http.ResponseWriter, r *http.Request) {
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
	existing, err := h.meetings.FindByID(r.Context(), id)
	if err != nil {
		WriteError(w, err)
		return
	}
	// Load-then-authorise, same as every other write path.
	if !scope.Allows(existing.ChapterID) {
		WriteError(w, domain.ErrForbidden)
		return
	}

	var req meetingRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	if req.Title != "" {
		existing.Title = req.Title
	}
	if date := parseDate(req.MeetingDate); date != nil {
		existing.MeetingDate = *date
	}
	existing.Location = req.Location

	if err := h.meetings.Update(r.Context(), existing); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": existing})
}

func (h *MeetingHandler) Delete(w http.ResponseWriter, r *http.Request) {
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
	existing, err := h.meetings.FindByID(r.Context(), id)
	if err != nil {
		WriteError(w, err)
		return
	}
	if !scope.Allows(existing.ChapterID) {
		WriteError(w, domain.ErrForbidden)
		return
	}
	if err := h.meetings.Delete(r.Context(), existing.ID); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}
