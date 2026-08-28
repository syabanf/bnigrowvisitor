package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"bni-visitor/internal/domain"
)

type MeetingRepository struct{ db *pgxpool.Pool }

func NewMeetingRepository(db *pgxpool.Pool) *MeetingRepository { return &MeetingRepository{db: db} }

func (r *MeetingRepository) List(ctx context.Context, scope domain.Scope) ([]domain.Meeting, error) {
	query := `SELECT id, chapter_id, title, meeting_date, COALESCE(location, ''), created_at FROM meetings`
	args := []any{}
	if scope.ChapterID != nil {
		query += ` WHERE chapter_id = $1`
		args = append(args, *scope.ChapterID)
	}
	query += ` ORDER BY meeting_date DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	meetings := make([]domain.Meeting, 0)
	for rows.Next() {
		var m domain.Meeting
		if err := rows.Scan(&m.ID, &m.ChapterID, &m.Title, &m.MeetingDate, &m.Location, &m.CreatedAt); err != nil {
			return nil, err
		}
		meetings = append(meetings, m)
	}
	return meetings, rows.Err()
}

func (r *MeetingRepository) FindByID(ctx context.Context, id string) (*domain.Meeting, error) {
	var m domain.Meeting
	err := r.db.QueryRow(ctx,
		`SELECT id, chapter_id, title, meeting_date, COALESCE(location, ''), created_at
		 FROM meetings WHERE id = $1`, id).
		Scan(&m.ID, &m.ChapterID, &m.Title, &m.MeetingDate, &m.Location, &m.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &m, err
}

func (r *MeetingRepository) Create(ctx context.Context, m *domain.Meeting) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO meetings (chapter_id, title, meeting_date, location)
		VALUES ($1, $2, $3, NULLIF($4,''))
		RETURNING id, created_at`,
		m.ChapterID, m.Title, m.MeetingDate, m.Location,
	).Scan(&m.ID, &m.CreatedAt)
}

func (r *MeetingRepository) Update(ctx context.Context, m *domain.Meeting) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE meetings SET title = $2, meeting_date = $3, location = NULLIF($4,''), updated_at = now()
		WHERE id = $1`, m.ID, m.Title, m.MeetingDate, m.Location)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *MeetingRepository) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM meetings WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
