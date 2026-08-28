package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/usecase"
)

type GovernanceHandler struct{ governance *usecase.GovernanceUsecase }

func NewGovernanceHandler(governance *usecase.GovernanceUsecase) *GovernanceHandler {
	return &GovernanceHandler{governance: governance}
}

// role pulls the caller's role from the verified session. The use case is what
// enforces the national gate; this only supplies the input for it.
func role(r *http.Request) domain.Role {
	if p, ok := SessionFrom(r.Context()); ok {
		return domain.Role(p.Role)
	}
	return ""
}

func (h *GovernanceHandler) Master(w http.ResponseWriter, r *http.Request) {
	data, err := h.governance.Master(r.Context(), role(r))
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, data)
}

type cityRequest struct {
	OrganizationID string `json:"organization_id"`
	Name           string `json:"name"`
}

func (h *GovernanceHandler) CreateCity(w http.ResponseWriter, r *http.Request) {
	var req cityRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	c, err := h.governance.CreateCity(r.Context(), role(r), req.OrganizationID, req.Name)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusCreated, map[string]any{"data": c})
}

type areaRequest struct {
	CityID string `json:"city_id"`
	Name   string `json:"name"`
}

func (h *GovernanceHandler) CreateArea(w http.ResponseWriter, r *http.Request) {
	var req areaRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	a, err := h.governance.CreateArea(r.Context(), role(r), req.CityID, req.Name)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusCreated, map[string]any{"data": a})
}

type chapterRequest struct {
	AreaID      string `json:"area_id"`
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
}

func (h *GovernanceHandler) CreateChapter(w http.ResponseWriter, r *http.Request) {
	var req chapterRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	c, err := h.governance.CreateChapter(r.Context(), role(r), req.AreaID, req.Name, req.DisplayName)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusCreated, map[string]any{"data": c})
}

func (h *GovernanceHandler) SetChapterActive(w http.ResponseWriter, r *http.Request) {
	var req activeRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	if err := h.governance.SetChapterActive(r.Context(), role(r), chi.URLParam(r, "id"), req.IsActive); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *GovernanceHandler) Policies(w http.ResponseWriter, r *http.Request) {
	policies, err := h.governance.Policies(r.Context(), role(r))
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{
		"data": policies, "types": domain.KnownPolicyTypes,
	})
}

type policyRequest struct {
	PolicyType string          `json:"policy_type"`
	ChapterID  *string         `json:"chapter_id"`
	Config     json.RawMessage `json:"config"`
}

func (h *GovernanceHandler) SavePolicy(w http.ResponseWriter, r *http.Request) {
	var req policyRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	p, err := h.governance.SavePolicy(r.Context(), role(r), req.PolicyType, req.ChapterID, req.Config)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": p})
}

func (h *GovernanceHandler) APIKeys(w http.ResponseWriter, r *http.Request) {
	keys, err := h.governance.APIKeys(r.Context(), role(r))
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": keys})
}

type apiKeyRequest struct {
	Name  string `json:"name"`
	Scope string `json:"scope"`
}

func (h *GovernanceHandler) CreateAPIKey(w http.ResponseWriter, r *http.Request) {
	var req apiKeyRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	key, err := h.governance.CreateAPIKey(r.Context(), role(r), req.Name, req.Scope)
	if err != nil {
		WriteError(w, err)
		return
	}
	// The plaintext is present on this response and nowhere else, ever.
	WriteJSON(w, http.StatusCreated, map[string]any{"data": key})
}

func (h *GovernanceHandler) SetAPIKeyActive(w http.ResponseWriter, r *http.Request) {
	var req activeRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	if err := h.governance.SetAPIKeyActive(r.Context(), role(r), chi.URLParam(r, "id"), req.IsActive); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *GovernanceHandler) DeleteAPIKey(w http.ResponseWriter, r *http.Request) {
	if err := h.governance.DeleteAPIKey(r.Context(), role(r), chi.URLParam(r, "id")); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *GovernanceHandler) Logins(w http.ResponseWriter, r *http.Request) {
	logins, err := h.governance.RecentLogins(r.Context(), role(r), atoi(r.URL.Query().Get("limit")))
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": logins, "total": len(logins)})
}
