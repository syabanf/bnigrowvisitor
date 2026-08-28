package usecase

import (
	"context"

	"bni-visitor/internal/domain"
)

type DashboardUsecase struct {
	stats domain.StatsRepository
}

func NewDashboardUsecase(stats domain.StatsRepository) *DashboardUsecase {
	return &DashboardUsecase{stats: stats}
}

type ChapterDashboard struct {
	Stats          *domain.ChapterStats `json:"stats"`
	StatusChart    []domain.StatusCount `json:"status_chart"`
	ConversionRate float64              `json:"conversion_rate"`
	AttendanceRate float64              `json:"attendance_rate"`
}

func (uc *DashboardUsecase) Chapter(ctx context.Context, scope domain.Scope) (*ChapterDashboard, error) {
	stats, err := uc.stats.ChapterStats(ctx, scope)
	if err != nil {
		return nil, err
	}
	chart, err := uc.stats.VisitorStatusBreakdown(ctx, scope)
	if err != nil {
		return nil, err
	}
	// The rates are derived, not stored: keeping them out of the table means
	// they can never drift from the counts they come from.
	return &ChapterDashboard{
		Stats: stats, StatusChart: chart,
		ConversionRate: stats.ConversionRate(),
		AttendanceRate: stats.AttendanceRate(),
	}, nil
}

type NationalChapterRow struct {
	domain.ChapterStats
	ConversionRate float64 `json:"conversion_rate"`
	AttendanceRate float64 `json:"attendance_rate"`
}

type NationalDashboard struct {
	Totals   *domain.ChapterStats `json:"totals"`
	Chapters []NationalChapterRow `json:"chapters"`
}

func (uc *DashboardUsecase) National(ctx context.Context) (*NationalDashboard, error) {
	totals, err := uc.stats.ChapterStats(ctx, domain.Scope{IsNational: true})
	if err != nil {
		return nil, err
	}
	perChapter, err := uc.stats.PerChapterStats(ctx)
	if err != nil {
		return nil, err
	}

	rows := make([]NationalChapterRow, 0, len(perChapter))
	for _, s := range perChapter {
		rows = append(rows, NationalChapterRow{
			ChapterStats:   s,
			ConversionRate: s.ConversionRate(),
			AttendanceRate: s.AttendanceRate(),
		})
	}
	return &NationalDashboard{Totals: totals, Chapters: rows}, nil
}
