// Package domain holds the enterprise-wide entities and the interfaces the
// outer layers must satisfy. It imports nothing from this project and nothing
// from the database or HTTP worlds — every dependency points inward, at this
// package.
package domain

import "time"

type Role string

const (
	RoleAdmin         Role = "admin"
	RoleNationalAdmin Role = "national_admin"
	RoleChapterAdmin  Role = "chapter_admin"
	RolePIC           Role = "pic"
	RoleMember        Role = "member"
)

// IsNational reports whether the role may operate across every chapter.
func (r Role) IsNational() bool {
	return r == RoleAdmin || r == RoleNationalAdmin
}

func (r Role) Valid() bool {
	switch r {
	case RoleAdmin, RoleNationalAdmin, RoleChapterAdmin, RolePIC, RoleMember:
		return true
	}
	return false
}

type VisitorStatus string

const (
	StatusNew         VisitorStatus = "new"
	StatusFollowUp    VisitorStatus = "followup"
	StatusConfirmed   VisitorStatus = "confirmed"
	StatusAttended    VisitorStatus = "attended"
	StatusNoShow      VisitorStatus = "no_show"
	StatusInterview   VisitorStatus = "interview"
	StatusMember      VisitorStatus = "member"
	StatusNotContinue VisitorStatus = "not_continue"
)

var validStatuses = map[VisitorStatus]struct{}{
	StatusNew: {}, StatusFollowUp: {}, StatusConfirmed: {}, StatusAttended: {},
	StatusNoShow: {}, StatusInterview: {}, StatusMember: {}, StatusNotContinue: {},
}

func (s VisitorStatus) Valid() bool {
	_, ok := validStatuses[s]
	return ok
}

type Organization struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Code      string    `json:"code"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type Chapter struct {
	ID          string    `json:"id"`
	AreaID      string    `json:"area_id"`
	Name        string    `json:"name"`
	DisplayName string    `json:"display_name"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`

	// Denormalised for reads; never persisted from here.
	AreaName string `json:"area_name,omitempty"`
	CityName string `json:"city_name,omitempty"`
}

type User struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Email          string    `json:"email"`
	Role           Role      `json:"role"`
	Phone          string    `json:"phone,omitempty"`
	OrganizationID *string   `json:"organization_id,omitempty"`
	ChapterID      *string   `json:"chapter_id,omitempty"`
	IsActive       bool      `json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	// Never serialised: the JSON tag is "-" so a handler cannot leak it by
	// accident when it returns a User straight to the client.
	PasswordHash string `json:"-"`

	ChapterName string `json:"chapter_name,omitempty"`
	AreaName    string `json:"area_name,omitempty"`
	CityName    string `json:"city_name,omitempty"`
}

type Meeting struct {
	ID          string    `json:"id"`
	ChapterID   string    `json:"chapter_id"`
	Title       string    `json:"title"`
	MeetingDate time.Time `json:"meeting_date"`
	Location    string    `json:"location,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type Visitor struct {
	ID            string        `json:"id"`
	ChapterID     string        `json:"chapter_id"`
	Name          string        `json:"name"`
	Phone         string        `json:"phone"`
	Email         string        `json:"email,omitempty"`
	BusinessField string        `json:"business_field,omitempty"`
	Company       string        `json:"company,omitempty"`
	Gender        string        `json:"gender,omitempty"`
	ReferralName  string        `json:"referral_name,omitempty"`
	MeetingID     *string       `json:"meeting_id,omitempty"`
	PICID         *string       `json:"pic_id,omitempty"`
	Status        VisitorStatus `json:"status"`

	// MCQA: the airtime outcome, only meaningful once the visitor attended.
	AttendedChoiceNumber *int   `json:"attended_choice_number,omitempty"`
	AttendedChoiceNote   string `json:"attended_choice_note,omitempty"`

	Notes string `json:"notes,omitempty"`
	CreatedBy     *string       `json:"created_by,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`

	PICName     string     `json:"pic_name,omitempty"`
	MeetingName string     `json:"meeting_name,omitempty"`
	MeetingDate *time.Time `json:"meeting_date,omitempty"`
	ChapterName string     `json:"chapter_name,omitempty"`
}

// AirtimeChoice labels the MCQA outcomes. Kept beside the entity so the API and
// any future report agree on the wording without duplicating a map.
var AirtimeChoice = map[int]string{
	1: "Bersedia bergabung",
	2: "Ingin datang lagi",
	3: "Belum tertarik",
}

// CanRecordAirtime reports whether a status is far enough along the funnel for
// an airtime result to make sense. Recording one against a visitor who has not
// attended would silently corrupt the MCQA report.
func (s VisitorStatus) CanRecordAirtime() bool {
	switch s {
	case StatusAttended, StatusInterview, StatusMember, StatusNotContinue:
		return true
	}
	return false
}

// ConfirmableStatuses are the states a visitor can still confirm from. Anything
// further along is already settled and must not be walked backwards by someone
// re-opening an old WhatsApp link.
func (s VisitorStatus) CanConfirmAttendance() bool {
	return s == StatusNew || s == StatusFollowUp
}
