package handler

import (
	"net/http"

	"bni-visitor/internal/usecase"
)

type TenantHandler struct{ tenant *usecase.TenantUsecase }

func NewTenantHandler(tenant *usecase.TenantUsecase) *TenantHandler {
	return &TenantHandler{tenant: tenant}
}

// Context is public by design: the login screen needs chapter branding before a
// session exists. It exposes names only.
func (h *TenantHandler) Context(w http.ResponseWriter, r *http.Request) {
	// Behind the nginx proxy the original host arrives in X-Forwarded-Host;
	// r.Host would be the internal service name.
	host := r.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = r.Host
	}

	ctx, err := h.tenant.Resolve(r.Context(), host)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, ctx)
}
