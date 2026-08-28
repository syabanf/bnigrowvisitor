package handler

import (
	"errors"
	"net/http"
	"strconv"

	"bni-visitor/internal/usecase"
)

type NarrationHandler struct{ narration *usecase.NarrationUsecase }

func NewNarrationHandler(narration *usecase.NarrationUsecase) *NarrationHandler {
	return &NarrationHandler{narration: narration}
}

type narrationRequest struct {
	Text string `json:"text"`
}

// Speak proxies one line of tour text to the speech provider.
//
// A session is required: without it this is an open text-to-speech service
// billed to someone else's account.
func (h *NarrationHandler) Speak(w http.ResponseWriter, r *http.Request) {
	var req narrationRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}

	result, err := h.narration.Speak(r.Context(), req.Text)
	if err != nil {
		if errors.Is(err, usecase.ErrNarrationUnavailable) {
			// 501, not 500: the client reads this as "use the browser voice"
			// and stops asking for the rest of the session.
			WriteJSON(w, http.StatusNotImplemented, map[string]string{"error": "narration_unavailable"})
			return
		}
		WriteError(w, err)
		return
	}

	w.Header().Set("Content-Type", result.ContentType)
	w.Header().Set("Content-Length", strconv.Itoa(len(result.Audio)))
	// Tour lines repeat verbatim as people step back and forth; letting the
	// browser reuse the audio is what stops each replay costing credits.
	// Private because it is session-gated.
	w.Header().Set("Cache-Control", "private, max-age=86400")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(result.Audio)
}

// Status lets the client know whether to bother asking at all.
func (h *NarrationHandler) Status(w http.ResponseWriter, r *http.Request) {
	WriteJSON(w, http.StatusOK, map[string]bool{"available": h.narration.Configured()})
}
