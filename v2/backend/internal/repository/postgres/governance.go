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

type PolicyRepository struct{ db *pgxpool.Pool }

func NewPolicyRepository(db *pgxpool.Pool) *PolicyRepository { return &PolicyRepository{db: db} }

func (r *PolicyRepository) List(ctx context.Context) ([]domain.Policy, error) {
	rows, err := r.db.Query(ctx, `
		SELECT p.id, p.chapter_id, p.policy_type, p.config, p.updated_at,
		       COALESCE(c.display_name, '')
		FROM national_policies p
		LEFT JOIN chapters c ON c.id = p.chapter_id
		-- National defaults first: a reader should see the baseline before the
		-- overrides that modify it.
		ORDER BY p.policy_type, p.chapter_id NULLS FIRST`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	policies := make([]domain.Policy, 0)
	for rows.Next() {
		var p domain.Policy
		if err := rows.Scan(&p.ID, &p.ChapterID, &p.PolicyType, &p.Config, &p.UpdatedAt, &p.ChapterName); err != nil {
			return nil, err
		}
		policies = append(policies, p)
	}
	return policies, rows.Err()
}

func (r *PolicyRepository) Upsert(ctx context.Context, p *domain.Policy) error {
	// Two conflict targets because the partial unique indexes differ: a
	// national default keys on policy_type alone, an override on the pair.
	if p.ChapterID == nil {
		return r.db.QueryRow(ctx, `
			INSERT INTO national_policies (policy_type, config, chapter_id)
			VALUES ($1, $2, NULL)
			ON CONFLICT (policy_type) WHERE chapter_id IS NULL
			DO UPDATE SET config = EXCLUDED.config, updated_at = now()
			RETURNING id, updated_at`,
			p.PolicyType, p.Config).Scan(&p.ID, &p.UpdatedAt)
	}

	return r.db.QueryRow(ctx, `
		INSERT INTO national_policies (policy_type, config, chapter_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (chapter_id, policy_type) WHERE chapter_id IS NOT NULL
		DO UPDATE SET config = EXCLUDED.config, updated_at = now()
		RETURNING id, updated_at`,
		p.PolicyType, p.Config, *p.ChapterID).Scan(&p.ID, &p.UpdatedAt)
}

func (r *PolicyRepository) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM national_policies WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

type APIKeyRepository struct{ db *pgxpool.Pool }

func NewAPIKeyRepository(db *pgxpool.Pool) *APIKeyRepository { return &APIKeyRepository{db: db} }

func (r *APIKeyRepository) List(ctx context.Context) ([]domain.APIKey, error) {
	// key_hash is never selected: nothing outside creation has a use for it.
	rows, err := r.db.Query(ctx, `
		SELECT id, name, key_prefix, scope, is_active, last_used_at, expires_at, created_at
		FROM api_keys ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	keys := make([]domain.APIKey, 0)
	for rows.Next() {
		var k domain.APIKey
		if err := rows.Scan(&k.ID, &k.Name, &k.KeyPrefix, &k.Scope, &k.IsActive,
			&k.LastUsedAt, &k.ExpiresAt, &k.CreatedAt); err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

func (r *APIKeyRepository) Create(ctx context.Context, k *domain.APIKey, hash string) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO api_keys (name, key_prefix, key_hash, scope, organization_id)
		VALUES ($1, $2, $3, $4,
		        (SELECT id FROM organizations ORDER BY created_at LIMIT 1))
		RETURNING id, created_at`,
		k.Name, k.KeyPrefix, hash, k.Scope).Scan(&k.ID, &k.CreatedAt)
}

func (r *APIKeyRepository) SetActive(ctx context.Context, id string, active bool) error {
	tag, err := r.db.Exec(ctx, `UPDATE api_keys SET is_active = $2 WHERE id = $1`, id, active)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

func (r *APIKeyRepository) Delete(ctx context.Context, id string) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM api_keys WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}

type GovernanceRepository struct{ db *pgxpool.Pool }

func NewGovernanceRepository(db *pgxpool.Pool) *GovernanceRepository {
	return &GovernanceRepository{db: db}
}

// loginAuditWhere is shared by the page query and the count so the two can
// never be taken over different criteria.
func loginAuditWhere(filter domain.LoginAuditFilter) (string, []any) {
	var (
		clauses []string
		args    []any
	)
	if filter.Email != "" {
		args = append(args, "%"+filter.Email+"%")
		clauses = append(clauses, fmt.Sprintf("email ILIKE $%d", len(args)))
	}
	switch filter.Outcome {
	case "success":
		clauses = append(clauses, "success = true")
	case "failed":
		clauses = append(clauses, "success = false")
	}
	if len(clauses) == 0 {
		return "", args
	}
	return " WHERE " + strings.Join(clauses, " AND "), args
}

func (r *GovernanceRepository) RecentLogins(ctx context.Context, filter domain.LoginAuditFilter) ([]domain.LoginAttemptRecord, error) {
	where, args := loginAuditWhere(filter)
	args = append(args, filter.Limit, filter.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT id, COALESCE(email, ''), success, COALESCE(reason, ''), COALESCE(ip, ''), created_at
		FROM login_audit`+where+
		fmt.Sprintf(" ORDER BY created_at DESC, id DESC LIMIT $%d OFFSET $%d", len(args)-1, len(args)),
		args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	attempts := make([]domain.LoginAttemptRecord, 0)
	for rows.Next() {
		var a domain.LoginAttemptRecord
		if err := rows.Scan(&a.ID, &a.Email, &a.Success, &a.Reason, &a.IP, &a.CreatedAt); err != nil {
			return nil, err
		}
		attempts = append(attempts, a)
	}
	return attempts, rows.Err()
}

// CountLoginOutcomes deliberately ignores filter.Outcome: the breakdown is the
// control for that filter, so it has to keep showing both sides while one of
// them is selected. Narrowing it by the same filter it drives would collapse
// the other number to zero and leave no way back.
func (r *GovernanceRepository) CountLoginOutcomes(ctx context.Context, filter domain.LoginAuditFilter) (int, int, error) {
	filter.Outcome = ""
	where, args := loginAuditWhere(filter)
	var succeeded, failed int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FILTER (WHERE success),
		       COUNT(*) FILTER (WHERE NOT success)
		FROM login_audit`+where, args...).Scan(&succeeded, &failed)
	return succeeded, failed, err
}

func (r *GovernanceRepository) CountLogins(ctx context.Context, filter domain.LoginAuditFilter) (int, error) {
	where, args := loginAuditWhere(filter)
	var total int
	err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM login_audit"+where, args...).Scan(&total)
	return total, err
}

func (r *APIKeyRepository) FindByHash(ctx context.Context, hash string) (*domain.APIKey, error) {
	var k domain.APIKey
	err := r.db.QueryRow(ctx, `
		SELECT id, name, key_prefix, scope, is_active, last_used_at, expires_at, created_at
		FROM api_keys
		WHERE key_hash = $1
		  AND is_active = true
		  -- An expiry that has passed makes the key unusable without anyone
		  -- having to remember to deactivate it.
		  AND (expires_at IS NULL OR expires_at > now())`, hash).
		Scan(&k.ID, &k.Name, &k.KeyPrefix, &k.Scope, &k.IsActive,
			&k.LastUsedAt, &k.ExpiresAt, &k.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, domain.ErrNotFound
	}
	return &k, err
}

// TouchLastUsed records that a key was accepted. Best-effort: the caller
// ignores the error, because failing a legitimate API request over a bookkeeping
// write would be the wrong trade.
func (r *APIKeyRepository) TouchLastUsed(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `UPDATE api_keys SET last_used_at = now() WHERE id = $1`, id)
	return err
}
