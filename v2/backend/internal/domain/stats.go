package domain

// ChapterStats is the shape the chapter dashboard needs. Computed in the
// database rather than by loading every row and counting in Go — the numbers
// are aggregates, and shipping thousands of rows to count them does not scale.
type ChapterStats struct {
	ChapterID   string `json:"chapter_id"`
	ChapterName string `json:"chapter_name,omitempty"`

	TotalVisitors int `json:"total_visitors"`
	NeedFollowUp  int `json:"need_follow_up"`
	Unassigned    int `json:"unassigned"`
	Confirmed     int `json:"confirmed"`
	Attended      int `json:"attended"`
	BecameMember  int `json:"became_member"`

	TotalMembers   int `json:"total_members"`
	ActiveMembers  int `json:"active_members"`
	RenewalDueSoon int `json:"renewal_due_soon"`

	TotalGuests   int `json:"total_guests"`
	TotalMeetings int `json:"total_meetings"`
}

// ConversionRate is the share of visitors that became members, as a percentage.
// Returns 0 rather than dividing by zero when a chapter has no visitors yet.
func (s ChapterStats) ConversionRate() float64 {
	if s.TotalVisitors == 0 {
		return 0
	}
	return float64(s.BecameMember) / float64(s.TotalVisitors) * 100
}

// AttendanceRate is the share of confirmed visitors who actually turned up.
func (s ChapterStats) AttendanceRate() float64 {
	if s.Confirmed == 0 {
		return 0
	}
	return float64(s.Attended) / float64(s.Confirmed) * 100
}

type StatusCount struct {
	Status string `json:"status"`
	Count  int    `json:"count"`
}
