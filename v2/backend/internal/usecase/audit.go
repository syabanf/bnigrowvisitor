package usecase

import (
	"context"

	"bni-visitor/internal/domain"
)

// Actor is who performed a change. Carried explicitly rather than dug out of a
// request context, so the use cases stay free of HTTP.
type Actor struct {
	ID   string
	Name string
	Role string
}

// auditor records data changes. It is a thin wrapper rather than a bare
// repository call because a failure to log must never fail the operation that
// succeeded — losing an audit line is bad, rolling back a saved visitor because
// the audit insert failed is worse.
type auditor struct {
	logs   domain.ActivityLogRepository
	logger Logger
}

func newAuditor(logs domain.ActivityLogRepository, logger Logger) *auditor {
	return &auditor{logs: logs, logger: logger}
}

func (a *auditor) record(ctx context.Context, actor Actor, chapterID, action, entity, entityID, label string) {
	if a == nil || a.logs == nil {
		return
	}

	entry := domain.ActivityLog{
		ActorName:   actor.Name,
		ActorRole:   actor.Role,
		Action:      action,
		Entity:      entity,
		EntityLabel: label,
	}
	if actor.ID != "" {
		entry.ActorID = &actor.ID
	}
	if chapterID != "" {
		entry.ChapterID = &chapterID
	}
	if entityID != "" {
		entry.EntityID = &entityID
	}

	if err := a.logs.Record(ctx, entry); err != nil {
		a.logger.Error("gagal mencatat aktivitas",
			"entity", entity, "action", action, "err", err)
	}
}
