// Package password isolates the hashing choice so swapping bcrypt for argon2
// later touches one file.
package password

import "golang.org/x/crypto/bcrypt"

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
