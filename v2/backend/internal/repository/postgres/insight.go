package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"bni-visitor/internal/domain"
)

type InsightRepository struct{ db *pgxpool.Pool }

func NewInsightRepository(db *pgxpool.Pool) *InsightRepository {
	return &InsightRepository{db: db}
}

// digitsOnly strips everything but digits from a phone before its length is
// judged, so "0812-3456-7890" is not counted as a data-quality problem for its
// punctuation.
const digitsOnly = `regexp_replace(coalesce(v.phone, ''), '[^0-9]', '', 'g')`

func (r *InsightRepository) Insight(ctx context.Context, scope domain.Scope) (*domain.ChapterInsight, error) {
	var chapterID any
	if scope.ChapterID != nil {
		chapterID = *scope.ChapterID
	}

	out := &domain.ChapterInsight{
		ReadyWA:  []domain.ReadyWAItem{},
		Funnel:   []domain.FunnelStage{},
		Meeting:  []domain.MeetingPoint{},
		Industry: []domain.NameCount{},
		Referrer: []domain.NameCount{},
	}

	// One pass for every count. Each is a FILTER over the same scan rather than
	// its own query — the counts describe one set of rows, so reading it once is
	// both faster and immune to the set changing between queries.
	var total, confirmed, hadir, qualified, member int
	err := r.db.QueryRow(ctx, `
		SELECT
		  COUNT(*),
		  COUNT(*) FILTER (WHERE v.status IN ('new','followup')),
		  COUNT(*) FILTER (WHERE v.pic_id IS NULL),
		  COUNT(*) FILTER (WHERE `+digitsOnly+` = '' OR length(`+digitsOnly+`) < 9
		                      OR v.pic_id IS NULL OR v.meeting_id IS NULL),
		  COUNT(*) FILTER (WHERE v.status = 'new' AND v.pic_id IS NOT NULL),
		  COUNT(*) FILTER (WHERE v.status = 'confirmed'),
		  COUNT(*) FILTER (WHERE v.status IN ('attended','interview','member','not_continue')),
		  COUNT(*) FILTER (WHERE (v.status = 'attended' AND v.attended_choice_number = 1)
		                      OR v.status IN ('interview','member')),
		  COUNT(*) FILTER (WHERE v.status = 'member')
		FROM visitors v
		WHERE ($1::uuid IS NULL OR v.chapter_id = $1)`, chapterID).
		Scan(&total, &out.Focus.NeedFollowUp, &out.Focus.Unassigned, &out.Focus.DataQuality,
			&out.Focus.ReadyWA, &confirmed, &hadir, &qualified, &member)
	if err != nil {
		return nil, err
	}

	// Percentages are against the first stage, so an empty chapter reports zero
	// rather than dividing by nothing.
	pct := func(n int) float64 {
		if total == 0 {
			return 0
		}
		return float64(n) / float64(total) * 100
	}
	out.Funnel = []domain.FunnelStage{
		{Label: "Visitor", Count: total, Percent: pct(total)},
		{Label: "Confirmed", Count: confirmed, Percent: pct(confirmed)},
		{Label: "Hadir", Count: hadir, Percent: pct(hadir)},
		{Label: "Airtime Qualified", Count: qualified, Percent: pct(qualified)},
		{Label: "Member", Count: member, Percent: pct(member)},
	}

	if err := r.readyWA(ctx, chapterID, out); err != nil {
		return nil, err
	}
	if err := r.meetingTrend(ctx, chapterID, out); err != nil {
		return nil, err
	}
	if err := r.topIndustry(ctx, chapterID, out); err != nil {
		return nil, err
	}
	if err := r.topReferrer(ctx, chapterID, out); err != nil {
		return nil, err
	}
	return out, nil
}

