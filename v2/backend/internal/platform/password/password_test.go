package password

import "testing"

func TestHashAndVerify(t *testing.T) {
	hash, err := Hash("correct horse battery")
	if err != nil {
		t.Fatalf("Hash: %v", err)
	}
	if hash == "correct horse battery" {
		t.Fatal("the hash must not be the plaintext")
	}
	if !Verify(hash, "correct horse battery") {
		t.Error("the right password should verify")
	}
	if Verify(hash, "wrong password here") {
		t.Error("the wrong password must not verify")
	}
}

// Two hashes of the same password must differ, or the salt is not doing its job
// and identical passwords become visible in a database dump.
func TestHashIsSalted(t *testing.T) {
	a, _ := Hash("same password twice")
	b, _ := Hash("same password twice")
	if a == b {
		t.Fatal("two hashes of the same password should differ")
	}
	if !Verify(a, "same password twice") || !Verify(b, "same password twice") {
		t.Error("both hashes should still verify")
	}
}

func TestVerifyRejectsGarbageHash(t *testing.T) {
	for _, hash := range []string{"", "not-a-hash", "$2a$12$tooshort"} {
		if Verify(hash, "anything") {
			t.Errorf("a malformed hash (%q) must never verify", hash)
		}
	}
}

func TestNeedsRehash(t *testing.T) {
	current, _ := Hash("some password here")
	if NeedsRehash(current) {
		t.Error("a hash made at the current cost should not need rehashing")
	}
	// An unparseable hash is treated as needing a rehash rather than trusted.
	if !NeedsRehash("not-a-bcrypt-hash") {
		t.Error("a garbage hash should be reported as needing a rehash")
	}
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantErr  error
	}{
		{"long enough is fine", "kata sandi panjang", nil},
		{"exactly at the floor", "abcdefghij", nil},
		{"one below the floor", "abcdefghi", ErrTooShort},
		{"empty", "", ErrTooShort},
		{"the old six-character minimum no longer passes", "abc123", ErrTooShort},
		{"a short common password fails on length first", "password1", ErrTooShort},
		{"a common password at the floor is rejected as common", "1234567890", ErrTooCommon},
		{"case does not rescue a common password", "AdminAdmin", ErrTooCommon},
		{"a single repeated character is rejected", "aaaaaaaaaaaa", ErrTooCommon},
		// 10 runes but 30 bytes: counting bytes would wrongly let a 4-rune
		// password through, so the rune count is what must be measured.
		{"length counts runes, not bytes", "だいじょうぶです안녕", nil},
		{"a short multi-byte password is still too short", "だいじょうぶ", ErrTooShort},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if err := Validate(tc.password); err != tc.wantErr {
				t.Errorf("Validate(%q) = %v, want %v", tc.password, err, tc.wantErr)
			}
		})
	}
}
