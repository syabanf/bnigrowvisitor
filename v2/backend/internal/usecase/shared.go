package usecase

import (
	"context"

	"bni-visitor/internal/domain"
)

const (
	defaultPageSize = 50
	maxPageSize     = 200
)

// clampPage bounds the page window. An unbounded list is a denial-of-service
// waiting to happen once a chapter has thousands of rows, so the size is capped
// here rather than trusted from the query string.
func clampPage(limit, offset int) (int, int) {
	if limit <= 0 || limit > maxPageSize {
		limit = defaultPageSize
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}

// resolveChapter decides which chapter a new record belongs to. A chapter-bound
// caller cannot choose: they get their own, whatever they asked for.
func resolveChapter(ctx context.Context, chapters domain.ChapterRepository, scope domain.Scope, requested string) (string, error) {
	if !scope.IsNational {
		if scope.ChapterID == nil {
			return "", domain.ErrNoChapterScope
		}
		return *scope.ChapterID, nil
	}

	if requested == "" {
		if scope.ChapterID == nil {
			return "", domain.ErrValidation
		}
		return *scope.ChapterID, nil
	}
	ok, err := chapters.Exists(ctx, requested)
	if err != nil {
		return "", err
	}
	if !ok {
		return "", domain.ErrNotFound
	}
	return requested, nil
}
