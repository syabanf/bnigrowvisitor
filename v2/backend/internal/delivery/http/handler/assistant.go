package handler

import (
	"net/http"

	"bni-visitor/internal/usecase"
)

type AssistantHandler struct{ assistant *usecase.AssistantUsecase }

func NewAssistantHandler(assistant *usecase.AssistantUsecase) *AssistantHandler {
	return &AssistantHandler{assistant: assistant}
}

// Status lets the UI say up front whether answers will come from a model or
// from the numbers, rather than the user discovering it from the first reply.
func (h *AssistantHandler) Status(w http.ResponseWriter, r *http.Request) {
	WriteJSON(w, http.StatusOK, map[string]any{
		"configured": h.assistant.Configured(),
		"name":       h.assistant.Name(),
	})
}

type assistantRequest struct {
	Question string                  `json:"question"`
	History  []usecase.AssistantTurn `json:"history"`
}

func (h *AssistantHandler) Ask(w http.ResponseWriter, r *http.Request) {
	scope, sess, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}

	var req assistantRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}

	answer, err := h.assistant.Ask(r.Context(), scope, sess.Email, sess.Role, req.Question, req.History)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, answer)
}
