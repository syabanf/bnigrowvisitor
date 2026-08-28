package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"bni-visitor/internal/domain"
)

type LoginAuditRepository struct{ db *pgxpool.Pool }

func NewLoginAuditRepository(db *pgxpool.Pool) *LoginAuditRepository {
	return &LoginAuditRepository{db: db}
}

func (r *LoginAuditRepository) Record(ctx context.Context, e domain.LoginAttempt) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO login_audit (user_id, email, success, reason, ip, user_agent, chapter_id)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), $7)`,
		e.UserID, e.Email, e.Success, e.Reason, e.IP, e.UserAgent, e.ChapterID)
	return err
}
