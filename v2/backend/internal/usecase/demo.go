package usecase

import (
	"context"
	"sort"

	"bni-visitor/internal/domain"
)

// DemoUsecase lists the seeded accounts for the quick sign-in panel.
//
// Read from the database rather than hardcoded in the UI, which is how the login
// screen ended up offering an account nobody had checked still existed. A list
// that comes from the same place the accounts do cannot drift from them.
type DemoUsecase struct {
	users    domain.UserRepository
	chapters domain.ChapterRepository
	enabled  bool
	password string
}

func NewDemoUsecase(users domain.UserRepository, chapters domain.ChapterRepository, enabled bool, password string) *DemoUsecase {
	return &DemoUsecase{users: users, chapters: chapters, enabled: enabled, password: password}
}

func (uc *DemoUsecase) Enabled() bool { return uc.enabled }

type DemoAccount struct {
	Email   string `json:"email"`
	Name    string `json:"name"`
	Role    string `json:"role"`
	Label   string `json:"label"`
	Scope   string `json:"scope"`
	Chapter string `json:"chapter,omitempty"`
}

type DemoAccounts struct {
	Accounts []DemoAccount `json:"accounts"`
	Password string        `json:"password"`
}

var roleLabel = map[domain.Role]string{
	domain.RoleAdmin:         "Super Admin",
	domain.RoleNationalAdmin: "National Admin",
	domain.RoleChapterAdmin:  "Chapter Admin",
	domain.RolePIC:           "PIC",
	domain.RoleMember:        "Member",
}

// roleRank orders the panel by how much the account can see, so the broadest
// view is the first thing offered. Alphabetical order would put PIC above
// national, which is backwards for someone trying the app out.
var roleRank = map[domain.Role]int{
	domain.RoleAdmin: 0, domain.RoleNationalAdmin: 1,
	domain.RoleChapterAdmin: 2, domain.RolePIC: 3, domain.RoleMember: 4,
}

func (uc *DemoUsecase) List(ctx context.Context) (*DemoAccounts, error) {
	if !uc.enabled {
		// Not found rather than forbidden: a 403 would confirm a demo mode
		// exists and is merely switched off, which is a hint worth not giving.
		return nil, domain.ErrNotFound
	}

	users, err := uc.users.ListDemoAccounts(ctx)
	if err != nil {
		return nil, err
	}

	chapterNames := map[string]string{}
	chapters, err := uc.chapters.List(ctx)
	if err != nil {
		return nil, err
	}
	for _, c := range chapters {
		chapterNames[c.ID] = c.Name
	}

	// One account per role-and-chapter. The seed has three PICs in BNI Grow so
	// the visitor list has more than one owner; offering all three on the login
	// screen shows the same view three times and buries the roles that differ.
	seen := map[string]bool{}

	out := make([]DemoAccount, 0, len(users))
	for _, u := range users {
		key := string(u.Role)
		if u.ChapterID != nil {
			key += "|" + *u.ChapterID
		}
		if seen[key] {
			continue
		}
		seen[key] = true

		acc := DemoAccount{
			Email: u.Email, Name: u.Name, Role: string(u.Role),
			Label: roleLabel[u.Role], Scope: "Semua chapter",
		}
		if acc.Label == "" {
			acc.Label = string(u.Role)
		}
		if u.ChapterID != nil {
			if name, ok := chapterNames[*u.ChapterID]; ok {
				acc.Chapter = name
				acc.Scope = name
			}
		}
		out = append(out, acc)
	}

	sort.SliceStable(out, func(i, j int) bool {
		if roleRank[domain.Role(out[i].Role)] != roleRank[domain.Role(out[j].Role)] {
			return roleRank[domain.Role(out[i].Role)] < roleRank[domain.Role(out[j].Role)]
		}
		return out[i].Email < out[j].Email
	})

	return &DemoAccounts{Accounts: out, Password: uc.password}, nil
}
