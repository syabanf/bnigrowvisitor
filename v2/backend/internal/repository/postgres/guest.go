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

type GuestRepository struct{ db *pgxpool.Pool }

func NewGuestRepository(db *pgxpool.Pool) *GuestRepository { return &GuestRepository{db: db} }

const guestColumns = `
	g.id, g.chapter_id, g.name, COALESCE(g.gender, ''), COALESCE(g.business_field, ''),
	COALESCE(g.company, ''), COALESCE(g.phone, ''), COALESCE(g.email, ''),
	COALESCE(g.referral_name, ''), g.meeting_id, g.visit_date,
	COALESCE(g.meeting_format, ''), COALESCE(g.source_type, ''), COALESCE(g.notes, ''),
	g.created_at, g.updated_at, COALESCE(m.title, '')`

const guestJoins = ` FROM guests g LEFT JOIN meetings m ON m.id = g.meeting_id`

func guestConditions(scope domain.Scope, f domain.GuestFilter) (string, []any) {
	var where []string
	var args []any

	if scope.ChapterID != nil {
		args = append(args, *scope.ChapterID)
		where = append(where, fmt.Sprintf("g.chapter_id = $%d", len(args)))
	}
	if f.MeetingID != "" {
		args = append(args, f.MeetingID)
		where = append(where, fmt.Sprintf("g.meeting_id = $%d", len(args)))
	}
	if s := strings.TrimSpace(f.Search); s != "" {
		args = append(args, "%"+s+"%")
		n := len(args)
		where = append(where, fmt.Sprintf(
			"(g.name ILIKE $%d OR g.phone ILIKE $%d OR g.company ILIKE $%d)", n, n, n))
	}

	if len(where) == 0 {
		return "", args
	}
	return " WHERE " + strings.Join(where, " AND "), args
}

func (r *GuestRepository) List(ctx context.Context, scope domain.Scope, f domain.GuestFilter) ([]domain.Guest, error) {
	clause, args := guestConditions(scope, f)
	args = append(args, f.Limit, f.Offset)

	query := fmt.Sprintf(`SELECT %s %s %s ORDER BY g.created_at DESC LIMIT $%d OFFSET $%d`,
		guestColumns, guestJoins, clause, len(args)-1, len(args))

	rows, err := r.db.Query(ctx, query, append(searchPlanMode(f.Search), args...)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	guests := make([]domain.Guest, 0)
	for rows.Next() {
		g, err := scanGuest(rows)
		if err != nil {
			return nil, err
		}
		guests = append(guests, *g)
	}
	return guests, rows.Err()
}

func (r *GuestRepository) Count(ctx context.Context, scope domain.Scope, f domain.GuestFilter) (int, error) {
	clause, args := guestConditions(scope, f)
	var total int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*)`+guestJoins+clause, args...).Scan(&total)
	return total, err
}

func (r *GuestRepository) FindByID(ctx context.Context, id string) (*domain.Guest, error) {
	row := r.db.QueryRow(ctx, `SELECT `+guestColumns+guestJoins+` WHERE g.id = $1`, id)
	g, err := scanGuest(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return g, err
}

func (r *GuestRepository) Create(ctx context.Context, g *domain.Guest) error {
	err := r.db.QueryRow(ctx, `
		INSERT INTO guests (chapter_id, name, gender, business_field, company, phone, email,
		                    referral_name, meeting_id, visit_date, meeting_format, source_type, notes)
		VALUES ($1,$2,NULLIF($3,''),NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),
		        NULLIF($8,''),$9,$10,NULLIF($11,''),COALESCE(NULLIF($12,''),'Guest'),NULLIF($13,''))
		-- source_type is defaulted by the database, so it has to be read back or
		-- the caller gets a response that misrepresents the row just created.
		RETURNING id, source_type, created_at, updated_at`,
		g.ChapterID, g.Name, g.Gender, g.BusinessField, g.Company, g.Phone, g.Email,
		g.ReferralName, g.MeetingID, g.VisitDate, g.MeetingFormat, g.SourceType, g.Notes,
	).Scan(&g.ID, &g.SourceType, &g.CreatedAt, &g.UpdatedAt)
	return translate(err)
}

func (r *GuestRepository) Update(ctx context.Context, g *domain.Guest) error {
	err := r.db.QueryRow(ctx, `
		UPDATE guests SET
			name = $2, gender = NULLIF($3,''), business_field = NULLIF($4,''),
			company = NULLIF($5,''), phone = NULLIF($6,''), email = NULLIF($7,''),
			referral_name = NULLIF($8,''), meeting_id = $9, visit_date = $10,
			meeting_format = NULLIF($11,''), notes = NULLIF($12,''), updated_at = now()
		WHERE id = $1 RETURNING updated_at`,
		g.ID, g.Name, g.Gender, g.BusinessField, g.Company, g.Phone, g.Email,
		g.ReferralName, g.MeetingID, g.VisitDate, g.MeetingFormat, g.Notes,
	).Scan(&g.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	return translate(err)
}

func (r *GuestRepository) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM guests WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func scanGuest(row pgx.Row) (*domain.Guest, error) {
	var g domain.Guest
	err := row.Scan(
		&g.ID, &g.ChapterID, &g.Name, &g.Gender, &g.BusinessField, &g.Company,
		&g.Phone, &g.Email, &g.ReferralName, &g.MeetingID, &g.VisitDate,
		&g.MeetingFormat, &g.SourceType, &g.Notes, &g.CreatedAt, &g.UpdatedAt, &g.MeetingName,
	)
	if err != nil {
		return nil, err
	}
	return &g, nil
}
