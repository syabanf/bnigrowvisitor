package domain

import (
	"context"
	"time"
)

// The interfaces below are declared here, beside the entities they return, and
// implemented out in the infrastructure layer. That inversion is what keeps the
// use cases free of any knowledge of Postgres.

type UserRepository interface {
	FindByEmail(ctx context.Context, email string) (*User, error)
	FindByID(ctx context.Context, id string) (*User, error)
	UpdatePasswordHash(ctx context.Context, id, hash string) error

	// ListByScope powers the PIC picker and the account-management screen.
	ListByScope(ctx context.Context, scope Scope, roles []Role) ([]User, error)

	// ListDemoAccounts returns the seeded sign-in accounts, matched on the
	// demo email domain. Only ever reached in demo mode, and matching on the
	// domain rather than on a hardcoded list is what stops the login screen
	// from offering an account that no longer exists.
	ListDemoAccounts(ctx context.Context) ([]User, error)
	Create(ctx context.Context, u *User) error
	Update(ctx context.Context, u *User) error
	SetActive(ctx context.Context, id string, active bool) error

	// RegisterFailedLogin increments the counter and locks the account once it
	// crosses the threshold. Returns the resulting lock expiry, if any.
	RegisterFailedLogin(ctx context.Context, id string, max int, lockFor time.Duration) (*time.Time, error)
	ClearFailedLogins(ctx context.Context, id string) error
}

type ChapterRepository interface {
	FindByID(ctx context.Context, id string) (*Chapter, error)
	List(ctx context.Context) ([]Chapter, error)
	Exists(ctx context.Context, id string) (bool, error)
}

type VisitorFilter struct {
	Status    string
	MeetingID string
	PICID     string
	Search    string
	Limit     int
	Offset    int
}

type VisitorRepository interface {
	List(ctx context.Context, scope Scope, filter VisitorFilter) ([]Visitor, error)
	Count(ctx context.Context, scope Scope, filter VisitorFilter) (int, error)

	// StatusCounts breaks the filtered set down by status, so a summary above
	// the list describes the same rows the list is showing. Counting the page
	// in the browser instead would report fifty rows as if they were the whole
	// chapter.
	StatusCounts(ctx context.Context, scope Scope, filter VisitorFilter) (map[string]int, error)
	FindByID(ctx context.Context, id string) (*Visitor, error)
	Create(ctx context.Context, v *Visitor) error
	Update(ctx context.Context, v *Visitor) error
	Delete(ctx context.Context, id string) error
}

// MeetingFilter exists so the meeting list is a window like every other list.
// A chapter meeting weekly accumulates ~52 rows a year; returning all of them
// forever is fine right up until it isn't, and by then the fix is a schema
// change under a screen people depend on.
type MeetingFilter struct {
	Search string
	Limit  int
	Offset int
}

type MeetingRepository interface {
	List(ctx context.Context, scope Scope, filter MeetingFilter) ([]Meeting, error)
	Count(ctx context.Context, scope Scope, filter MeetingFilter) (int, error)
	FindByID(ctx context.Context, id string) (*Meeting, error)
	Create(ctx context.Context, m *Meeting) error
	Update(ctx context.Context, m *Meeting) error
	Delete(ctx context.Context, id string) error
}

type MemberFilter struct {
	Status string
	Search string
	Limit  int
	Offset int
}

type MemberRepository interface {
	List(ctx context.Context, scope Scope, filter MemberFilter) ([]Member, error)
	Count(ctx context.Context, scope Scope, filter MemberFilter) (int, error)

	// StatusCounts as above, plus the two renewal buckets the member screen
	// colours rows by — overdue and due within thirty days. Derived from the
	// date on read rather than stored, so they cannot disagree with it.
	StatusCounts(ctx context.Context, scope Scope, filter MemberFilter) (map[string]int, error)
	FindByID(ctx context.Context, id string) (*Member, error)
	Create(ctx context.Context, m *Member) error
	Update(ctx context.Context, m *Member) error
	Delete(ctx context.Context, id string) error
}

type GuestFilter struct {
	MeetingID string
	Search    string
	Limit     int
	Offset    int
}

type GuestRepository interface {
	List(ctx context.Context, scope Scope, filter GuestFilter) ([]Guest, error)
	Count(ctx context.Context, scope Scope, filter GuestFilter) (int, error)
	FindByID(ctx context.Context, id string) (*Guest, error)
	Create(ctx context.Context, g *Guest) error
	Update(ctx context.Context, g *Guest) error
	Delete(ctx context.Context, id string) error
}

// StatsRepository aggregates in SQL. Kept separate from the entity repositories
// because it answers questions, not "give me rows".
type StatsRepository interface {
	ChapterStats(ctx context.Context, scope Scope) (*ChapterStats, error)
	PerChapterStats(ctx context.Context) ([]ChapterStats, error)
	VisitorStatusBreakdown(ctx context.Context, scope Scope) ([]StatusCount, error)
}

// LoginAuditRepository records every attempt, successful or not. Kept as its
// own port so auditing can be swapped or disabled without touching auth logic.
type LoginAuditRepository interface {
	Record(ctx context.Context, entry LoginAttempt) error
}

type LoginAttempt struct {
	UserID    *string
	Email     string
	Success   bool
	Reason    string
	IP        string
	UserAgent string
	ChapterID *string
}
