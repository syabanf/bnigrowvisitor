package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"bni-visitor/internal/domain"
)

type VisitorRepository struct{ db *pgxpool.Pool }

func NewVisitorRepository(db *pgxpool.Pool) *VisitorRepository { return &VisitorRepository{db: db} }

const visitorColumns = `
	v.id, v.chapter_id, v.name, v.phone, COALESCE(v.email, ''),
	COALESCE(v.business_field, ''), COALESCE(v.company, ''), COALESCE(v.gender, ''),
	COALESCE(v.referral_name, ''), v.meeting_id, v.pic_id, v.status,
	v.attended_choice_number, COALESCE(v.attended_choice_note, ''),
	COALESCE(v.notes, ''), v.created_by, v.created_at, v.updated_at,
	COALESCE(p.name, ''), COALESCE(m.title, ''), m.meeting_date, COALESCE(c.display_name, '')`

const visitorJoins = `
	FROM visitors v
	LEFT JOIN users p    ON p.id = v.pic_id
	LEFT JOIN meetings m ON m.id = v.meeting_id
	LEFT JOIN chapters c ON c.id = v.chapter_id`

// conditions builds the WHERE clause. Every value goes in through a placeholder
// — only the operators and column names are ever concatenated, so no caller
// input reaches the SQL text.
func conditions(scope domain.Scope, f domain.VisitorFilter) (string, []any) {
	var where []string
	var args []any
	add := func(clause string, value any) {
		args = append(args, value)
		where = append(where, fmt.Sprintf(clause, len(args)))
	}

	// The scope filter is applied first and unconditionally; a chapter-bound
	// caller can never see past it regardless of what else they pass.
	if scope.ChapterID != nil {
		add("v.chapter_id = $%d", *scope.ChapterID)
	}
	if f.Status != "" {
		add("v.status = $%d", f.Status)
	}
	if f.MeetingID != "" {
		add("v.meeting_id = $%d", f.MeetingID)
	}
	if f.PICID != "" {
		add("v.pic_id = $%d", f.PICID)
	}
	if s := strings.TrimSpace(f.Search); s != "" {
		args = append(args, "%"+s+"%")
		n := len(args)
		where = append(where, fmt.Sprintf(
			"(v.name ILIKE $%d OR v.phone ILIKE $%d OR v.email ILIKE $%d OR v.company ILIKE $%d)", n, n, n, n))
	}

	if len(where) == 0 {
		return "", args
	}
	return " WHERE " + strings.Join(where, " AND "), args
}

// searchPlanMode decides how a list query is sent to Postgres.
//
// pgx caches prepared statements, and Postgres switches a prepared statement to
// a generic plan after five executions. A generic plan is built without the
// parameter values, so for `col ILIKE $1` it cannot know the pattern and
// guesses the selectivity. Paired with ORDER BY created_at DESC LIMIT 50 it
// then picks the ordering index and filters as it walks — measured on 40k
// visitors it discarded 40,030 rows to find 1, taking 28ms where the custom
// plan used the trigram indexes and took 1.7ms.
//
// This is why adding the missing trigram index fixed the query in isolation but
// changed nothing at the endpoint: from the sixth request onward the index was
// never consulted.
//
// QueryExecModeExec sends the statement unnamed, so Postgres plans it fresh
// against the actual pattern every time. Applied only when a search term is
// present: re-planning is not free, and every other filter is an equality on a
// column whose statistics the generic plan already handles well.
func searchPlanMode(search string) []any {
	if strings.TrimSpace(search) == "" {
		return nil
	}
	return []any{pgx.QueryExecModeExec}
}

