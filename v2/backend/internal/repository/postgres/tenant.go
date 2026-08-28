package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"bni-visitor/internal/domain"
)

type DomainRepository struct{ db *pgxpool.Pool }

func NewDomainRepository(db *pgxpool.Pool) *DomainRepository { return &DomainRepository{db: db} }

func (r *DomainRepository) FindByHost(ctx context.Context, host string) (*domain.ChapterDomain, error) {
	var d domain.ChapterDomain
	err := r.db.QueryRow(ctx, `
		SELECT id, chapter_id, domain, type, is_primary
		FROM chapter_domains
		WHERE domain = $1 AND is_active = true`, host).
		Scan(&d.ID, &d.ChapterID, &d.Domain, &d.Type, &d.IsPrimary)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &d, err
}

func (r *DomainRepository) ListByChapter(ctx context.Context, chapterID string) ([]domain.ChapterDomain, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, chapter_id, domain, type, is_primary
		FROM chapter_domains
		WHERE chapter_id = $1 AND is_active = true
		ORDER BY is_primary DESC, domain`, chapterID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	domains := make([]domain.ChapterDomain, 0)
	for rows.Next() {
		var d domain.ChapterDomain
		if err := rows.Scan(&d.ID, &d.ChapterID, &d.Domain, &d.Type, &d.IsPrimary); err != nil {
			return nil, err
		}
		domains = append(domains, d)
	}
	return domains, rows.Err()
}

type WATemplateRepository struct{ db *pgxpool.Pool }

func NewWATemplateRepository(db *pgxpool.Pool) *WATemplateRepository {
	return &WATemplateRepository{db: db}
}

const templateColumns = `id, chapter_id, name, body, is_default, created_at, updated_at`

func (r *WATemplateRepository) List(ctx context.Context, scope domain.Scope) ([]domain.WATemplate, error) {
	query := `SELECT ` + templateColumns + ` FROM wa_templates`
	var args []any
	if scope.ChapterID != nil {
		query += ` WHERE chapter_id = $1`
		args = append(args, *scope.ChapterID)
	}
	query += ` ORDER BY is_default DESC, name`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	templates := make([]domain.WATemplate, 0)
	for rows.Next() {
		var t domain.WATemplate
		if err := rows.Scan(&t.ID, &t.ChapterID, &t.Name, &t.Body, &t.IsDefault, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		templates = append(templates, t)
	}
	return templates, rows.Err()
}

func (r *WATemplateRepository) FindByID(ctx context.Context, id string) (*domain.WATemplate, error) {
	var t domain.WATemplate
	err := r.db.QueryRow(ctx, `SELECT `+templateColumns+` FROM wa_templates WHERE id = $1`, id).
		Scan(&t.ID, &t.ChapterID, &t.Name, &t.Body, &t.IsDefault, &t.CreatedAt, &t.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &t, err
}

func (r *WATemplateRepository) Create(ctx context.Context, t *domain.WATemplate) error {
	err := r.db.QueryRow(ctx, `
		INSERT INTO wa_templates (chapter_id, name, body, is_default)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at`,
		t.ChapterID, t.Name, t.Body, t.IsDefault,
	).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
	return translate(err)
}

func (r *WATemplateRepository) Update(ctx context.Context, t *domain.WATemplate) error {
	err := r.db.QueryRow(ctx, `
		UPDATE wa_templates SET name = $2, body = $3, is_default = $4, updated_at = now()
		WHERE id = $1 RETURNING updated_at`,
		t.ID, t.Name, t.Body, t.IsDefault,
	).Scan(&t.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	return translate(err)
}

func (r *WATemplateRepository) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM wa_templates WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

type ActivityLogRepository struct{ db *pgxpool.Pool }

func NewActivityLogRepository(db *pgxpool.Pool) *ActivityLogRepository {
	return &ActivityLogRepository{db: db}
}

func (r *ActivityLogRepository) Record(ctx context.Context, e domain.ActivityLog) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO activity_logs (actor_id, actor_name, actor_role, chapter_id,
		                           action, entity, entity_id, entity_label)
		VALUES ($1, NULLIF($2,''), NULLIF($3,''), $4, $5, $6, $7, NULLIF($8,''))`,
		e.ActorID, e.ActorName, e.ActorRole, e.ChapterID,
		e.Action, e.Entity, e.EntityID, e.EntityLabel)
	return err
}

func (r *ActivityLogRepository) List(ctx context.Context, scope domain.Scope, limit int) ([]domain.ActivityLog, error) {
	query := `
		SELECT id, actor_id, COALESCE(actor_name, ''), COALESCE(actor_role, ''), chapter_id,
		       action, entity, entity_id, COALESCE(entity_label, ''), created_at
		FROM activity_logs`
	var args []any
	if scope.ChapterID != nil {
		args = append(args, *scope.ChapterID)
		query += ` WHERE chapter_id = $1`
	}
	args = append(args, limit)
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", len(args))

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := make([]domain.ActivityLog, 0)
	for rows.Next() {
		var l domain.ActivityLog
		if err := rows.Scan(&l.ID, &l.ActorID, &l.ActorName, &l.ActorRole, &l.ChapterID,
			&l.Action, &l.Entity, &l.EntityID, &l.EntityLabel, &l.CreatedAt); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, rows.Err()
}