// readyWA lists the visitors behind the "Siap Kirim WA" figure. Capped: the card
// is a starting point, not the whole queue, and the Visitor screen is one click
// away with the same filter.
func (r *InsightRepository) readyWA(ctx context.Context, chapterID any, out *domain.ChapterInsight) error {
	rows, err := r.db.Query(ctx, `
		SELECT v.id, v.name, v.phone, COALESCE(u.name, '')
		FROM visitors v
		LEFT JOIN users u ON u.id = v.pic_id
		WHERE ($1::uuid IS NULL OR v.chapter_id = $1)
		  AND v.status = 'new' AND v.pic_id IS NOT NULL
		ORDER BY v.created_at DESC, v.id DESC
		LIMIT 8`, chapterID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var item domain.ReadyWAItem
		if err := rows.Scan(&item.ID, &item.Name, &item.Phone, &item.PICName); err != nil {
			return err
		}
		out.ReadyWA = append(out.ReadyWA, item)
	}
	return rows.Err()
}

// meetingTrend counts visitors per meeting, oldest first so the line reads left
// to right as time.
func (r *InsightRepository) meetingTrend(ctx context.Context, chapterID any, out *domain.ChapterInsight) error {
	rows, err := r.db.Query(ctx, `
		SELECT m.id, m.title, m.meeting_date, COUNT(v.id)
		FROM meetings m
		LEFT JOIN visitors v ON v.meeting_id = m.id
		WHERE ($1::uuid IS NULL OR m.chapter_id = $1)
		GROUP BY m.id, m.title, m.meeting_date
		ORDER BY m.meeting_date`, chapterID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var p domain.MeetingPoint
		var date any
		if err := rows.Scan(&p.ID, &p.Title, &date, &p.Count); err != nil {
			return err
		}
		if t, ok := date.(interface{ Format(string) string }); ok {
			p.Date = t.Format("2006-01-02")
		}
		out.Meeting = append(out.Meeting, p)
	}
	return rows.Err()
}

func (r *InsightRepository) topIndustry(ctx context.Context, chapterID any, out *domain.ChapterInsight) error {
	// An empty business field becomes "Lainnya" rather than being dropped: a
	// chapter with many blanks should see that, not a chart that quietly
	// excludes them.
	rows, err := r.db.Query(ctx, `
		SELECT COALESCE(NULLIF(v.business_field, ''), 'Lainnya') AS field, COUNT(*)
		FROM visitors v
		WHERE ($1::uuid IS NULL OR v.chapter_id = $1)
		GROUP BY field
		ORDER BY COUNT(*) DESC, field
		LIMIT 10`, chapterID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var n domain.NameCount
		if err := rows.Scan(&n.Name, &n.Count); err != nil {
			return err
		}
		out.Industry = append(out.Industry, n)
	}
	return rows.Err()
}

// topReferrer counts who brought people in, across both visitors and guests.
//
// no_show visitors are excluded: the figure credits people for bringing someone
// who turned up, and counting an invitation nobody attended rewards the wrong
// thing.
func (r *InsightRepository) topReferrer(ctx context.Context, chapterID any, out *domain.ChapterInsight) error {
	rows, err := r.db.Query(ctx, `
		SELECT name, SUM(n) FROM (
		  SELECT v.referral_name AS name, COUNT(*) AS n
		  FROM visitors v
		  WHERE ($1::uuid IS NULL OR v.chapter_id = $1)
		    AND v.status <> 'no_show'
		    AND COALESCE(v.referral_name, '') <> ''
		  GROUP BY v.referral_name
		  UNION ALL
		  SELECT g.referral_name AS name, COUNT(*) AS n
		  FROM guests g
		  WHERE ($1::uuid IS NULL OR g.chapter_id = $1)
		    AND COALESCE(g.referral_name, '') <> ''
		  GROUP BY g.referral_name
		) combined
		GROUP BY name
		ORDER BY SUM(n) DESC, name
		LIMIT 12`, chapterID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var n domain.NameCount
		if err := rows.Scan(&n.Name, &n.Count); err != nil {
			return err
		}
		out.Referrer = append(out.Referrer, n)
	}
	return rows.Err()
}
