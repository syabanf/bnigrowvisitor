package domain

import "context"

// ChapterInsight is everything the chapter dashboard shows beyond the plain
// totals.
//
// The definitions are taken from the Next.js dashboard this replaces, so the two
// report the same numbers for the same data rather than each inventing its own
// arithmetic. Where they had to differ, the comment says why.
type ChapterInsight struct {
	Focus    FocusCounts    `json:"focus"`
	ReadyWA  []ReadyWAItem  `json:"ready_wa"`
	Funnel   []FunnelStage  `json:"funnel"`
	Meeting  []MeetingPoint `json:"meeting_trend"`
	Industry []NameCount    `json:"top_industry"`
	Referrer []NameCount    `json:"top_referrer"`
}

// FocusCounts are the four figures that open the dashboard, each a queue of
// work rather than a statistic.
type FocusCounts struct {
	// NeedFollowUp: status new or followup.
	NeedFollowUp int `json:"need_follow_up"`
	// Unassigned: no PIC.
	Unassigned int `json:"unassigned"`
	// DataQuality: a phone with fewer than nine digits, no PIC, or no meeting.
	//
	// The original also accepted a free-text meeting_date when meeting_id was
	// absent. This schema has no such column — a visitor is linked to a meeting
	// row or to nothing — so that clause has nowhere to go and the rule is
	// narrower by exactly that much.
	DataQuality int `json:"data_quality"`
	// ReadyWA: still new, but already has a PIC to send from.
	ReadyWA int `json:"ready_wa"`
}

type ReadyWAItem struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	PICName string `json:"pic_name"`
}

// FunnelStage is one step of the conversion funnel. Percent is against the
// first stage, not the previous one.
//
// Not a strict cohort funnel: stage two counts visitors whose status is exactly
// "confirmed", so someone who has since attended is no longer in it. That is
// how the original counted, and matching it matters more than tidying it —
// two dashboards disagreeing about the same chapter is worse than one odd
// definition consistently applied.
type FunnelStage struct {
	Label   string  `json:"label"`
	Count   int     `json:"count"`
	Percent float64 `json:"percent"`
}

type MeetingPoint struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Date  string `json:"date"`
	Count int    `json:"count"`
}

type NameCount struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type ChapterInsightRepository interface {
	Insight(ctx context.Context, scope Scope) (*ChapterInsight, error)
}
