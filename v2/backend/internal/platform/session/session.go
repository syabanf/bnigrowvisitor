// Package session issues and verifies the signed cookie that carries identity
// between requests. Same shape as the Next.js app it replaces: a base64url
// payload plus an HMAC-SHA256 tag, so the two can be reasoned about together
// during the migration.
package session

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

const CookieName = "bni_session"

var (
	ErrMalformed = errors.New("session token tidak valid")
	ErrExpired   = errors.New("session sudah kedaluwarsa")
)

type Payload struct {
	Sub            string  `json:"sub"`
	Email          string  `json:"email"`
	Role           string  `json:"role"`
	ChapterID      *string `json:"chapter_id,omitempty"`
	OrganizationID *string `json:"organization_id,omitempty"`
	Exp            int64   `json:"exp"`
}

type Manager struct {
	secret []byte
	maxAge time.Duration
}

func New(secret string, maxAge time.Duration) *Manager {
	return &Manager{secret: []byte(secret), maxAge: maxAge}
}

func (m *Manager) MaxAge() time.Duration { return m.maxAge }

func (m *Manager) Issue(p Payload) (string, error) {
	p.Exp = time.Now().Add(m.maxAge).Unix()

	body, err := json.Marshal(p)
	if err != nil {
		return "", err
	}
	encoded := base64.RawURLEncoding.EncodeToString(body)
	return encoded + "." + m.sign(encoded), nil
}

func (m *Manager) Verify(token string) (*Payload, error) {
	encoded, tag, found := strings.Cut(token, ".")
	if !found || encoded == "" || tag == "" {
		return nil, ErrMalformed
	}

	// Compare before decoding: an attacker must not be able to feed arbitrary
	// JSON through the parser on an unauthenticated request. hmac.Equal is
	// constant time, so this does not leak how much of the tag was right.
	if !hmac.Equal([]byte(tag), []byte(m.sign(encoded))) {
		return nil, ErrMalformed
	}

	body, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return nil, ErrMalformed
	}

	var p Payload
	if err := json.Unmarshal(body, &p); err != nil {
		return nil, ErrMalformed
	}
	if time.Now().Unix() > p.Exp {
		return nil, ErrExpired
	}
	return &p, nil
}

func (m *Manager) sign(data string) string {
	mac := hmac.New(sha256.New, m.secret)
	mac.Write([]byte(data))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
