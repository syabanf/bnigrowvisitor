package session

import (
	"encoding/base64"
	"strings"
	"testing"
	"time"
)

func base64Raw(s string) string {
	return base64.RawURLEncoding.EncodeToString([]byte(s))
}

func newManager() *Manager { return New("test-secret", time.Hour) }

func TestIssueAndVerifyRoundTrip(t *testing.T) {
	m := newManager()
	chapter := "chapter-grow"

	token, err := m.Issue(Payload{
		Sub: "user-1", Email: "a@b.test", Role: "chapter_admin", ChapterID: &chapter,
	})
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}

	got, err := m.Verify(token)
	if err != nil {
		t.Fatalf("Verify: %v", err)
	}
	if got.Sub != "user-1" || got.Role != "chapter_admin" {
		t.Errorf("payload round-tripped wrong: %+v", got)
	}
	if got.ChapterID == nil || *got.ChapterID != chapter {
		t.Errorf("chapter lost in round trip: %+v", got.ChapterID)
	}
	if got.Exp <= time.Now().Unix() {
		t.Error("expiry should be in the future")
	}
}

// The whole point of the signature: a payload the holder edited must not verify.
func TestVerifyRejectsTamperedPayload(t *testing.T) {
	m := newManager()
	token, _ := m.Issue(Payload{Sub: "user-1", Role: "pic"})

	encoded, tag, _ := strings.Cut(token, ".")

	// Re-encode a payload claiming a national role, keeping the original tag.
	forged := base64Raw(`{"sub":"user-1","role":"national_admin","exp":99999999999}`)
	if _, err := m.Verify(forged + "." + tag); err == nil {
		t.Fatal("a forged payload with a stale tag must not verify")
	}

	// Flipping a character in the tag must also fail.
	bad := []byte(tag)
	bad[0] ^= 'x'
	if _, err := m.Verify(encoded + "." + string(bad)); err == nil {
		t.Fatal("a corrupted tag must not verify")
	}
}

func TestVerifyRejectsForeignSecret(t *testing.T) {
	issuer := New("secret-one", time.Hour)
	verifier := New("secret-two", time.Hour)

	token, _ := issuer.Issue(Payload{Sub: "user-1", Role: "admin"})
	if _, err := verifier.Verify(token); err == nil {
		t.Fatal("a token signed with another key must not verify")
	}
}

func TestVerifyRejectsExpired(t *testing.T) {
	// Negative lifetime so the token is already past its expiry when issued.
	m := New("test-secret", -time.Minute)
	token, _ := m.Issue(Payload{Sub: "user-1", Role: "pic"})

	if _, err := m.Verify(token); err != ErrExpired {
		t.Fatalf("err = %v, want ErrExpired", err)
	}
}

func TestVerifyRejectsMalformed(t *testing.T) {
	m := newManager()
	for _, token := range []string{"", ".", "onlyonepart", ".sig", "payload.", "not.base64!!"} {
		if _, err := m.Verify(token); err == nil {
			t.Errorf("Verify(%q) should have failed", token)
		}
	}
}
