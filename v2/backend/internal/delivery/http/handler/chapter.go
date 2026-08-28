package handler

import (
	"net/http"

	"bni-visitor/internal/domain"
)

type ChapterHandler struct {
	chapters domain.ChapterRepository
	meetings domain.MeetingRepository
}

func NewChapterHandler(chapters domain.ChapterRepository, meetings domain.MeetingRepository) *ChapterHandler {
	return &ChapterHandler{chapters: chapters, meetings: meetings}
}

func (h *ChapterHandler) List(w http.ResponseWriter, r *http.Request) {
	sess, ok := SessionFrom(r.Context())
	if !ok {
		WriteError(w, domain.ErrForbidden)
		return
	}

	all, err := h.chapters.List(r.Context())
	if err != nil {
		WriteError(w, err)
		return
	}

	// A chapter-bound account sees only its own chapter in the picker; sending
	// the full list would leak the names of every other chapter.
	if !domain.Role(sess.Role).IsNational() {
		filtered := make([]domain.Chapter, 0, 1)
		for _, c := range all {
			if sess.ChapterID != nil && c.ID == *sess.ChapterID {
				filtered = append(filtered, c)
			}
		}
		all = filtered
	}

	WriteJSON(w, http.StatusOK, map[string]any{"data": all})
}

func (h *ChapterHandler) ListMeetings(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	meetings, err := h.meetings.List(r.Context(), scope)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": meetings})
}
