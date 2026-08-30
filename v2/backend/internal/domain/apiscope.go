package domain

import "slices"

// APIScope is what an API key is allowed to do on the external API.
//
// The scopes were previously decorative: the key-management screen offered
// "readonly", nothing validated it on the way in, and every external route
// demanded exactly "finance" — so choosing readonly produced a key that was
// refused by everything it could be pointed at, with nothing at creation time
// to say so.
type APIScope string

const (
	// ScopeReadOnly can read the member list and a single member.
	ScopeReadOnly APIScope = "readonly"
	// ScopeFinance can do that and record a renewal. Renewal is the only write
	// the external API has, so this is the only scope that needs to exceed
	// read.
	ScopeFinance APIScope = "finance"
)

var apiScopes = []APIScope{ScopeReadOnly, ScopeFinance}

func AllAPIScopes() []APIScope {
	out := make([]APIScope, len(apiScopes))
	copy(out, apiScopes)
	return out
}

func (s APIScope) Valid() bool { return slices.Contains(apiScopes, s) }

// Allows reports whether this scope satisfies what a route asks for.
//
// finance is a superset of readonly rather than a sibling, so a finance key
// reads without needing both scopes attached. Modelled here rather than as a
// list on each route, so adding a scope cannot silently widen an existing one.
func (s APIScope) Allows(required APIScope) bool {
	if s == required {
		return true
	}
	return s == ScopeFinance && required == ScopeReadOnly
}

var apiScopeDescriptions = map[APIScope]string{
	ScopeReadOnly: "Membaca daftar member dan detail satu member.",
	ScopeFinance:  "Membaca member, dan mencatat perpanjangan keanggotaan.",
}

func (s APIScope) Description() string { return apiScopeDescriptions[s] }
