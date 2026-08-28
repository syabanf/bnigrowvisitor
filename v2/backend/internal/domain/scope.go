package domain

// Scope is the answer to "which chapters may this session touch". It is the
// single place that decision is made, so no repository or handler has to
// re-derive it — and no handler can widen it by accident.
type Scope struct {
	IsNational bool
	// nil means every chapter (national admin with no chapter selected).
	// A value means restrict to exactly that chapter.
	ChapterID      *string
	OrganizationID *string
}

// ResolveScope derives the permitted scope from the session's own role and
// chapter. requested is client input and is honoured only for national roles;
// a chapter-bound account is always pinned to its own chapter, so a forged
// chapter id in a query string cannot widen access.
func ResolveScope(role Role, ownChapterID *string, organizationID *string, requested string) (Scope, error) {
	if role.IsNational() {
		if requested == "" {
			return Scope{IsNational: true, OrganizationID: organizationID}, nil
		}
		return Scope{IsNational: true, ChapterID: &requested, OrganizationID: organizationID}, nil
	}

	if ownChapterID == nil || *ownChapterID == "" {
		return Scope{}, ErrNoChapterScope
	}
	return Scope{IsNational: false, ChapterID: ownChapterID, OrganizationID: organizationID}, nil
}

// Allows reports whether a record belonging to chapterID is inside this scope.
func (s Scope) Allows(chapterID string) bool {
	if s.ChapterID == nil {
		return s.IsNational
	}
	return *s.ChapterID == chapterID
}
