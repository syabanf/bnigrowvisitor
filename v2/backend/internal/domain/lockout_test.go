package domain

import (
	"testing"
	"time"
)

func TestUserIsLocked(t *testing.T) {
	now := time.Date(2026, 8, 28, 12, 0, 0, 0, time.UTC)
	past := now.Add(-time.Minute)
	future := now.Add(time.Minute)

	tests := []struct {
		name        string
		lockedUntil *time.Time
		want        bool
	}{
		// Absent means never locked, not locked forever — getting this backwards
		// would bar every account that has never had a failure.
		{"no lock recorded", nil, false},
		{"lock still in force", &future, true},
		{"lock already expired", &past, false},
		{"lock expiring exactly now is over", &now, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			u := User{LockedUntil: tc.lockedUntil}
			if got := u.IsLocked(now); got != tc.want {
				t.Errorf("IsLocked() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestLockoutPolicyIsStricterThanTheRateLimit(t *testing.T) {
	// The per-IP limit is 10 login attempts a minute. The account threshold has
	// to sit below what a distributed attacker gets through in a short burst,
	// or spreading the guesses across addresses walks straight past it.
	if MaxFailedLogins >= 10 {
		t.Errorf("MaxFailedLogins = %d; should be below the per-IP burst to be worth having", MaxFailedLogins)
	}
	if LockoutDuration < time.Minute {
		t.Errorf("LockoutDuration = %v; too short to slow anything down", LockoutDuration)
	}
}
