package domain

import "testing"

func TestAPIScopeValid(t *testing.T) {
	for _, s := range AllAPIScopes() {
		if !s.Valid() {
			t.Errorf("%q harusnya valid", s)
		}
	}
	for _, s := range []APIScope{"", "admin", "finance ", "READONLY", "bukan-scope"} {
		if APIScope(s).Valid() {
			t.Errorf("%q tidak boleh dianggap valid", s)
		}
	}
}

func TestAPIScopeAllows(t *testing.T) {
	cases := []struct {
		held, required APIScope
		want           bool
	}{
		{ScopeReadOnly, ScopeReadOnly, true},
		{ScopeFinance, ScopeFinance, true},
		// finance is a superset: a finance key reads without also holding
		// readonly, which is what stops every route needing a list of scopes.
		{ScopeFinance, ScopeReadOnly, true},
		// And not the other way round. This is the one that matters: a
		// read-only key must never record a renewal.
		{ScopeReadOnly, ScopeFinance, false},
	}
	for _, tc := range cases {
		if got := tc.held.Allows(tc.required); got != tc.want {
			t.Errorf("%q.Allows(%q) = %v, want %v", tc.held, tc.required, got, tc.want)
		}
	}
}

func TestEveryScopeIsDescribed(t *testing.T) {
	// The key-management screen and the API docs both render these, so a scope
	// without a description ships as a blank line rather than an explanation.
	for _, s := range AllAPIScopes() {
		if s.Description() == "" {
			t.Errorf("scope %q tidak punya deskripsi", s)
		}
	}
}
