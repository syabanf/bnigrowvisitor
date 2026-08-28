package handler

import (
	"fmt"
	"net/http"
	"time"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/usecase"
)

type TransferHandler struct{ transfer *usecase.TransferUsecase }

func NewTransferHandler(transfer *usecase.TransferUsecase) *TransferHandler {
	return &TransferHandler{transfer: transfer}
}

func (h *TransferHandler) ExportVisitors(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	scope, _, err := ScopeFrom(r.Context(), q.Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}

	filename := usecase.ExportFilename("visitors", time.Now())
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	// Headers are already committed once streaming starts, so a mid-stream
	// failure can only be logged — there is no status code left to change.
	if err := h.transfer.ExportVisitors(r.Context(), scope, domain.VisitorFilter{
		Status: q.Get("status"), MeetingID: q.Get("meetingId"), Search: q.Get("q"),
	}, w); err != nil {
		WriteError(w, err)
	}
}

// maxUploadBytes bounds the request body. Without it, an oversized upload is
// read entirely into the CSV reader before anything rejects it.
const maxUploadBytes = 5 << 20 // 5 MiB

func (h *TransferHandler) ImportVisitors(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	defer r.Body.Close()

	file, _, err := r.FormFile("file")
	if err != nil {
		WriteError(w, fmt.Errorf("%w: file CSV wajib diunggah", domain.ErrValidation))
		return
	}
	defer file.Close()

	result, err := h.transfer.ImportVisitors(r.Context(), scope, ActorFrom(r.Context()), file)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, result)
}
