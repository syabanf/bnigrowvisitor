// Package postgres implements the domain's repository ports. It is the only
// package in the app allowed to know SQL.
package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"bni-visitor/internal/domain"
)

type UserRepository struct{ db *pgxpool.Pool }

func NewUserRepository(db *pgxpool.Pool) *UserRepository { return &UserRepository{db: db} }

const userColumns = `
	u.id, u.name, u.email, u.role, COALESCE(u.phone, ''), u.password_hash,
	u.organization_id, u.chapter_id, u.is_active, u.created_at, u.updated_at,
	u.failed_login_count, u.locked_until,
	COALESCE(c.name, ''), COALESCE(a.name, ''), COALESCE(ci.name, '')`

const userJoins = `
	FROM users u
	LEFT JOIN chapters c ON c.id = u.chapter_id
	LEFT JOIN areas a    ON a.id = c.area_id
	LEFT JOIN cities ci  ON ci.id = a.city_id`

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*domain.User, error) {
	// Only active accounts authenticate: deactivating a user must lock them out
	// immediately, not at their next session expiry.
	row := r.db.QueryRow(ctx,
		`SELECT `+userColumns+userJoins+` WHERE lower(u.email) = lower($1) AND u.is_active = true`, email)
	return scanUser(row)
}

func (r *UserRepository) FindByID(ctx context.Context, id string) (*domain.User, error) {
	row := r.db.QueryRow(ctx,
		`SELECT `+userColumns+userJoins+` WHERE u.id = $1 AND u.is_active = true`, id)
	return scanUser(row)
}

func (r *UserRepository) UpdatePasswordHash(ctx context.Context, id, hash string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, id, hash)
	return err
}

func scanUser(row pgx.Row) (*domain.User, error) {
	var u domain.User
	err := row.Scan(
		&u.ID, &u.Name, &u.Email, &u.Role, &u.Phone, &u.PasswordHash,
		&u.OrganizationID, &u.ChapterID, &u.IsActive, &u.CreatedAt, &u.UpdatedAt,
		&u.FailedLoginCount, &u.LockedUntil,
		&u.ChapterName, &u.AreaName, &u.CityName,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// ListByScope returns the accounts a caller may manage or assign. roles narrows
// it to e.g. just PICs for the assignment picker; empty means every role.
func (r *UserRepository) ListByScope(ctx context.Context, scope domain.Scope, roles []domain.Role) ([]domain.User, error) {
	query := `SELECT ` + userColumns + userJoins + ` WHERE u.is_active = true`
	var args []any

	if scope.ChapterID != nil {
		args = append(args, *scope.ChapterID)
		query += fmt.Sprintf(` AND u.chapter_id = $%d`, len(args))
	}
	if len(roles) > 0 {
		names := make([]string, len(roles))
		for i, role := range roles {
			names[i] = string(role)
		}
		args = append(args, names)
		query += fmt.Sprintf(` AND u.role::text = ANY($%d)`, len(args))
	}
	query += ` ORDER BY u.name`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]domain.User, 0)
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		// Defence in depth: the hash is already tagged json:"-", but a list
		// endpoint has no use for it at all.
		u.PasswordHash = ""
		users = append(users, *u)
	}
	return users, rows.Err()
}

func (r *UserRepository) Create(ctx context.Context, u *domain.User) error {
	err := r.db.QueryRow(ctx, `
		INSERT INTO users (name, email, password_hash, role, phone, organization_id, chapter_id)
		VALUES ($1, lower($2), $3, $4, NULLIF($5,''), $6, $7)
		RETURNING id, created_at, updated_at`,
		u.Name, u.Email, u.PasswordHash, u.Role, u.Phone, u.OrganizationID, u.ChapterID,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
	return translate(err)
}

func (r *UserRepository) Update(ctx context.Context, u *domain.User) error {
	// password_hash is deliberately absent: changing a password goes through
	// UpdatePasswordHash so it always passes the hashing path.
	err := r.db.QueryRow(ctx, `
		UPDATE users SET name = $2, email = lower($3), role = $4,
		                 phone = NULLIF($5,''), chapter_id = $6, updated_at = now()
		WHERE id = $1 RETURNING updated_at`,
		u.ID, u.Name, u.Email, u.Role, u.Phone, u.ChapterID,
	).Scan(&u.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return domain.ErrNotFound
	}
	return translate(err)
}

func (r *UserRepository) SetActive(ctx context.Context, id string, active bool) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1`, id, active)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

// ActiveUser satisfies domain.SessionValidator. FindByID already filters on
// is_active, so a deactivated account resolves to ErrNotFound.
func (r *UserRepository) ActiveUser(ctx context.Context, id string) (*domain.User, error) {
	return r.FindByID(ctx, id)
}

// RegisterFailedLogin increments the counter and, once it reaches the
// threshold, sets an expiry. Done in one statement so two simultaneous guesses
// cannot both read the same count and each write back the same increment.
func (r *UserRepository) RegisterFailedLogin(ctx context.Context, id string, max int, lockFor time.Duration) (*time.Time, error) {
	var lockedUntil *time.Time
	err := r.db.QueryRow(ctx, `
		UPDATE users
		SET failed_login_count = failed_login_count + 1,
		    locked_until = CASE
		      WHEN failed_login_count + 1 >= $2 THEN now() + $3::interval
		      ELSE locked_until
		    END,
		    updated_at = now()
		WHERE id = $1
		RETURNING locked_until`,
		id, max, lockFor.String(),
	).Scan(&lockedUntil)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return lockedUntil, err
}

// ClearFailedLogins resets the counter after a successful sign-in, so a user
// who mistypes a few times and then gets it right is not creeping toward a
// lockout for the rest of the day.
func (r *UserRepository) ClearFailedLogins(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE users SET failed_login_count = 0, locked_until = NULL
		WHERE id = $1 AND (failed_login_count > 0 OR locked_until IS NOT NULL)`, id)
	return err
}

// demoEmailSuffix is what marks a seeded account. A real deployment has no
// users on this domain, so even with demo mode switched on by mistake this
// returns nothing rather than the staff list.
const demoEmailSuffix = "@demo.test"

func (r *UserRepository) ListDemoAccounts(ctx context.Context) ([]domain.User, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name, email, role, chapter_id, organization_id, is_active
		FROM users
		WHERE is_active = true AND email LIKE '%' || $1
		ORDER BY email`, demoEmailSuffix)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := make([]domain.User, 0)
	for rows.Next() {
		var u domain.User
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role,
			&u.ChapterID, &u.OrganizationID, &u.IsActive); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}
