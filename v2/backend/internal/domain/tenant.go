package domain

import (
	"context"
	"strings"
	"time"
)

// ChapterDomain maps a host to the chapter it serves, so one deployment can
// brand itself per tenant without a build per chapter.
type ChapterDomain struct {
	ID        string `json:"id"`
	ChapterID string `json:"chapter_id"`
	Domain    string `json:"domain"`
	Type      string `json:"type"`
	IsPrimary bool   `json:"is_primary"`
}

// TenantContext is what the login screen needs before any session exists, so it
// deliberately carries names only — never counts, ids of other tenants, or
// anything that would leak one chapter's shape to another.
type TenantContext struct {
	Host        string   `json:"host"`
	Matched     bool     `json:"matched"`
	Chapter     *Chapter `json:"chapter,omitempty"`
	DisplayName string   `json:"display_name,omitempty"`
}

type DomainRepository interface {
	FindByHost(ctx context.Context, host string) (*ChapterDomain, error)
	ListByChapter(ctx context.Context, chapterID string) ([]ChapterDomain, error)
}

// NormalizeHost strips the parts of a Host header that must not change which
// tenant is resolved: case, a www. prefix, and any trailing dot.
func NormalizeHost(host string) string {
	h := strings.ToLower(strings.TrimSpace(host))
	h = strings.TrimSuffix(h, ".")
	return strings.TrimPrefix(h, "www.")
}

// WATemplate is a WhatsApp message with {placeholder} slots.
type WATemplate struct {
	ID        string    `json:"id"`
	ChapterID string    `json:"chapter_id"`
	Name      string    `json:"name"`
	Body      string    `json:"body"`
	IsDefault bool      `json:"is_default"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type WATemplateRepository interface {
	List(ctx context.Context, scope Scope) ([]WATemplate, error)
	FindByID(ctx context.Context, id string) (*WATemplate, error)
	Create(ctx context.Context, t *WATemplate) error
	Update(ctx context.Context, t *WATemplate) error
	Delete(ctx context.Context, id string) error
}

// RenderTemplate substitutes {placeholder} slots. Unknown placeholders are left
// as-is rather than blanked: a visible {typo} in the preview tells the author
// what went wrong, while a silent empty string hides it until the message is
// already sent.
func RenderTemplate(body string, values map[string]string) string {
	out := body
	for key, value := range values {
		out = strings.ReplaceAll(out, "{"+key+"}", value)
	}
	return out
}

// ActivityLog records who changed what.
type ActivityLog struct {
	ID          string    `json:"id"`
	ActorID     *string   `json:"actor_id,omitempty"`
	ActorName   string    `json:"actor_name,omitempty"`
	ActorRole   string    `json:"actor_role,omitempty"`
	ChapterID   *string   `json:"chapter_id,omitempty"`
	Action      string    `json:"action"`
	Entity      string    `json:"entity"`
	EntityID    *string   `json:"entity_id,omitempty"`
	EntityLabel string    `json:"entity_label,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// ActivityFilter narrows the audit trail. Without Count alongside List the UI
// can only report how many rows one page happens to hold, which reads as a
// total and is wrong the moment the table outgrows a page.
type ActivityFilter struct {
	Action string
	Entity string
	Limit  int
	Offset int
}

type ActivityLogRepository interface {
	Record(ctx context.Context, entry ActivityLog) error
	List(ctx context.Context, scope Scope, filter ActivityFilter) ([]ActivityLog, error)
	Count(ctx context.Context, scope Scope, filter ActivityFilter) (int, error)
}
