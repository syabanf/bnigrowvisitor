package domain

import "testing"

func strptr(s string) *string { return &s }

// ResolveScope is the single gate on cross-chapter access, so its behaviour is
// pinned here rather than left to be re-derived by whoever touches it next.
func TestResolveScope(t *testing.T) {
	grow := "chapter-grow"
	rise := "chapter-rise"

	tests := []struct {
		name        string
		role        Role
		ownChapter  *string
		requested   string
		wantErr     error
		wantChapter *string
		wantNational bool
	}{
		{
			name: "national admin with no request sees every chapter",
			role: RoleNationalAdmin, ownChapter: nil, requested: "",
			wantChapter: nil, wantNational: true,
		},
		{
			name: "national admin may target one chapter",
			role: RoleNationalAdmin, ownChapter: nil, requested: rise,
			wantChapter: &rise, wantNational: true,
		},
		{
			name: "chapter admin is pinned to its own chapter",
			role: RoleChapterAdmin, ownChapter: &grow, requested: "",
			wantChapter: &grow, wantNational: false,
		},
		{
			// The important one: a forged chapter id in the query string must
			// not widen a chapter-bound account's reach.
			name: "chapter admin cannot request another chapter",
			role: RoleChapterAdmin, ownChapter: &grow, requested: rise,
			wantChapter: &grow, wantNational: false,
		},
		{
			name: "pic cannot request another chapter either",
			role: RolePIC, ownChapter: &grow, requested: rise,
			wantChapter: &grow, wantNational: false,
		},
		{
			name: "chapter-bound account with no chapter is rejected",
			role: RolePIC, ownChapter: nil, requested: "",
			wantErr: ErrNoChapterScope,
		},
		{
			name: "empty chapter string counts as no chapter",
			role: RoleMember, ownChapter: strptr(""), requested: "",
			wantErr: ErrNoChapterScope,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			scope, err := ResolveScope(tc.role, tc.ownChapter, nil, tc.requested)

			if tc.wantErr != nil {
				if err != tc.wantErr {
					t.Fatalf("err = %v, want %v", err, tc.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if scope.IsNational != tc.wantNational {
				t.Errorf("IsNational = %v, want %v", scope.IsNational, tc.wantNational)
			}
			switch {
			case tc.wantChapter == nil && scope.ChapterID != nil:
				t.Errorf("ChapterID = %q, want nil (all chapters)", *scope.ChapterID)
			case tc.wantChapter != nil && scope.ChapterID == nil:
				t.Errorf("ChapterID = nil, want %q", *tc.wantChapter)
			case tc.wantChapter != nil && *scope.ChapterID != *tc.wantChapter:
				t.Errorf("ChapterID = %q, want %q", *scope.ChapterID, *tc.wantChapter)
			}
		})
	}
}

func TestScopeAllows(t *testing.T) {
	grow := "chapter-grow"

	tests := []struct {
		name  string
		scope Scope
		row   string
		want  bool
	}{
		{"national with no chapter sees everything", Scope{IsNational: true}, "any-chapter", true},
		{"national pinned to a chapter sees only that one", Scope{IsNational: true, ChapterID: &grow}, grow, true},
		{"national pinned to a chapter rejects others", Scope{IsNational: true, ChapterID: &grow}, "other", false},
		{"chapter user sees own chapter", Scope{ChapterID: &grow}, grow, true},
		{"chapter user rejects other chapters", Scope{ChapterID: &grow}, "other", false},
		// A non-national scope with no chapter must deny everything rather than
		// fall through to "allow all".
		{"unscoped non-national denies everything", Scope{}, grow, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := tc.scope.Allows(tc.row); got != tc.want {
				t.Errorf("Allows(%q) = %v, want %v", tc.row, got, tc.want)
			}
		})
	}
}

func TestRoleIsNational(t *testing.T) {
	national := []Role{RoleAdmin, RoleNationalAdmin}
	scoped := []Role{RoleChapterAdmin, RolePIC, RoleMember, Role("bogus")}

	for _, r := range national {
		if !r.IsNational() {
			t.Errorf("%q should be national", r)
		}
	}
	for _, r := range scoped {
		if r.IsNational() {
			t.Errorf("%q should not be national", r)
		}
	}
}