func (r *VisitorRepository) List(ctx context.Context, scope domain.Scope, f domain.VisitorFilter) ([]domain.Visitor, error) {
	clause, args := conditions(scope, f)
	args = append(args, f.Limit, f.Offset)

	query := fmt.Sprintf(
		`SELECT %s %s %s ORDER BY v.created_at DESC, v.id DESC LIMIT $%d OFFSET $%d`,
		visitorColumns, visitorJoins, clause, len(args)-1, len(args))

	rows, err := r.db.Query(ctx, query, append(searchPlanMode(f.Search), args...)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Non-nil slice so an empty result serialises as [] rather than null.
	visitors := make([]domain.Visitor, 0)
	for rows.Next() {
		v, err := scanVisitor(rows)
		if err != nil {
			return nil, err
		}
		visitors = append(visitors, *v)
	}
	return visitors, rows.Err()
}

func (r *VisitorRepository) Count(ctx context.Context, scope domain.Scope, f domain.VisitorFilter) (int, error) {
	clause, args := conditions(scope, f)
	var total int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*)`+visitorJoins+clause, args...).Scan(&total)
	return total, err
}

func (r *VisitorRepository) FindByID(ctx context.Context, id string) (*domain.Visitor, error) {
	row := r.db.QueryRow(ctx, `SELECT `+visitorColumns+visitorJoins+` WHERE v.id = $1`, id)
	v, err := scanVisitor(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return v, err
}

func (r *VisitorRepository) Create(ctx context.Context, v *domain.Visitor) error {
	err := r.db.QueryRow(ctx, `
		INSERT INTO visitors (chapter_id, name, phone, email, business_field, company,
		                      gender, referral_name, meeting_id, pic_id, status, notes, created_by)
		VALUES ($1,$2,$3,NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),
		        NULLIF($8,''),$9,$10,$11,NULLIF($12,''),$13)
		RETURNING id, created_at, updated_at`,
		v.ChapterID, v.Name, v.Phone, v.Email, v.BusinessField, v.Company,
		v.Gender, v.ReferralName, v.MeetingID, v.PICID, v.Status, v.Notes, v.CreatedBy,
	).Scan(&v.ID, &v.CreatedAt, &v.UpdatedAt)

	return translate(err)
}

func (r *VisitorRepository) Update(ctx context.Context, v *domain.Visitor) error {
	err := r.db.QueryRow(ctx, `
		UPDATE visitors SET
			name = $2, phone = $3, email = NULLIF($4,''), business_field = NULLIF($5,''),
			company = NULLIF($6,''), gender = NULLIF($7,''), referral_name = NULLIF($8,''),
			meeting_id = $9, pic_id = $10, status = $11, notes = NULLIF($12,''),
			attended_choice_number = $13, attended_choice_note = NULLIF($14,''),
			updated_at = now()
		WHERE id = $1
		RETURNING updated_at`,
		v.ID, v.Name, v.Phone, v.Email, v.BusinessField, v.Company,
		v.Gender, v.ReferralName, v.MeetingID, v.PICID, v.Status, v.Notes,
		v.AttendedChoiceNumber, v.AttendedChoiceNote,
	).Scan(&v.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	return translate(err)
}

func (r *VisitorRepository) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM visitors WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// translate turns driver-specific failures into domain errors, so nothing above
// this layer has to import a Postgres package to understand what went wrong.
func translate(err error) error {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return err
	}
	switch pgErr.Code {
	case "23505":
		return domain.ErrConflict
	case "22P02", "22003":
		// invalid_text_representation and numeric_value_out_of_range: a
		// malformed uuid, an unknown enum label, a number too large for the
		// column. Every one is a client mistake, but left alone it arrives as
		// an unhandled error — a 500, plus a log line containing whatever
		// string the caller sent, which lets anyone choose what goes in the
		// error log and bury a real failure underneath it.
		//
		// A net, not the fix: these values are still validated where they
		// enter. It is here so the next filter someone adds cannot reopen the
		// same hole by forgetting.
		return domain.ErrValidation
	}
	return err
}

func scanVisitor(row pgx.Row) (*domain.Visitor, error) {
	var v domain.Visitor
	err := row.Scan(
		&v.ID, &v.ChapterID, &v.Name, &v.Phone, &v.Email, &v.BusinessField,
		&v.Company, &v.Gender, &v.ReferralName, &v.MeetingID, &v.PICID, &v.Status,
		&v.AttendedChoiceNumber, &v.AttendedChoiceNote,
		&v.Notes, &v.CreatedBy, &v.CreatedAt, &v.UpdatedAt, &v.PICName, &v.MeetingName, &v.MeetingDate, &v.ChapterName,
	)
	if err != nil {
		return nil, err
	}
	return &v, nil
}
