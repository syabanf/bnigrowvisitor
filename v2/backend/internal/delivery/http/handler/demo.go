package handler

import (
	"net/http"

	"bni-visitor/internal/usecase"
)

type DemoHandler struct{ demo *usecase.DemoUsecase }

func NewDemoHandler(demo *usecase.DemoUsecase) *DemoHandler {
	return &DemoHandler{demo: demo}
}

// Accounts lists the seeded sign-in accounts.
//
// Unauthenticated by necessity — it feeds the login screen — and therefore
// gated on demo mode, which is off unless a deployment turns it on. Publishing
// working credentials is exactly right for a demo and exactly wrong anywhere
// else, so the switch is explicit rather than inferred.
func (h *DemoHandler) Accounts(w http.ResponseWriter, r *http.Request) {
	accounts, err := h.demo.List(r.Context())
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, accounts)
}
