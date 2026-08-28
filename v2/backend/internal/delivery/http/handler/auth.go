package handler

import (
	"net"
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

// clientIP resolves the address recorded in the login audit.
//
// X-Forwarded-For is deliberately not consulted. This previously read its
// leftmost entry, on the stated reasoning that the first hop is trustworthy and
// "the rest of the chain is attacker-controlled" — which is backwards. Each
// proxy appends the address it saw, so the rightmost entries are the ones our
// own infrastructure wrote and the leftmost is whatever the client typed. The
// audit was therefore recording an attacker-chosen value, in the one table that
// exists to investigate an attack.
//
// X-Real-IP is safe by contrast because nginx sets it from $remote_addr, which
// overwrites anything the client sent. Falling back to RemoteAddr covers a
// direct connection.
//
// A deployment that puts another proxy in front of nginx must have it set
// X-Real-IP too; without that, this records the near proxy rather than the
// client — wrong, but not forgeable, which is the property that matters here.
func clientIP(r *http.Request) string {
	if real := strings.TrimSpace(r.Header.Get("X-Real-IP")); real != "" {
		return real
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}
