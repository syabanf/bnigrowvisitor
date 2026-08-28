package usecase

import (
	"context"
	"strings"
	"time"

	"bni-visitor/internal/domain"
)

type GuestUsecase struct {
	guests   domain.GuestRepository
	chapters domain.ChapterRepository
}

func NewGuestUsecase(guests domain.GuestRepository, chapters domain.ChapterRepository) *GuestUsecase {
	return &GuestUsecase{guests: guests, chapters: chapters}
}

type ListGuestsResult struct {
	Data  []domain.Guest `json:"data"`
	Total int            `json:"total"`
}

func (uc *GuestUsecase) List(ctx context.Context, scope domain.Scope, filter domain.GuestFilter) (*ListGuestsResult, error) {
	filter.Limit, filter.Offset = clampPage(filter.Limit, filter.Offset)

	items, err := uc.guests.List(ctx, scope, filter)
	if err != nil {
		return nil, err
	}
	total, err := uc.guests.Count(ctx, scope, filter)
	if err != nil {
		return nil, err
	}
	return &ListGuestsResult{Data: items, Total: total}, nil
}

func (uc *GuestUsecase) Get(ctx context.Context, scope domain.Scope, id string) (*domain.Guest, error) {
	g, err := uc.guests.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !scope.Allows(g.ChapterID) {
		return nil, domain.ErrForbidden
	}
	return g, nil
}

type GuestInput struct {
	Name          string
	Gender        string
	BusinessField string
	Company       string
	Phone         string
	Email         string
	ReferralName  string
	MeetingID     *string
	VisitDate     *time.Time
	MeetingFormat string
	SourceType    string
	Notes         string
	ChapterID     string
}

func (uc *GuestUsecase) Create(ctx context.Context, scope domain.Scope, in GuestInput) (*domain.Guest, error) {
	chapterID, err := resolveChapter(ctx, uc.chapters, scope, in.ChapterID)
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, domain.ErrValidation
	}

	g := &domain.Guest{
		ChapterID: chapterID, Name: name, Gender: in.Gender,
		BusinessField: in.BusinessField, Company: in.Company,
		Phone: strings.TrimSpace(in.Phone), Email: strings.TrimSpace(in.Email),
		ReferralName: in.ReferralName, MeetingID: in.MeetingID, VisitDate: in.VisitDate,
		MeetingFormat: in.MeetingFormat, SourceType: in.SourceType, Notes: in.Notes,
	}
	if err := uc.guests.Create(ctx, g); err != nil {
		return nil, err
	}
	return g, nil
}

func (uc *GuestUsecase) Update(ctx context.Context, scope domain.Scope, id string, in GuestInput) (*domain.Guest, error) {
	existing, err := uc.Get(ctx, scope, id)
	if err != nil {
		return nil, err
	}

	if in.Name != "" {
		existing.Name = strings.TrimSpace(in.Name)
	}
	existing.Gender = in.Gender
	existing.BusinessField = in.BusinessField
	existing.Company = in.Company
	existing.Phone = in.Phone
	existing.Email = in.Email
	existing.ReferralName = in.ReferralName
	existing.MeetingID = in.MeetingID
	existing.MeetingFormat = in.MeetingFormat
	existing.Notes = in.Notes
	if in.VisitDate != nil {
		existing.VisitDate = in.VisitDate
	}

	if err := uc.guests.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (uc *GuestUsecase) Delete(ctx context.Context, scope domain.Scope, id string) error {
	if _, err := uc.Get(ctx, scope, id); err != nil {
		return err
	}
	return uc.guests.Delete(ctx, id)
}
