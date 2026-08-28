package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"bni-visitor/internal/domain"
)

type MemberRepository struct{ db *pgxpool.Pool }

func NewMemberRepository(db *pgxpool.Pool) *MemberRepository { return &MemberRepository{db: db} }

const memberColumns = `
	m.id, m.chapter_id, m.name, COALESCE(m.phone, ''), COALESCE(m.email, ''),
	COALESCE(m.business_field, ''), COALESCE(m.company, ''), m.joined_date,
	m.renewal_date, m.last_renewed_at, m.status, COALESCE(m.notes, ''),
	m.created_at, m.updated_at, COALESCE(c.name, '')`

const memberJoins = ` FROM members m LEFT JOIN chapters c ON c.id = m.chapter_id`

func memberConditions(scope domain.Scope, f domain.MemberFilter) (string, []any) {
	var where []string
	var args []any

	if scope.ChapterID != nil {
		args = append(args, *scope.ChapterID)
		where = append(where, fmt.Sprintf("m.chapter_id = $%d", len(args)))
	}
	if f.Status != "" {
		args = append(args, f.Status)
		where = append(where, fmt.Sprintf("m.status = $%d", len(args)))
	}
	if s := strings.TrimSpace(f.Search); s != "" {
		args = append(args, "%"+s+"%")
		n := len(args)
		where = append(where, fmt.Sprintf(
			"(m.name ILIKE $%d OR m.phone ILIKE $%d OR m.email ILIKE $%d OR m.company ILIKE $%d)", n, n, n, n))
	}

	if len(where) == 0 {
		return "", args
	}
	return " WHERE " + strings.Join(where, " AND "), args
}

func (r *MemberRepository) List(ctx context.Context, scope domain.Scope, f domain.MemberFilter) ([]domain.Member, error) {
	clause, args := memberConditions(scope, f)
	args = append(args, f.Limit, f.Offset)

	query := fmt.Sprintf(`SELECT %s %s %s ORDER BY m.name LIMIT $%d OFFSET $%d`,
		memberColumns, memberJoins, clause, len(args)-1, len(args))

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	members := make([]domain.Member, 0)
	for rows.Next() {
		m, err := scanMember(rows)
		if err != nil {
			return nil, err
		}
		members = append(members, *m)
	}
	return members, rows.Err()
}

func (r *MemberRepository) Count(ctx context.Context, scope domain.Scope, f domain.MemberFilter) (int, error) {
	clause, args := memberConditions(scope, f)
	var total int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*)`+memberJoins+clause, args...).Scan(&total)
	return total, err
}

func (r *MemberRepository) FindByID(ctx context.Context, id string) (*domain.Member, error) {
	row := r.db.QueryRow(ctx, `SELECT `+memberColumns+memberJoins+` WHERE m.id = $1`, id)
	m, err := scanMember(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return m, err
}

func (r *MemberRepository) Create(ctx context.Context, m *domain.Member) error {
	err := r.db.QueryRow(ctx, `
		INSERT INTO members (chapter_id, name, phone, email, business_field, company,
		                     joined_date, renewal_date, status, notes)
		VALUES ($1,$2,NULLIF($3,''),NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),$7,$8,$9,NULLIF($10,''))
		RETURNING id, created_at, updated_at`,
		m.ChapterID, m.Name, m.Phone, m.Email, m.BusinessField, m.Company,
		m.JoinedDate, m.RenewalDate, m.Status, m.Notes,
	).Scan(&m.ID, &m.CreatedAt, &m.UpdatedAt)
	return translate(err)
}

func (r *MemberRepository) Update(ctx context.Context, m *domain.Member) error {
	err := r.db.QueryRow(ctx, `
		UPDATE members SET
			name = $2, phone = NULLIF($3,''), email = NULLIF($4,''),
			business_field = NULLIF($5,''), company = NULLIF($6,''),
			joined_date = $7, renewal_date = $8, status = $9, notes = NULLIF($10,''),
			updated_at = now()
		WHERE id = $1 RETURNING updated_at`,
		m.ID, m.Name, m.Phone, m.Email, m.BusinessField, m.Company,
		m.JoinedDate, m.RenewalDate, m.Status, m.Notes,
	).Scan(&m.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	return translate(err)
}

// Renew stamps a completed renewal and pushes the next date out by a year.
func (r *MemberRepository) Renew(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE members
		SET last_renewed_at = now(),
		    renewal_date = GREATEST(COALESCE(renewal_date, CURRENT_DATE), CURRENT_DATE) + INTERVAL '1 year',
		    updated_at = now()
		WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *MemberRepository) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM members WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func scanMember(row pgx.Row) (*domain.Member, error) {
	var m domain.Member
	err := row.Scan(
		&m.ID, &m.ChapterID, &m.Name, &m.Phone, &m.Email, &m.BusinessField,
		&m.Company, &m.JoinedDate, &m.RenewalDate, &m.LastRenewedAt, &m.Status,
		&m.Notes, &m.CreatedAt, &m.UpdatedAt, &m.ChapterName,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}
