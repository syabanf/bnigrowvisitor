package usecase

import (
	"context"
	"strings"
	"time"

	"bni-visitor/internal/domain"
)

type MemberUsecase struct {
	members  domain.MemberRepository
	chapters domain.ChapterRepository
}

func NewMemberUsecase(members domain.MemberRepository, chapters domain.ChapterRepository) *MemberUsecase {
	return &MemberUsecase{members: members, chapters: chapters}
}

type ListMembersResult struct {
	Data  []domain.Member `json:"data"`
	Total int             `json:"total"`
}

func (uc *MemberUsecase) List(ctx context.Context, scope domain.Scope, filter domain.MemberFilter) (*ListMembersResult, error) {
	filter.Limit, filter.Offset = clampPage(filter.Limit, filter.Offset)

	items, err := uc.members.List(ctx, scope, filter)
	if err != nil {
		return nil, err
	}
	total, err := uc.members.Count(ctx, scope, filter)
	if err != nil {
		return nil, err
	}
	return &ListMembersResult{Data: items, Total: total}, nil
}

func (uc *MemberUsecase) Get(ctx context.Context, scope domain.Scope, id string) (*domain.Member, error) {
	m, err := uc.members.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if !scope.Allows(m.ChapterID) {
		return nil, domain.ErrForbidden
	}
	return m, nil
}

type MemberInput struct {
	Name          string
	Phone         string
	Email         string
	BusinessField string
	Company       string
	JoinedDate    *time.Time
	RenewalDate   *time.Time
	Status        string
	Notes         string
	ChapterID     string
}

func (uc *MemberUsecase) Create(ctx context.Context, scope domain.Scope, in MemberInput) (*domain.Member, error) {
	chapterID, err := resolveChapter(ctx, uc.chapters, scope, in.ChapterID)
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, domain.ErrValidation
	}

	status := domain.MemberStatus(in.Status)
	if in.Status == "" {
		status = domain.MemberActive
	}
	if !status.Valid() {
		return nil, domain.ErrValidation
	}

	m := &domain.Member{
		ChapterID: chapterID, Name: name, Phone: strings.TrimSpace(in.Phone),
		Email: strings.TrimSpace(in.Email), BusinessField: in.BusinessField,
		Company: in.Company, JoinedDate: in.JoinedDate, RenewalDate: in.RenewalDate,
		Status: status, Notes: in.Notes,
	}
	if err := uc.members.Create(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

func (uc *MemberUsecase) Update(ctx context.Context, scope domain.Scope, id string, in MemberInput) (*domain.Member, error) {
	existing, err := uc.Get(ctx, scope, id)
	if err != nil {
		return nil, err
	}

	if in.Name != "" {
		existing.Name = strings.TrimSpace(in.Name)
	}
	if in.Status != "" {
		status := domain.MemberStatus(in.Status)
		if !status.Valid() {
			return nil, domain.ErrValidation
		}
		existing.Status = status
	}
	existing.Phone = in.Phone
	existing.Email = in.Email
	existing.BusinessField = in.BusinessField
	existing.Company = in.Company
	existing.Notes = in.Notes
	if in.JoinedDate != nil {
		existing.JoinedDate = in.JoinedDate
	}
	if in.RenewalDate != nil {
		existing.RenewalDate = in.RenewalDate
	}

	if err := uc.members.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (uc *MemberUsecase) Delete(ctx context.Context, scope domain.Scope, id string) error {
	if _, err := uc.Get(ctx, scope, id); err != nil {
		return err
	}
	return uc.members.Delete(ctx, id)
}
