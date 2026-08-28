package usecase

import (
	"context"

	"bni-visitor/internal/domain"
)

type TenantUsecase struct {
	domains  domain.DomainRepository
	chapters domain.ChapterRepository
}

func NewTenantUsecase(domains domain.DomainRepository, chapters domain.ChapterRepository) *TenantUsecase {
	return &TenantUsecase{domains: domains, chapters: chapters}
}

// Resolve answers "which chapter does this host belong to". It is deliberately
// public — the login screen needs chapter branding before any session exists —
// so it returns names only, never counts or ids belonging to other tenants.
//
// An unknown host is not an error: it means the national entry point, and the
// caller renders the neutral branding.
func (uc *TenantUsecase) Resolve(ctx context.Context, rawHost string) (*domain.TenantContext, error) {
	host := domain.NormalizeHost(rawHost)
	result := &domain.TenantContext{Host: host}
	if host == "" {
		return result, nil
	}

	mapping, err := uc.domains.FindByHost(ctx, host)
	if err == domain.ErrNotFound {
		return result, nil
	}
	if err != nil {
		return nil, err
	}

	chapter, err := uc.chapters.FindByID(ctx, mapping.ChapterID)
	if err == domain.ErrNotFound {
		// A domain row pointing at a deleted chapter is stale data, not a
		// reason to fail the login page.
		return result, nil
	}
	if err != nil {
		return nil, err
	}

	result.Matched = true
	result.Chapter = chapter
	result.DisplayName = chapter.DisplayName
	return result, nil
}
