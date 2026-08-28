// Package password isolates the hashing choice so swapping bcrypt for argon2
// later touches one file.
package password

import (
	"errors"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrTooShort  = errors.New("password minimal 10 karakter")
	ErrTooCommon = errors.New("password terlalu mudah ditebak")
)

const cost = 12

func Hash(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), cost)
	return string(b), err
}

// Verify runs in constant time relative to the hash, so it does not leak
// whether an early byte matched.
func Verify(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// NeedsRehash reports whether an existing hash was made with a weaker cost than
// the current setting, so logins can transparently upgrade it.
func NeedsRehash(hash string) bool {
	c, err := bcrypt.Cost([]byte(hash))
	return err != nil || c < cost
}

// MinLength is deliberately a length floor rather than a character-class rule.
// Composition requirements push people toward predictable substitutions
// ("Password1!") while length is what actually costs an attacker.
const MinLength = 10

// Rejected outright regardless of length: these are the first entries in every
// credential-stuffing list, so allowing them makes the length floor cosmetic.
var weakPasswords = map[string]struct{}{
	"password":   {},
	"password1":  {},
	"1234567890": {},
	"qwertyuiop": {},
	"letmein123": {},
	"changeme12": {},
	"adminadmin": {},
}

// Validate reports why a password is unacceptable, or nil if it is fine.
func Validate(plain string) error {
	if len([]rune(plain)) < MinLength {
		return ErrTooShort
	}
	if _, weak := weakPasswords[strings.ToLower(plain)]; weak {
		return ErrTooCommon
	}
	// A single repeated character clears any length floor without adding any
	// real entropy.
	if isSingleRune(plain) {
		return ErrTooCommon
	}
	return nil
}

func isSingleRune(s string) bool {
	runes := []rune(s)
	for _, r := range runes[1:] {
		if r != runes[0] {
			return false
		}
	}
	return len(runes) > 0
}
