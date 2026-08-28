package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"bni-visitor/internal/domain"
)

type StatsRepository struct{ db *pgxpool.Pool }

func NewStatsRepository(db *pgxpool.Pool) *StatsRepository { return &StatsRepository{db: db} }

// ChapterStats runs every counter as one query with FILTER clauses rather than
// a dozen round trips. The scope is applied to each subquery independently
// because the three tables have no join between them worth making here.
func (r *StatsRepository) ChapterStats(ctx context.Context, scope domain.Scope) (*domain.ChapterStats, error) {
	// A nil chapter means "all chapters"; passing NULL and testing for it in
	// SQL keeps one query serving both cases.
	var chapterID any
	if scope.ChapterID != nil {
		chapterID = *scope.ChapterID
	}

	var s domain.ChapterStats
	err := r.db.QueryRow(ctx, `
		SELECT
		  (SELECT COUNT(*) FROM visitors v WHERE ($1::uuid IS NULL OR v.chapter_id = $1)),
		  (SELECT COUNT(*) FROM visitors v WHERE ($1::uuid IS NULL OR v.chapter_id = $1)
		     AND v.status IN ('new','followup')),
		  (SELECT COUNT(*) FROM visitors v WHERE ($1::uuid IS NULL OR v.chapter_id = $1)
		     AND v.pic_id IS NULL),
		  (SELECT COUNT(*) FROM visitors v WHERE ($1::uuid IS NULL OR v.chapter_id = $1)
		     AND v.status = 'confirmed'),
		  (SELECT COUNT(*) FROM visitors v WHERE ($1::uuid IS NULL OR v.chapter_id = $1)
		     AND v.status = 'attended'),
		  (SELECT COUNT(*) FROM visitors v WHERE ($1::uuid IS NULL OR v.chapter_id = $1)
		     AND v.status = 'member'),
		  (SELECT COUNT(*) FROM members m WHERE ($1::uuid IS NULL OR m.chapter_id = $1)),
		  (SELECT COUNT(*) FROM members m WHERE ($1::uuid IS NULL OR m.chapter_id = $1)
		     AND m.status = 'active'),
		  (SELECT COUNT(*) FROM members m WHERE ($1::uuid IS NULL OR m.chapter_id = $1)
		     AND m.renewal_date IS NOT NULL AND m.renewal_date < CURRENT_DATE + 30),
		  (SELECT COUNT(*) FROM guests g   WHERE ($1::uuid IS NULL OR g.chapter_id = $1)),
		  (SELECT COUNT(*) FROM meetings k WHERE ($1::uuid IS NULL OR k.chapter_id = $1))`,
		chapterID,
	).Scan(
		&s.TotalVisitors, &s.NeedFollowUp, &s.Unassigned, &s.Confirmed, &s.Attended,
		&s.BecameMember, &s.TotalMembers, &s.ActiveMembers, &s.RenewalDueSoon,
		&s.TotalGuests, &s.TotalMeetings,
	)
	if err != nil {
		return nil, err
	}
	if scope.ChapterID != nil {
		s.ChapterID = *scope.ChapterID
	}
	return &s, nil
}

// PerChapterStats powers the national dashboard. LEFT JOINs from chapters so a
// chapter with no visitors still appears, at zero, instead of vanishing.
func (r *StatsRepository) PerChapterStats(ctx context.Context) ([]domain.ChapterStats, error) {
	rows, err := r.db.Query(ctx, `
		SELECT c.id, c.display_name,
		  COUNT(DISTINCT v.id),
		  COUNT(DISTINCT v.id) FILTER (WHERE v.status IN ('new','followup')),
		  COUNT(DISTINCT v.id) FILTER (WHERE v.pic_id IS NULL),
		  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'confirmed'),
		  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'attended'),
		  COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'member'),
		  COUNT(DISTINCT m.id),
		  COUNT(DISTINCT m.id) FILTER (WHERE m.status = 'active'),
		  COUNT(DISTINCT m.id) FILTER (WHERE m.renewal_date IS NOT NULL
		                                 AND m.renewal_date < CURRENT_DATE + 30),
		  COUNT(DISTINCT g.id),
		  COUNT(DISTINCT k.id)
		FROM chapters c
		LEFT JOIN visitors v ON v.chapter_id = c.id
		LEFT JOIN members  m ON m.chapter_id = c.id
		LEFT JOIN guests   g ON g.chapter_id = c.id
		LEFT JOIN meetings k ON k.chapter_id = c.id
		WHERE c.is_active = true
		GROUP BY c.id, c.display_name
		ORDER BY c.display_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make([]domain.ChapterStats, 0)
	for rows.Next() {
		var s domain.ChapterStats
		if err := rows.Scan(
			&s.ChapterID, &s.ChapterName, &s.TotalVisitors, &s.NeedFollowUp, &s.Unassigned,
			&s.Confirmed, &s.Attended, &s.BecameMember, &s.TotalMembers, &s.ActiveMembers,
			&s.RenewalDueSoon, &s.TotalGuests, &s.TotalMeetings,
		); err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}

func (r *StatsRepository) VisitorStatusBreakdown(ctx context.Context, scope domain.Scope) ([]domain.StatusCount, error) {
	var chapterID any
	if scope.ChapterID != nil {
		chapterID = *scope.ChapterID
	}

	rows, err := r.db.Query(ctx, `
		SELECT status::text, COUNT(*)
		FROM visitors
		WHERE ($1::uuid IS NULL OR chapter_id = $1)
		GROUP BY status
		ORDER BY COUNT(*) DESC`, chapterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	counts := make([]domain.StatusCount, 0)
	for rows.Next() {
		var c domain.StatusCount
		if err := rows.Scan(&c.Status, &c.Count); err != nil {
			return nil, err
		}
		counts = append(counts, c)
	}
	return counts, rows.Err()
}
