package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"bni-visitor/internal/domain"
)

type ChapterRepository struct{ db *pgxpool.Pool }

func NewChapterRepository(db *pgxpool.Pool) *ChapterRepository { return &ChapterRepository{db: db} }

const chapterSelect = `
	SELECT c.id, c.area_id, c.name, c.display_name, c.is_active, c.created_at,
	       COALESCE(a.name, ''), COALESCE(ci.name, '')
	FROM chapters c
	LEFT JOIN areas a   ON a.id = c.area_id
	LEFT JOIN cities ci ON ci.id = a.city_id`

func (r *ChapterRepository) FindByID(ctx context.Context, id string) (*domain.Chapter, error) {
	row := r.db.QueryRow(ctx, chapterSelect+` WHERE c.id = $1`, id)
	var c domain.Chapter
	err := row.Scan(&c.ID, &c.AreaID, &c.Name, &c.DisplayName, &c.IsActive, &c.CreatedAt, &c.AreaName, &c.CityName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *ChapterRepository) List(ctx context.Context) ([]domain.Chapter, error) {
	rows, err := r.db.Query(ctx, chapterSelect+` WHERE c.is_active = true ORDER BY c.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	chapters := make([]domain.Chapter, 0)
	for rows.Next() {
		var c domain.Chapter
		if err := rows.Scan(&c.ID, &c.AreaID, &c.Name, &c.DisplayName, &c.IsActive, &c.CreatedAt, &c.AreaName, &c.CityName); err != nil {
			return nil, err
		}
		chapters = append(chapters, c)
	}
	return chapters, rows.Err()
}

func (r *ChapterRepository) Exists(ctx context.Context, id string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM chapters WHERE id = $1)`, id).Scan(&exists)
	return exists, err
}
