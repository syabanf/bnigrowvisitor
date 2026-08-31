package postgres

import (
	"context"
	"regexp"
	"strings"

	"bni-visitor/internal/domain"
)

var nonDigits = regexp.MustCompile(`[^0-9]`)

// phoneVariants returns the forms the same Indonesian number is stored in.
//
// The same person is entered as 0812…, 62812… and +62 812… by different people
// on different days. Comparing the raw string would count each spelling as a
// different visitor, which is exactly the case the frequency rule exists to
// catch.
func phoneVariants(raw string) []string {
	digits := nonDigits.ReplaceAllString(raw, "")
	core := digits
	switch {
	case strings.HasPrefix(digits, "62"):
		core = digits[2:]
	case strings.HasPrefix(digits, "0"):
		core = digits[1:]
	}
	if core == "" {
		return nil
	}
	return []string{"0" + core, "62" + core}
}

// countedStatuses are the outcomes that mean someone actually attended. An
// invitation nobody turned up to is not a visit.
var countedStatuses = []string{"attended", "interview", "member", "not_continue"}

// VisitorFrequency counts completed visits for a phone number inside the policy
// window.
//
// Deliberately not scoped to a chapter: the limit exists to stop the same person
// touring every chapter in turn, so scoping it to one would defeat it.
func (r *GovernanceRepository) VisitorFrequency(ctx context.Context, phone string, limit, periodMonths int) (*domain.VisitorFrequency, error) {
	out := &domain.VisitorFrequency{
		Phone: phone, Limit: limit, PeriodMonths: periodMonths,
		Visits: []domain.PriorVisit{},
	}

	variants := phoneVariants(phone)
	if len(variants) == 0 {
		return out, nil
	}

	rows, err := r.db.Query(ctx, `
		SELECT v.id, v.name, COALESCE(c.name, ''), v.status::text,
		       COALESCE(m.title, ''), v.created_at
		FROM visitors v
		LEFT JOIN chapters c ON c.id = v.chapter_id
		LEFT JOIN meetings m ON m.id = v.meeting_id
		WHERE v.phone = ANY($1)
		  AND v.status = ANY($2)
		  AND v.created_at >= now() - make_interval(months => $3)
		ORDER BY v.created_at DESC`,
		variants, countedStatuses, periodMonths)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var v domain.PriorVisit
		var created any
		if err := rows.Scan(&v.ID, &v.Name, &v.ChapterName, &v.Status, &v.MeetingName, &created); err != nil {
			return nil, err
		}
		if t, ok := created.(interface{ Format(string) string }); ok {
			v.CreatedAt = t.Format("2006-01-02")
		}
		out.Visits = append(out.Visits, v)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out.Count = len(out.Visits)
	out.Exceeded = out.Count >= limit
	return out, nil
}
