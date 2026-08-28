package handler

import (
	"net/http"
	"strings"
	"time"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/platform/session"
	"bni-visitor/internal/usecase"
)

type AuthHandler struct {
	auth     *usecase.AuthUsecase
	sessions *session.Manager
	secure   bool
}

func NewAuthHandler(auth *usecase.AuthUsecase, sessions *session.Manager, secure bool) *AuthHandler {
	return &AuthHandler{auth: auth, sessions: sessions, secure: secure}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := Decode(r, &req); err != nil {
		WriteError(w, err)
		return
	}

	user, err := h.auth.Login(r.Context(), usecase.LoginInput{
		Email: req.Email, Password: req.Password,
		IP: clientIP(r), UserAgent: r.UserAgent(),
	})
	if err != nil {
		WriteError(w, err)
		return
	}

	token, err := h.sessions.Issue(session.Payload{
		Sub: user.ID, Email: user.Email, Role: string(user.Role),
		ChapterID: user.ChapterID, OrganizationID: user.OrganizationID,
	})
	if err != nil {
		WriteError(w, err)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:  session.CookieName,
		Value: token,
		Path:  "/",
		// HttpOnly keeps the token away from any script on the page, so an XSS
		// bug cannot exfiltrate a live session.
		HttpOnly: true,
		Secure:   h.secure,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(h.sessions.MaxAge()),
		MaxAge:   int(h.sessions.MaxAge().Seconds()),
	})

	WriteJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name: session.CookieName, Value: "", Path: "/",
		HttpOnly: true, Secure: h.secure, SameSite: http.SameSiteLaxMode, MaxAge: -1,
	})
	WriteJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	payload, ok := SessionFrom(r.Context())
	if !ok {
		WriteError(w, domain.ErrForbidden)
		return
	}
	user, err := h.auth.Me(r.Context(), payload.Sub)
	if err != nil {
		WriteError(w, err)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]any{"user": user})
}

// clientIP prefers the proxy header but takes only the first hop; the rest of
// an X-Forwarded-For chain is attacker-controlled.
func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		if first, _, found := strings.Cut(fwd, ","); found {
			return strings.TrimSpace(first)
		}
		return strings.TrimSpace(fwd)
	}
	host, _, found := strings.Cut(r.RemoteAddr, ":")
	if !found {
		return r.RemoteAddr
	}
	return host
}
