package usecase

import (
	"context"
	"strings"

	"bni-visitor/internal/domain"
)

type VisitorUsecase struct {
	visitors domain.VisitorRepository
	chapters domain.ChapterRepository
}

func NewVisitorUsecase(visitors domain.VisitorRepository, chapters domain.ChapterRepository) *VisitorUsecase {
	return &VisitorUsecase{visitors: visitors, chapters: chapters}
}

type ListVisitorsResult struct {
	Data  []domain.Visitor `json:"data"`
	Total int              `json:"total"`
}

func (uc *VisitorUsecase) List(ctx context.Context, scope domain.Scope, filter domain.VisitorFilter) (*ListVisitorsResult, error) {
	filter.Limit, filter.Offset = clampPage(filter.Limit, filter.Offset)

	items, err := uc.visitors.List(ctx, scope, filter)
	if err != nil {
		return nil, err
	}
	total, err := uc.visitors.Count(ctx, scope, filter)
	if err != nil {
		return nil, err
	}
	return &ListVisitorsResult{Data: items, Total: total}, nil
}

func (uc *VisitorUsecase) Get(ctx context.Context, scope domain.Scope, id string) (*domain.Visitor, error) {
	v, err := uc.visitors.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	// Checked after the read, never folded into the query: a chapter user
	// asking for another chapter's visitor must get a refusal, and the answer
	// must not depend on the repository remembering to filter.
	if !scope.Allows(v.ChapterID) {
		return nil, domain.ErrForbidden
	}
	return v, nil
}

type VisitorInput struct {
	Name          string
	Phone         string
	Email         string
	BusinessField string
	Company       string
	Gender        string
	ReferralName  string
	MeetingID     *string
	PICID         *string
	Status        string
	Notes         string
	ChapterID     string
}

func (uc *VisitorUsecase) Create(ctx context.Context, scope domain.Scope, actorID string, in VisitorInput) (*domain.Visitor, error) {
	chapterID, err := resolveChapter(ctx, uc.chapters, scope, in.ChapterID)
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(in.Name)
	phone := strings.TrimSpace(in.Phone)
	if name == "" || phone == "" {
		return nil, domain.ErrValidation
	}

	status := domain.VisitorStatus(in.Status)
	if in.Status == "" {
		status = domain.StatusNew
	}
	if !status.Valid() {
		return nil, domain.ErrValidation
	}

	v := &domain.Visitor{
		ChapterID: chapterID, Name: name, Phone: phone, Email: strings.TrimSpace(in.Email),
		BusinessField: in.BusinessField, Company: in.Company, Gender: in.Gender,
		ReferralName: in.ReferralName, MeetingID: in.MeetingID, PICID: in.PICID,
		Status: status, Notes: in.Notes, CreatedBy: &actorID,
	}
	if err := uc.visitors.Create(ctx, v); err != nil {
		return nil, err
	}
	return v, nil
}

func (uc *VisitorUsecase) Update(ctx context.Context, scope domain.Scope, id string, in VisitorInput) (*domain.Visitor, error) {
	// Load-then-authorise, so an update can never touch a row the caller was
	// not allowed to read in the first place.
	existing, err := uc.Get(ctx, scope, id)
	if err != nil {
		return nil, err
	}

	if in.Name != "" {
		existing.Name = strings.TrimSpace(in.Name)
	}
	if in.Phone != "" {
		existing.Phone = strings.TrimSpace(in.Phone)
	}
	if in.Status != "" {
		status := domain.VisitorStatus(in.Status)
		if !status.Valid() {
			return nil, domain.ErrValidation
		}
		existing.Status = status
	}
	existing.Email = in.Email
	existing.BusinessField = in.BusinessField
	existing.Company = in.Company
	existing.Gender = in.Gender
	existing.ReferralName = in.ReferralName
	existing.Notes = in.Notes
	existing.MeetingID = in.MeetingID
	existing.PICID = in.PICID

	if err := uc.visitors.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (uc *VisitorUsecase) Delete(ctx context.Context, scope domain.Scope, id string) error {
	if _, err := uc.Get(ctx, scope, id); err != nil {
		return err
	}
	return uc.visitors.Delete(ctx, id)
}
