package domain

import (
	"context"
	"encoding/json"
	"time"
)

// Policy is a rule that applies nationally, or to one chapter when it overrides
// the national default.
type Policy struct {
	ID         string          `json:"id"`
	ChapterID  *string         `json:"chapter_id,omitempty"`
	PolicyType string          `json:"policy_type"`
	Config     json.RawMessage `json:"config"`
	UpdatedAt  time.Time       `json:"updated_at"`

	ChapterName string `json:"chapter_name,omitempty"`
}

// KnownPolicyTypes bounds what may be stored. An open-ended type column becomes
// a junk drawer that nothing can validate or migrate.
var KnownPolicyTypes = map[string]string{
	"visitor_frequency":  "Batas Kunjungan Visitor",
	"membership_renewal": "Renewal Member",
	"chapter_target":     "Target Chapter",
}

func ValidPolicyType(t string) bool {
	_, ok := KnownPolicyTypes[t]
	return ok
}

type FrequencyRepository interface {
	VisitorFrequency(ctx context.Context, phone string, limit, periodMonths int) (*VisitorFrequency, error)
}

type PolicyRepository interface {
	List(ctx context.Context) ([]Policy, error)
	Upsert(ctx context.Context, p *Policy) error
	Delete(ctx context.Context, id string) error
}

// APIKey is a credential for an external integration. The secret itself is
// never stored — only its hash and a display prefix.
type APIKey struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	KeyPrefix  string     `json:"key_prefix"`
	Scope      string     `json:"scope"`
	IsActive   bool       `json:"is_active"`
	LastUsedAt *time.Time `json:"last_used_at,omitempty"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`

	// Populated exactly once, on creation, and never persisted. This is the
	// only moment the caller can copy it.
	PlainKey string `json:"plain_key,omitempty"`
}

type APIKeyRepository interface {
	List(ctx context.Context) ([]APIKey, error)
	Create(ctx context.Context, k *APIKey, hash string) error
	SetActive(ctx context.Context, id string, active bool) error
	Delete(ctx context.Context, id string) error

	// FindByHash resolves a presented key. Lookup is by hash because the
	// plaintext is never stored — there is nothing else to match on.
	FindByHash(ctx context.Context, hash string) (*APIKey, error)
	TouchLastUsed(ctx context.Context, id string) error
}

// LoginAttemptRecord is a row from the login audit, for the governance screen.
type LoginAttemptRecord struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Success   bool      `json:"success"`
	Reason    string    `json:"reason,omitempty"`
	IP        string    `json:"ip,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type GovernanceRepository interface {
	RecentLogins(ctx context.Context, filter LoginAuditFilter) ([]LoginAttemptRecord, error)
	CountLogins(ctx context.Context, filter LoginAuditFilter) (int, error)
	CountLoginOutcomes(ctx context.Context, filter LoginAuditFilter) (succeeded, failed int, err error)
}

// MasterData is the tenant hierarchy shown on the Master Wilayah screen.
type MasterData struct {
	Organizations []Organization  `json:"organizations"`
	Cities        []City          `json:"cities"`
	Areas         []Area          `json:"areas"`
	Chapters      []Chapter       `json:"chapters"`
	Domains       []ChapterDomain `json:"domains"`
}

type City struct {
	ID             string `json:"id"`
	OrganizationID string `json:"organization_id"`
	Name           string `json:"name"`
	IsActive       bool   `json:"is_active"`
}

type Area struct {
	ID       string `json:"id"`
	CityID   string `json:"city_id"`
	Name     string `json:"name"`
	IsActive bool   `json:"is_active"`
}

type MasterRepository interface {
	Load(ctx context.Context) (*MasterData, error)
	CreateCity(ctx context.Context, c *City) error
	CreateArea(ctx context.Context, a *Area) error
	CreateChapter(ctx context.Context, c *Chapter) error
	SetChapterActive(ctx context.Context, id string, active bool) error
}

// LoginAuditFilter narrows the login trail. Outcome is "success" or "failed":
// the reason someone opens this screen is almost always to look at failures, so
// making them siftable is the difference between an audit trail and a wall of
// noise.
type LoginAuditFilter struct {
	Email   string
	Outcome string
	Limit   int
	Offset  int
}

// VisitorFrequency is the answer to "has this person already visited too often".
//
// The rule lives in the visitor_frequency policy, which this app has stored and
// displayed since the policies screen was built — and never once applied. A
// limit nothing checks is a note, not a policy.
type VisitorFrequency struct {
	Phone        string       `json:"phone"`
	Count        int          `json:"count"`
	Limit        int          `json:"limit"`
	PeriodMonths int          `json:"period_months"`
	Exceeded     bool         `json:"exceeded"`
	Visits       []PriorVisit `json:"visits"`
}

type PriorVisit struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	ChapterName string `json:"chapter_name"`
	Status      string `json:"status"`
	MeetingName string `json:"meeting_name"`
	CreatedAt   string `json:"created_at"`
}
