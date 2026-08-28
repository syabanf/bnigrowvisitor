package domain

import "context"

// The interfaces below are declared here, beside the entities they return, and
// implemented out in the infrastructure layer. That inversion is what keeps the
// use cases free of any knowledge of Postgres.

type UserRepository interface {
	FindByEmail(ctx context.Context, email string) (*User, error)
	FindByID(ctx context.Context, id string) (*User, error)
	UpdatePasswordHash(ctx context.Context, id, hash string) error
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
	FindByID(ctx context.Context, id string) (*Visitor, error)
	Create(ctx context.Context, v *Visitor) error
	Update(ctx context.Context, v *Visitor) error
	Delete(ctx context.Context, id string) error
}

type MeetingRepository interface {
	List(ctx context.Context, scope Scope) ([]Meeting, error)
	FindByID(ctx context.Context, id string) (*Meeting, error)
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
