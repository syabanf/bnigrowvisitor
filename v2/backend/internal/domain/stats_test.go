package domain

import (
	"testing"
	"time"
)

// The rates divide by counts that are legitimately zero on a new chapter, so
// the zero case is the one worth pinning.
func TestConversionRate(t *testing.T) {
	tests := []struct {
		name   string
		visits int
		became int
		want   float64
	}{
		{"no visitors yet does not divide by zero", 0, 0, 0},
		{"no conversions", 10, 0, 0},
		{"quarter converted", 20, 5, 25},
		{"everyone converted", 4, 4, 100},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := ChapterStats{TotalVisitors: tc.visits, BecameMember: tc.became}
			if got := s.ConversionRate(); got != tc.want {
				t.Errorf("ConversionRate() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestAttendanceRate(t *testing.T) {
	if got := (ChapterStats{}).AttendanceRate(); got != 0 {
		t.Errorf("empty stats should give 0, got %v", got)
	}
	s := ChapterStats{Confirmed: 8, Attended: 6}
	if got := s.AttendanceRate(); got != 75 {
		t.Errorf("AttendanceRate() = %v, want 75", got)
	}
}

func TestMemberRenewalDue(t *testing.T) {
	now := time.Date(2026, 8, 28, 0, 0, 0, 0, time.UTC)
	window := 30 * 24 * time.Hour

	soon := now.Add(10 * 24 * time.Hour)
	overdue := now.Add(-5 * 24 * time.Hour)
	far := now.Add(200 * 24 * time.Hour)

	tests := []struct {
		name string
		date *time.Time
		want bool
	}{
		// Absent means "not tracked", not "overdue since the epoch" — getting
		// this backwards would flag every untracked member as due.
		{"no renewal date is never due", nil, false},
		{"overdue is due", &overdue, true},
		{"inside the window is due", &soon, true},
		{"far future is not due", &far, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			m := Member{RenewalDate: tc.date}
			if got := m.RenewalDue(window, now); got != tc.want {
				t.Errorf("RenewalDue() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestVisitorStatusValid(t *testing.T) {
	for _, s := range []VisitorStatus{StatusNew, StatusFollowUp, StatusConfirmed,
		StatusAttended, StatusNoShow, StatusInterview, StatusMember, StatusNotContinue} {
		if !s.Valid() {
			t.Errorf("%q should be valid", s)
		}
	}
	for _, s := range []VisitorStatus{"", "bogus", "NEW", "member "} {
		if s.Valid() {
			t.Errorf("%q should be rejected", s)
		}
	}
}
