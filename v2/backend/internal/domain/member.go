package domain

import "time"

type MemberStatus string

const (
	MemberActive    MemberStatus = "active"
	MemberInactive  MemberStatus = "inactive"
	MemberSuspended MemberStatus = "suspended"
)

func (s MemberStatus) Valid() bool {
	switch s {
	case MemberActive, MemberInactive, MemberSuspended:
		return true
	}
	return false
}

type Member struct {
	ID            string       `json:"id"`
	ChapterID     string       `json:"chapter_id"`
	Name          string       `json:"name"`
	Phone         string       `json:"phone,omitempty"`
	Email         string       `json:"email,omitempty"`
	BusinessField string       `json:"business_field,omitempty"`
	Company       string       `json:"company,omitempty"`
	JoinedDate    *time.Time   `json:"joined_date,omitempty"`
	RenewalDate   *time.Time   `json:"renewal_date,omitempty"`
	LastRenewedAt *time.Time   `json:"last_renewed_at,omitempty"`
	Status        MemberStatus `json:"status"`
	Notes         string       `json:"notes,omitempty"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`

	ChapterName string `json:"chapter_name,omitempty"`
}

// RenewalDue reports whether the membership needs renewing within the window.
// A member with no renewal date is never due — the absence means "not tracked",
// not "overdue since the epoch".
func (m Member) RenewalDue(within time.Duration, now time.Time) bool {
	if m.RenewalDate == nil {
		return false
	}
	return m.RenewalDate.Before(now.Add(within))
}

type Guest struct {
	ID            string     `json:"id"`
	ChapterID     string     `json:"chapter_id"`
	Name          string     `json:"name"`
	Gender        string     `json:"gender,omitempty"`
	BusinessField string     `json:"business_field,omitempty"`
	Company       string     `json:"company,omitempty"`
	Phone         string     `json:"phone,omitempty"`
	Email         string     `json:"email,omitempty"`
	ReferralName  string     `json:"referral_name,omitempty"`
	MeetingID     *string    `json:"meeting_id,omitempty"`
	VisitDate     *time.Time `json:"visit_date,omitempty"`
	MeetingFormat string     `json:"meeting_format,omitempty"`
	SourceType    string     `json:"source_type,omitempty"`
	Notes         string     `json:"notes,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`

	MeetingName string `json:"meeting_name,omitempty"`
}
