package usecase

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"

	"bni-visitor/internal/domain"
)

// GovernanceUsecase covers the national-only screens: master data, policies,
// API keys and the login audit.
type GovernanceUsecase struct {
	master   domain.MasterRepository
	policies domain.PolicyRepository
	keys     domain.APIKeyRepository
	audit    domain.GovernanceRepository
}

func NewGovernanceUsecase(
	master domain.MasterRepository,
	policies domain.PolicyRepository,
	keys domain.APIKeyRepository,
	audit domain.GovernanceRepository,
) *GovernanceUsecase {
	return &GovernanceUsecase{master: master, policies: policies, keys: keys, audit: audit}
}

// requireNational gates every method here. These screens read across every
// tenant, so a chapter-bound account must not reach them at all — not even
// read-only.
func requireNational(role domain.Role) error {
	if !role.IsNational() {
		return domain.ErrForbidden
	}
	return nil
}

func (uc *GovernanceUsecase) Master(ctx context.Context, role domain.Role) (*domain.MasterData, error) {
	if err := requireNational(role); err != nil {
		return nil, err
	}
	return uc.master.Load(ctx)
}

func (uc *GovernanceUsecase) CreateCity(ctx context.Context, role domain.Role, orgID, name string) (*domain.City, error) {
	if err := requireNational(role); err != nil {
		return nil, err
	}
	name = strings.TrimSpace(name)
	if name == "" || orgID == "" {
		return nil, domain.ErrValidation
	}
	c := &domain.City{OrganizationID: orgID, Name: name, IsActive: true}
	return c, uc.master.CreateCity(ctx, c)
}

func (uc *GovernanceUsecase) CreateArea(ctx context.Context, role domain.Role, cityID, name string) (*domain.Area, error) {
	if err := requireNational(role); err != nil {
		return nil, err
	}
	name = strings.TrimSpace(name)
	if name == "" || cityID == "" {
		return nil, domain.ErrValidation
	}
	a := &domain.Area{CityID: cityID, Name: name, IsActive: true}
	return a, uc.master.CreateArea(ctx, a)
}

func (uc *GovernanceUsecase) CreateChapter(ctx context.Context, role domain.Role, areaID, name, displayName string) (*domain.Chapter, error) {
	if err := requireNational(role); err != nil {
		return nil, err
	}
	name = strings.TrimSpace(name)
	if name == "" || areaID == "" {
		return nil, domain.ErrValidation
	}
	if displayName == "" {
		displayName = name + " Chapter"
	}
	c := &domain.Chapter{AreaID: areaID, Name: name, DisplayName: displayName, IsActive: true}
	return c, uc.master.CreateChapter(ctx, c)
}

func (uc *GovernanceUsecase) SetChapterActive(ctx context.Context, role domain.Role, id string, active bool) error {
	if err := requireNational(role); err != nil {
		return err
	}
	return uc.master.SetChapterActive(ctx, id, active)
}

func (uc *GovernanceUsecase) Policies(ctx context.Context, role domain.Role) ([]domain.Policy, error) {
	if err := requireNational(role); err != nil {
		return nil, err
	}
	return uc.policies.List(ctx)
}

func (uc *GovernanceUsecase) SavePolicy(ctx context.Context, role domain.Role, policyType string, chapterID *string, config json.RawMessage) (*domain.Policy, error) {
	if err := requireNational(role); err != nil {
		return nil, err
	}
	if !domain.ValidPolicyType(policyType) {
		return nil, fmt.Errorf("%w: jenis policy tidak dikenal", domain.ErrValidation)
	}
	// Stored as jsonb, so malformed JSON would fail at the driver with an
	// opaque message; checking here turns it into a clear 400.
	if !json.Valid(config) {
		return nil, fmt.Errorf("%w: config bukan JSON valid", domain.ErrValidation)
	}

	p := &domain.Policy{PolicyType: policyType, ChapterID: chapterID, Config: config}
	return p, uc.policies.Upsert(ctx, p)
}

func (uc *GovernanceUsecase) APIKeys(ctx context.Context, role domain.Role) ([]domain.APIKey, error) {
	if err := requireNational(role); err != nil {
		return nil, err
	}
	return uc.keys.List(ctx)
}

// CreateAPIKey mints a key, stores only its hash, and returns the plaintext
// exactly once. Nothing can recover it afterwards — losing it means issuing a
// new one, which is the property that makes a database leak survivable.
func (uc *GovernanceUsecase) CreateAPIKey(ctx context.Context, role domain.Role, name, scope string) (*domain.APIKey, error) {
	if err := requireNational(role); err != nil {
		return nil, err
	}
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, domain.ErrValidation
	}
	if scope == "" {
		scope = "finance"
	}

	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil, err
	}
	plain := "bni_" + base64.RawURLEncoding.EncodeToString(raw)

	sum := sha256.Sum256([]byte(plain))
	hash := hex.EncodeToString(sum[:])

	key := &domain.APIKey{
		Name: name, Scope: scope, IsActive: true,
		KeyPrefix: plain[:12],
	}
	if err := uc.keys.Create(ctx, key, hash); err != nil {
		return nil, err
	}
	key.PlainKey = plain
	return key, nil
}

func (uc *GovernanceUsecase) SetAPIKeyActive(ctx context.Context, role domain.Role, id string, active bool) error {
	if err := requireNational(role); err != nil {
		return err
	}
	return uc.keys.SetActive(ctx, id, active)
}

func (uc *GovernanceUsecase) DeleteAPIKey(ctx context.Context, role domain.Role, id string) error {
	if err := requireNational(role); err != nil {
		return err
	}
	return uc.keys.Delete(ctx, id)
}

type LoginAuditPage struct {
	Data      []domain.LoginAttemptRecord `json:"data"`
	Total     int                         `json:"total"`
	Succeeded int                         `json:"succeeded"`
	Failed    int                         `json:"failed"`
}

func (uc *GovernanceUsecase) RecentLogins(ctx context.Context, role domain.Role, filter domain.LoginAuditFilter) (*LoginAuditPage, error) {
	if err := requireNational(role); err != nil {
		return nil, err
	}
	filter.Limit, filter.Offset = clampPage(filter.Limit, filter.Offset)

	total, err := uc.audit.CountLogins(ctx, filter)
	if err != nil {
		return nil, err
	}
	logins, err := uc.audit.RecentLogins(ctx, filter)
	if err != nil {
		return nil, err
	}
	succeeded, failed, err := uc.audit.CountLoginOutcomes(ctx, filter)
	if err != nil {
		return nil, err
	}
	return &LoginAuditPage{Data: logins, Total: total, Succeeded: succeeded, Failed: failed}, nil
}
