package domain

import "context"

// SessionValidator re-checks, on every authenticated request, that the account
// behind a signed cookie is still allowed in.
//
// A signed token proves only that we issued it — not that the account is still
// active. Without this check a deactivated user keeps full access until their
// cookie expires, which makes revoking someone's access a no-op for up to the
// session lifetime.
type SessionValidator interface {
	// ActiveUser returns the user if the account still exists and is active,
	// and ErrNotFound otherwise.
	ActiveUser(ctx context.Context, id string) (*User, error)
}
