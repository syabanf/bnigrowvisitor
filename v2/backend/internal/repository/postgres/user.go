// Package postgres implements the domain's repository ports. It is the only
// package in the app allowed to know SQL.
package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"bni-visitor/internal/domain"
)

type UserRepository struct{ db *pgxpool.Pool }

func NewUserRepository(db *pgxpool.Pool) *UserRepository { return &UserRepository{db: db} }

const userColumns = `
	u.id, u.name, u.email, u.role, COALESCE(u.phone, ''), u.password_hash,
	u.organization_id, u.chapter_id, u.is_active, u.created_at, u.updated_at,
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
