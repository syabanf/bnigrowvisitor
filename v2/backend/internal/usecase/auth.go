// Package usecase carries the application's business rules. It depends on the
// domain layer only — no HTTP types, no SQL, no framework.
package usecase

import (
	"context"
	"strings"
	"time"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/platform/password"
)

type AuthUsecase struct {
	users  domain.UserRepository
	audit  domain.LoginAuditRepository
	logger Logger
}

func NewAuthUsecase(users domain.UserRepository, audit domain.LoginAuditRepository, logger Logger) *AuthUsecase {
	return &AuthUsecase{users: users, audit: audit, logger: logger}
}

type LoginInput struct {
	Email     string
	Password  string
	IP        string
	UserAgent string
}

func (uc *AuthUsecase) Login(ctx context.Context, in LoginInput) (*domain.User, error) {
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if email == "" || in.Password == "" {
		return nil, domain.ErrValidation
	}

	user, err := uc.users.FindByEmail(ctx, email)
	if err != nil && err != domain.ErrNotFound {
		return nil, err
	}

	// Both branches below return the same error to the caller. Distinguishing
	// "no such user" from "wrong password" would turn the login form into an
	// account-enumeration oracle; the reason is recorded for the audit log
	// only, where it is not attacker-visible.
	if user == nil {
		uc.record(ctx, nil, email, false, "user_not_found", in)
		return nil, domain.ErrInvalidCredential
	}

	// A locked account is refused before the password is even checked, and with
	// the same error as a wrong password. Saying "locked" would confirm the
	// account exists and tell an attacker their guessing is working.
	if user.IsLocked(time.Now()) {
		uc.record(ctx, &user.ID, email, false, "account_locked", in)
		return nil, domain.ErrInvalidCredential
	}

	if !password.Verify(user.PasswordHash, in.Password) {
		lockedUntil, err := uc.users.RegisterFailedLogin(
			ctx, user.ID, domain.MaxFailedLogins, domain.LockoutDuration)
		if err != nil {
			uc.logger.Error("gagal mencatat kegagalan login", "user_id", user.ID, "err", err)
		}

		reason := "wrong_password"
		if lockedUntil != nil && lockedUntil.After(time.Now()) {
			reason = "locked_after_failures"
		}
		uc.record(ctx, &user.ID, email, false, reason, in)
		return nil, domain.ErrInvalidCredential
	}

	// A correct password clears the counter, so occasional typos never
	// accumulate into a lockout.
	if user.FailedLoginCount > 0 || user.LockedUntil != nil {
		if err := uc.users.ClearFailedLogins(ctx, user.ID); err != nil {
			uc.logger.Error("gagal mereset penghitung login", "user_id", user.ID, "err", err)
		}
	}

	// Opportunistic upgrade: a hash made at an older cost is re-hashed on a
	// successful login, so the fleet strengthens without a migration.
	if password.NeedsRehash(user.PasswordHash) {
		if hash, err := password.Hash(in.Password); err == nil {
			if err := uc.users.UpdatePasswordHash(ctx, user.ID, hash); err != nil {
				// The user authenticated correctly; a failed upgrade is a
				// maintenance problem, not a reason to deny the login.
				uc.logger.Error("gagal upgrade hash password", "user_id", user.ID, "err", err)
			}
		}
	}

	uc.record(ctx, &user.ID, email, true, "", in)
	return user, nil
}

func (uc *AuthUsecase) Me(ctx context.Context, userID string) (*domain.User, error) {
	return uc.users.FindByID(ctx, userID)
}

func (uc *AuthUsecase) record(ctx context.Context, userID *string, email string, ok bool, reason string, in LoginInput) {
	entry := domain.LoginAttempt{
		UserID: userID, Email: email, Success: ok, Reason: reason,
		IP: in.IP, UserAgent: in.UserAgent,
	}
	if err := uc.audit.Record(ctx, entry); err != nil {
		uc.logger.Error("gagal mencatat login audit", "email", email, "err", err)
	}
}
