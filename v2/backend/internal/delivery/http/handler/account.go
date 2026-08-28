package handler

import (
	"net/http"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/usecase"
)

type AccountHandler struct{ accounts *usecase.AccountUsecase }

func NewAccountHandler(accounts *usecase.AccountUsecase) *AccountHandler {
	return &AccountHandler{accounts: accounts}
}

// ListPICs is open to any signed-in user in the chapter: assigning a visitor
// requires seeing who is available, and the list is already scope-limited.
func (h *AccountHandler) ListPICs(w http.ResponseWriter, r *http.Request) {
	scope, _, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	pics, err := h.accounts.ListPICs(r.Context(), scope)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": pics})
}

func (h *AccountHandler) List(w http.ResponseWriter, r *http.Request) {
	scope, sess, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	users, err := h.accounts.List(r.Context(), scope, domain.Role(sess.Role))
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"data": users})
}

type accountRequest struct {
	Name      string `json:"name"`
	Email     string `json:"email"`
	Password  string `json:"password"`
	Role      string `json:"role"`
	Phone     string `json:"phone"`
	ChapterID string `json:"chapter_id"`
}

func (h *AccountHandler) Create(w http.ResponseWriter, r *http.Request) {
	scope, sess, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	var req accountRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	user, err := h.accounts.Create(r.Context(), scope, domain.Role(sess.Role), sess.OrganizationID,
		usecase.AccountInput{
			Name: req.Name, Email: req.Email, Password: req.Password,
			Role: req.Role, Phone: req.Phone, ChapterID: req.ChapterID,
		})
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusCreated, map[string]any{"data": user})
}

type passwordRequest struct {
	Password string `json:"password"`
}

func (h *AccountHandler) SetPassword(w http.ResponseWriter, r *http.Request) {
	scope, sess, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	var req passwordRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	id, err := PathID(r, "id")
	if err != nil {
		WriteError(w, err)
		return
	}
	if err := h.accounts.SetPassword(r.Context(), scope, domain.Role(sess.Role),
		id, req.Password); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

type activeRequest struct {
	IsActive bool `json:"is_active"`
}

func (h *AccountHandler) SetActive(w http.ResponseWriter, r *http.Request) {
	scope, sess, err := ScopeFrom(r.Context(), r.URL.Query().Get("chapterId"))
	if err != nil {
		WriteError(w, err)
		return
	}
	var req activeRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	id, err := PathID(r, "id")
	if err != nil {
		WriteError(w, err)
		return
	}
	if err := h.accounts.SetActive(r.Context(), scope, domain.Role(sess.Role),
		id, req.IsActive); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (h *AccountHandler) ChangeOwnPassword(w http.ResponseWriter, r *http.Request) {
	sess, ok := SessionFrom(r.Context())
	if !ok {
		WriteError(w, domain.ErrForbidden)
		return
	}
	var req changePasswordRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}
	if err := h.accounts.ChangeOwnPassword(r.Context(), sess.Sub,
		req.CurrentPassword, req.NewPassword); err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}
