package postgres

import (
	"context"

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

func (r *GovernanceRepository) RecentLogins(ctx context.Context, limit int) ([]domain.LoginAttemptRecord, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, COALESCE(email, ''), success, COALESCE(reason, ''), COALESCE(ip, ''), created_at
		FROM login_audit ORDER BY created_at DESC LIMIT $1`, limit)
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
