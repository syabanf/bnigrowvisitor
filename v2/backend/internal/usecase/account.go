package usecase

import (
	"context"
	"strings"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/platform/password"
)

// AccountUsecase covers PIC management: a chapter admin creates and maintains
// the accounts inside their own chapter, and nobody else's.
type AccountUsecase struct {
	users    domain.UserRepository
	chapters domain.ChapterRepository
}

func NewAccountUsecase(users domain.UserRepository, chapters domain.ChapterRepository) *AccountUsecase {
	return &AccountUsecase{users: users, chapters: chapters}
}

// ListPICs backs the "assign PIC" picker.
func (uc *AccountUsecase) ListPICs(ctx context.Context, scope domain.Scope) ([]domain.User, error) {
	return uc.users.ListByScope(ctx, scope, []domain.Role{domain.RolePIC, domain.RoleChapterAdmin})
}

func (uc *AccountUsecase) List(ctx context.Context, scope domain.Scope, actorRole domain.Role) ([]domain.User, error) {
	if !canManageAccounts(actorRole) {
		return nil, domain.ErrForbidden
	}
	return uc.users.ListByScope(ctx, scope, nil)
}

type AccountInput struct {
	Name      string
	Email     string
	Password  string
	Role      string
	Phone     string
	ChapterID string
}

func (uc *AccountUsecase) Create(ctx context.Context, scope domain.Scope, actorRole domain.Role, organizationID *string, in AccountInput) (*domain.User, error) {
	if !canManageAccounts(actorRole) {
		return nil, domain.ErrForbidden
	}

	role := domain.Role(in.Role)
	if err := validateGrant(actorRole, role); err != nil {
		return nil, err
	}

	name := strings.TrimSpace(in.Name)
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if name == "" || email == "" || len(in.Password) < 6 {
		return nil, domain.ErrValidation
	}

	chapterID, err := resolveChapter(ctx, uc.chapters, scope, in.ChapterID)
	if err != nil {
		return nil, err
	}

	hash, err := password.Hash(in.Password)
	if err != nil {
		return nil, err
	}

	u := &domain.User{
		Name: name, Email: email, PasswordHash: hash, Role: role,
		Phone: in.Phone, OrganizationID: organizationID, ChapterID: &chapterID,
		IsActive: true,
	}
	if err := uc.users.Create(ctx, u); err != nil {
		return nil, err
	}
	u.PasswordHash = ""
	return u, nil
}

func (uc *AccountUsecase) SetPassword(ctx context.Context, scope domain.Scope, actorRole domain.Role, userID, newPassword string) error {
	if !canManageAccounts(actorRole) {
		return domain.ErrForbidden
	}
	if len(newPassword) < 6 {
		return domain.ErrValidation
	}

	target, err := uc.users.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	// A chapter admin must not be able to reset the password of an account in
	// another chapter — or of an account with no chapter at all, which is how
	// national admins are stored.
	if target.ChapterID == nil || !scope.Allows(*target.ChapterID) {
		return domain.ErrForbidden
	}
	if err := validateGrant(actorRole, target.Role); err != nil {
		return err
	}

	hash, err := password.Hash(newPassword)
	if err != nil {
		return err
	}
	return uc.users.UpdatePasswordHash(ctx, userID, hash)
}

func (uc *AccountUsecase) SetActive(ctx context.Context, scope domain.Scope, actorRole domain.Role, userID string, active bool) error {
	if !canManageAccounts(actorRole) {
		return domain.ErrForbidden
	}
	target, err := uc.users.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if target.ChapterID == nil || !scope.Allows(*target.ChapterID) {
		return domain.ErrForbidden
	}
	if err := validateGrant(actorRole, target.Role); err != nil {
		return err
	}
	return uc.users.SetActive(ctx, userID, active)
}

// ChangeOwnPassword is the self-service path: it needs the current password, so
// a stolen session alone cannot lock the real owner out.
func (uc *AccountUsecase) ChangeOwnPassword(ctx context.Context, userID, current, next string) error {
	if len(next) < 6 {
		return domain.ErrValidation
	}
	user, err := uc.users.FindByID(ctx, userID)
	if err != nil {
		return err
	}
	if !password.Verify(user.PasswordHash, current) {
		return domain.ErrInvalidCredential
	}
	hash, err := password.Hash(next)
	if err != nil {
		return err
	}
	return uc.users.UpdatePasswordHash(ctx, userID, hash)
}

func canManageAccounts(role domain.Role) bool {
	return role.IsNational() || role == domain.RoleChapterAdmin
}

// validateGrant stops privilege escalation: a chapter admin may only create or
// touch roles at or below their own. Without this, a chapter admin could mint
// themselves a national_admin account.
func validateGrant(actor, target domain.Role) error {
	if !target.Valid() {
		return domain.ErrValidation
	}
	if actor.IsNational() {
		return nil
	}
	switch target {
	case domain.RolePIC, domain.RoleMember:
		return nil
	default:
		return domain.ErrForbidden
	}
}
