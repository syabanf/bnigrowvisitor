package usecase

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"bni-visitor/internal/domain"
)

type MessagingUsecase struct {
	templates domain.WATemplateRepository
	visitors  domain.VisitorRepository
	chapters  domain.ChapterRepository
	baseURL   string
}

func NewMessagingUsecase(
	templates domain.WATemplateRepository,
	visitors domain.VisitorRepository,
	chapters domain.ChapterRepository,
	baseURL string,
) *MessagingUsecase {
	return &MessagingUsecase{templates: templates, visitors: visitors, chapters: chapters, baseURL: baseURL}
}

func (uc *MessagingUsecase) ListTemplates(ctx context.Context, scope domain.Scope) ([]domain.WATemplate, error) {
	return uc.templates.List(ctx, scope)
}

func (uc *MessagingUsecase) SaveTemplate(ctx context.Context, scope domain.Scope, id, name, body string, isDefault bool) (*domain.WATemplate, error) {
	name = strings.TrimSpace(name)
	if name == "" || strings.TrimSpace(body) == "" {
		return nil, domain.ErrValidation
	}

	if id == "" {
		chapterID, err := resolveChapter(ctx, uc.chapters, scope, "")
		if err != nil {
			return nil, err
		}
		t := &domain.WATemplate{ChapterID: chapterID, Name: name, Body: body, IsDefault: isDefault}
		if err := uc.templates.Create(ctx, t); err != nil {
			return nil, err
		}
		return t, nil
	}

	existing, err := uc.templates.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !scope.Allows(existing.ChapterID) {
		return nil, domain.ErrForbidden
	}
	existing.Name, existing.Body, existing.IsDefault = name, body, isDefault
	if err := uc.templates.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (uc *MessagingUsecase) DeleteTemplate(ctx context.Context, scope domain.Scope, id string) error {
	existing, err := uc.templates.FindByID(ctx, id)
	if err != nil {
		return err
	}
	if !scope.Allows(existing.ChapterID) {
		return domain.ErrForbidden
	}
	return uc.templates.Delete(ctx, id)
}

// BlastMessage is one rendered message plus the wa.me link that sends it.
type BlastMessage struct {
	VisitorID string `json:"visitor_id"`
	Name      string `json:"name"`
	Phone     string `json:"phone"`
	Message   string `json:"message"`
	WhatsApp  string `json:"whatsapp_url"`
	Skipped   string `json:"skipped,omitempty"`
}

// BuildBlast renders a template for each matching visitor and returns the links.
//
// It deliberately does NOT send anything. There is no WhatsApp Business account
// wired up, and silently "sending" through an unofficial gateway is how numbers
// get banned — so the server prepares the messages and a human presses send.
func (uc *MessagingUsecase) BuildBlast(ctx context.Context, scope domain.Scope, templateID string, filter domain.VisitorFilter) ([]BlastMessage, error) {
	template, err := uc.templates.FindByID(ctx, templateID)
	if err != nil {
		return nil, err
	}
	if !scope.Allows(template.ChapterID) {
		return nil, domain.ErrForbidden
	}

	filter.Limit, filter.Offset = clampPage(filter.Limit, filter.Offset)
	visitors, err := uc.visitors.List(ctx, scope, filter)
	if err != nil {
		return nil, err
	}

	messages := make([]BlastMessage, 0, len(visitors))
	for _, v := range visitors {
		msg := BlastMessage{VisitorID: v.ID, Name: v.Name, Phone: v.Phone}

		phone := normalizePhone(v.Phone)
		if phone == "" {
			// Reported rather than dropped: a silently missing recipient is
			// how people discover a week later that nobody was contacted.
			msg.Skipped = "nomor telepon tidak valid"
			messages = append(messages, msg)
			continue
		}

		meetingDate := ""
		if v.MeetingDate != nil {
			meetingDate = v.MeetingDate.Format("2 January 2006")
		}

		msg.Message = domain.RenderTemplate(template.Body, map[string]string{
			"nama":       v.Name,
			"chapter":    v.ChapterName,
			"meeting":    v.MeetingName,
			"tanggal":    meetingDate,
			"pic":        v.PICName,
			"perusahaan": v.Company,
			"link_hadir": uc.confirmationLink(v.ID),
		})
		msg.WhatsApp = fmt.Sprintf("https://wa.me/%s?text=%s", phone, url.QueryEscape(msg.Message))
		messages = append(messages, msg)
	}
	return messages, nil
}

func (uc *MessagingUsecase) confirmationLink(visitorID string) string {
	base := strings.TrimSuffix(uc.baseURL, "/")
	return fmt.Sprintf("%s/wm/%s", base, visitorID)
}

// normalizePhone converts a local Indonesian number to the international form
// wa.me requires. Returns "" when the input cannot be one.
func normalizePhone(raw string) string {
	var digits strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	n := digits.String()

	switch {
	case strings.HasPrefix(n, "0"):
		n = "62" + n[1:]
	case strings.HasPrefix(n, "62"):
		// already international
	case n == "":
		return ""
	default:
		n = "62" + n
	}

	// An Indonesian mobile number is 10-15 digits once prefixed; anything
	// outside that is a typo, not a number worth generating a link for.
	if len(n) < 10 || len(n) > 15 {
		return ""
	}
	return n
}
