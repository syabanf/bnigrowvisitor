package usecase

import (
	"testing"

	"bni-visitor/internal/domain"
)

// validateGrant is what stops a chapter admin from minting themselves a
// national account, so every rung of the ladder is asserted explicitly.
func TestValidateGrant(t *testing.T) {
	tests := []struct {
		name    string
		actor   domain.Role
		target  domain.Role
		wantErr error
	}{
		{"national admin may create a chapter admin", domain.RoleNationalAdmin, domain.RoleChapterAdmin, nil},
		{"national admin may create another national admin", domain.RoleNationalAdmin, domain.RoleNationalAdmin, nil},
		{"chapter admin may create a pic", domain.RoleChapterAdmin, domain.RolePIC, nil},
		{"chapter admin may create a member", domain.RoleChapterAdmin, domain.RoleMember, nil},

		// The escalation attempts.
		{"chapter admin may NOT create a national admin", domain.RoleChapterAdmin, domain.RoleNationalAdmin, domain.ErrForbidden},
		{"chapter admin may NOT create an admin", domain.RoleChapterAdmin, domain.RoleAdmin, domain.ErrForbidden},
		{"chapter admin may NOT create another chapter admin", domain.RoleChapterAdmin, domain.RoleChapterAdmin, domain.ErrForbidden},

		{"unknown role is rejected outright", domain.RoleChapterAdmin, domain.Role("superuser"), domain.ErrValidation},
		{"empty role is rejected", domain.RoleNationalAdmin, domain.Role(""), domain.ErrValidation},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if err := validateGrant(tc.actor, tc.target); err != tc.wantErr {
				t.Errorf("validateGrant(%q, %q) = %v, want %v", tc.actor, tc.target, err, tc.wantErr)
			}
		})
	}
}

func TestCanManageAccounts(t *testing.T) {
	allowed := []domain.Role{domain.RoleAdmin, domain.RoleNationalAdmin, domain.RoleChapterAdmin}
	denied := []domain.Role{domain.RolePIC, domain.RoleMember, domain.Role("")}

	for _, r := range allowed {
		if !canManageAccounts(r) {
			t.Errorf("%q should be able to manage accounts", r)
		}
	}
	for _, r := range denied {
		if canManageAccounts(r) {
			t.Errorf("%q should NOT be able to manage accounts", r)
		}
	}
}

func TestClampPage(t *testing.T) {
	tests := []struct {
		name                  string
		limit, offset         int
		wantLimit, wantOffset int
	}{
		{"zero falls back to the default", 0, 0, defaultPageSize, 0},
		{"negative falls back to the default", -5, -10, defaultPageSize, 0},
		{"an oversized page is capped", 100000, 0, defaultPageSize, 0},
		{"a sane page is left alone", 25, 50, 25, 50},
		{"exactly at the cap is kept", maxPageSize, 0, maxPageSize, 0},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			limit, offset := clampPage(tc.limit, tc.offset)
			if limit != tc.wantLimit || offset != tc.wantOffset {
				t.Errorf("clampPage(%d,%d) = (%d,%d), want (%d,%d)",
					tc.limit, tc.offset, limit, offset, tc.wantLimit, tc.wantOffset)
			}
		})
	}
}
