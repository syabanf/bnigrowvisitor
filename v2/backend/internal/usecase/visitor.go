package usecase

import (
	"context"
	"fmt"
	"strings"

	"bni-visitor/internal/domain"
)

type VisitorUsecase struct {
	visitors domain.VisitorRepository
	chapters domain.ChapterRepository
	audit    *auditor
}

func NewVisitorUsecase(
	visitors domain.VisitorRepository,
	chapters domain.ChapterRepository,
	logs domain.ActivityLogRepository,
	logger Logger,
) *VisitorUsecase {
	return &VisitorUsecase{visitors: visitors, chapters: chapters, audit: newAuditor(logs, logger)}
}

type ListVisitorsResult struct {
	Data  []domain.Visitor `json:"data"`
	Total int              `json:"total"`
	// Counts for the whole filtered set, so a summary above the list describes
	// the same rows the list is showing rather than the page on screen.
	ByStatus map[string]int `json:"by_status"`
}

func (uc *VisitorUsecase) List(ctx context.Context, scope domain.Scope, filter domain.VisitorFilter) (*ListVisitorsResult, error) {
	filter.Limit, filter.Offset = clampPage(filter.Limit, filter.Offset)

	// status is a Postgres enum, so an unknown value is a type error rather
	// than an empty result. Left to the database it surfaces as a 500 and
	// writes the caller's string into the error log — a request that is merely
	// wrong should not read as the server breaking, and should not let anyone
	// choose what goes in the log.
	if filter.Status != "" && !domain.VisitorStatus(filter.Status).Valid() {
		return nil, domain.ErrValidation
	}

	items, err := uc.visitors.List(ctx, scope, filter)
	if err != nil {
		return nil, err
	}
	total, err := uc.visitors.Count(ctx, scope, filter)
	if err != nil {
		return nil, err
	}
	byStatus, err := uc.visitors.StatusCounts(ctx, scope, filter)
	if err != nil {
		return nil, err
	}
	return &ListVisitorsResult{Data: items, Total: total, ByStatus: byStatus}, nil
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

// VisitorInput carries a change. The optional fields are pointers so that
// "absent" and "set to empty" are different things.
//
// They used to be plain strings, assigned unconditionally on update — so a
// caller sending only a status silently blanked the email, company, notes and
// PIC. The list screen worked around that by sending the whole row back, which
// then failed the unknown-field check because a read carries fields a write
// does not accept. Both symptoms, one cause.
type VisitorInput struct {
	Name          string
	Phone         string
	Email         *string
	BusinessField *string
	Company       *string
	Gender        *string
	ReferralName  *string
	MeetingID     *string
	PICID         *string
	Status        string
	Notes         *string
	ChapterID     string

	// Explicitly clears the meeting or PIC when true, which a nil pointer
	// cannot express on its own.
	ClearMeeting bool
	ClearPIC     bool

	AttendedChoiceNumber *int
}

func (uc *VisitorUsecase) Create(ctx context.Context, scope domain.Scope, actor Actor, in VisitorInput) (*domain.Visitor, error) {
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

	// On create, an absent optional field is simply empty — there is nothing to
	// preserve, so the pointer distinction that matters on update does not
	// apply here.
	v := &domain.Visitor{
		ChapterID: chapterID, Name: name, Phone: phone,
		Email:         strings.TrimSpace(deref(in.Email)),
		BusinessField: deref(in.BusinessField),
		Company:       deref(in.Company),
		Gender:        deref(in.Gender),
		ReferralName:  deref(in.ReferralName),
		MeetingID:     in.MeetingID, PICID: in.PICID,
		Status: status, Notes: deref(in.Notes),
	}
	if actor.ID != "" {
		v.CreatedBy = &actor.ID
	}
	if err := uc.visitors.Create(ctx, v); err != nil {
		return nil, err
	}
	uc.audit.record(ctx, actor, v.ChapterID, "create", "visitor", v.ID, v.Name)
	return v, nil
}

func (uc *VisitorUsecase) Update(ctx context.Context, scope domain.Scope, actor Actor, id string, in VisitorInput) (*domain.Visitor, error) {
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
	// Only what was sent is changed.
	if in.Email != nil {
		existing.Email = *in.Email
	}
	if in.BusinessField != nil {
		existing.BusinessField = *in.BusinessField
	}
	if in.Company != nil {
		existing.Company = *in.Company
	}
	if in.Gender != nil {
		existing.Gender = *in.Gender
	}
	if in.ReferralName != nil {
		existing.ReferralName = *in.ReferralName
	}
	if in.Notes != nil {
		existing.Notes = *in.Notes
	}
	if in.MeetingID != nil || in.ClearMeeting {
		existing.MeetingID = in.MeetingID
	}
	if in.PICID != nil || in.ClearPIC {
		existing.PICID = in.PICID
	}
	if in.AttendedChoiceNumber != nil {
		if label, known := domain.AirtimeChoice[*in.AttendedChoiceNumber]; known {
			existing.AttendedChoiceNumber = in.AttendedChoiceNumber
			existing.AttendedChoiceNote = label
		}
	}

	if err := uc.visitors.Update(ctx, existing); err != nil {
		return nil, err
	}
	uc.audit.record(ctx, actor, existing.ChapterID, "update", "visitor", existing.ID, existing.Name)
	return existing, nil
}

func (uc *VisitorUsecase) Delete(ctx context.Context, scope domain.Scope, actor Actor, id string) error {
	existing, err := uc.Get(ctx, scope, id)
	if err != nil {
		return err
	}
	if err := uc.visitors.Delete(ctx, id); err != nil {
		return err
	}
	// Recorded after the delete succeeds, and the label carries the name — the
	// row is gone, so the log is the only place it survives.
	uc.audit.record(ctx, actor, existing.ChapterID, "delete", "visitor", existing.ID, existing.Name)
	return nil
}

// RecordAirtime stores the MCQA outcome for a visitor who attended.
//
// The status guard matters: an airtime result against someone who never turned
// up would quietly skew the MCQA report, and the database rejects it anyway, so
// catching it here turns a constraint violation into a clear validation error.
func (uc *VisitorUsecase) RecordAirtime(ctx context.Context, scope domain.Scope, actor Actor, id string, choice *int) (*domain.Visitor, error) {
	visitor, err := uc.Get(ctx, scope, id)
	if err != nil {
		return nil, err
	}

	if choice == nil {
		// Clearing is always allowed — a result recorded by mistake must be
		// removable regardless of the current status.
		visitor.AttendedChoiceNumber = nil
		visitor.AttendedChoiceNote = ""
	} else {
		label, known := domain.AirtimeChoice[*choice]
		if !known {
			return nil, domain.ErrValidation
		}
		if !visitor.Status.CanRecordAirtime() {
			return nil, fmt.Errorf("%w: airtime hanya untuk visitor yang sudah hadir", domain.ErrValidation)
		}
		visitor.AttendedChoiceNumber = choice
		visitor.AttendedChoiceNote = label
	}

	if err := uc.visitors.Update(ctx, visitor); err != nil {
		return nil, err
	}
	uc.audit.record(ctx, actor, visitor.ChapterID, "update", "mcqa", visitor.ID, visitor.Name)
	return visitor, nil
}

// ConfirmAttendance backs the public WhatsApp link. It takes no session: the
// visitor id in the URL is the only credential, which is acceptable because a
// v4 UUID is not guessable and confirming is a narrow, idempotent action.
//
// It never walks a visitor backwards — a status past confirmation is reported
// as already-done rather than reset, so re-opening an old link cannot undo an
// attendance record.
func (uc *VisitorUsecase) ConfirmAttendance(ctx context.Context, id string) (*domain.Visitor, bool, error) {
	visitor, err := uc.visitors.FindByID(ctx, id)
	if err != nil {
		return nil, false, err
	}

	if !visitor.Status.CanConfirmAttendance() {
		return visitor, false, nil
	}

	visitor.Status = domain.StatusConfirmed
	if err := uc.visitors.Update(ctx, visitor); err != nil {
		return nil, false, err
	}
	// No actor: the visitor confirmed it themselves through the public link.
	uc.audit.record(ctx, Actor{Name: visitor.Name, Role: "visitor"},
		visitor.ChapterID, "update", "konfirmasi", visitor.ID, visitor.Name)
	return visitor, true, nil
}

// deref reads an optional string, treating absent as empty.
func deref(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
