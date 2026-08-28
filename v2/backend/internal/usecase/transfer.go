package usecase

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"strings"
	"time"

	"bni-visitor/internal/domain"
)

// TransferUsecase handles bulk export and import.
type TransferUsecase struct {
	visitors domain.VisitorRepository
	members  domain.MemberRepository
	chapters domain.ChapterRepository
}

func NewTransferUsecase(
	visitors domain.VisitorRepository,
	members domain.MemberRepository,
	chapters domain.ChapterRepository,
) *TransferUsecase {
	return &TransferUsecase{visitors: visitors, members: members, chapters: chapters}
}

var visitorHeader = []string{
	"nama", "telepon", "email", "bidang_usaha", "perusahaan", "gender",
	"diajak_oleh", "pic", "meeting", "status", "airtime", "catatan", "dibuat",
}

// ExportVisitors streams CSV straight to the writer instead of building the
// whole file in memory, so a large chapter does not balloon the process.
func (uc *TransferUsecase) ExportVisitors(ctx context.Context, scope domain.Scope, filter domain.VisitorFilter, w io.Writer) error {
	// Excel on a machine with an Indonesian locale reads a UTF-8 CSV as the
	// system codepage unless a BOM says otherwise, which mangles every accented
	// name. The BOM is what makes the file open correctly by double-click.
	if _, err := w.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return err
	}

	out := csv.NewWriter(w)
	defer out.Flush()

	if err := out.Write(visitorHeader); err != nil {
		return err
	}

	// Page through rather than asking for everything at once: the repository
	// caps a single page, and an export must not silently stop at that cap.
	const page = 200
	filter.Limit, filter.Offset = page, 0

	for {
		batch, err := uc.visitors.List(ctx, scope, filter)
		if err != nil {
			return err
		}
		for _, v := range batch {
			airtime := ""
			if v.AttendedChoiceNumber != nil {
				airtime = v.AttendedChoiceNote
			}
			if err := out.Write([]string{
				v.Name, v.Phone, v.Email, v.BusinessField, v.Company, v.Gender,
				v.ReferralName, v.PICName, v.MeetingName, string(v.Status),
				airtime, v.Notes, v.CreatedAt.Format("2006-01-02"),
			}); err != nil {
				return err
			}
		}
		if len(batch) < page {
			return out.Error()
		}
		filter.Offset += page
	}
}

// ImportResult reports per-row outcomes. Rows that fail are named rather than
// counted, because "37 of 40 imported" without saying which three is useless.
type ImportResult struct {
	Imported int           `json:"imported"`
	Skipped  int           `json:"skipped"`
	Errors   []ImportError `json:"errors"`
}

type ImportError struct {
	Row    int    `json:"row"`
	Name   string `json:"name,omitempty"`
	Reason string `json:"reason"`
}

// ImportVisitors reads the same CSV shape ExportVisitors writes.
func (uc *TransferUsecase) ImportVisitors(ctx context.Context, scope domain.Scope, actor Actor, r io.Reader) (*ImportResult, error) {
	chapterID, err := resolveChapter(ctx, uc.chapters, scope, "")
	if err != nil {
		return nil, err
	}

	reader := csv.NewReader(stripBOM(r))
	reader.FieldsPerRecord = -1 // tolerate short rows; each field is checked below
	reader.TrimLeadingSpace = true

	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("%w: file kosong atau bukan CSV", domain.ErrValidation)
	}
	index := columnIndex(header)
	if _, ok := index["nama"]; !ok {
		return nil, fmt.Errorf("%w: kolom 'nama' wajib ada", domain.ErrValidation)
	}

	result := &ImportResult{Errors: []ImportError{}}
	row := 1

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		row++
		if err != nil {
			result.Skipped++
			result.Errors = append(result.Errors, ImportError{Row: row, Reason: "baris tidak terbaca"})
			continue
		}

		name := strings.TrimSpace(field(record, index, "nama"))
		phone := strings.TrimSpace(field(record, index, "telepon"))
		if name == "" || phone == "" {
			result.Skipped++
			result.Errors = append(result.Errors, ImportError{Row: row, Name: name, Reason: "nama dan telepon wajib diisi"})
			continue
		}

		status := domain.VisitorStatus(strings.TrimSpace(field(record, index, "status")))
		if !status.Valid() {
			status = domain.StatusNew
		}

		visitor := &domain.Visitor{
			ChapterID: chapterID, Name: name, Phone: phone,
			Email:         field(record, index, "email"),
			BusinessField: field(record, index, "bidang_usaha"),
			Company:       field(record, index, "perusahaan"),
			Gender:        field(record, index, "gender"),
			ReferralName:  field(record, index, "diajak_oleh"),
			Status:        status,
			Notes:         field(record, index, "catatan"),
			CreatedBy:     actorPtr(actor.ID),
		}

		if err := uc.visitors.Create(ctx, visitor); err != nil {
			result.Skipped++
			reason := "gagal disimpan"
			if err == domain.ErrConflict {
				// The unique index is per meeting, so this only fires for a
				// genuine duplicate within the same meeting.
				reason = "duplikat (nomor sudah ada di meeting yang sama)"
			}
			result.Errors = append(result.Errors, ImportError{Row: row, Name: name, Reason: reason})
			continue
		}
		result.Imported++
	}

	return result, nil
}

func columnIndex(header []string) map[string]int {
	index := make(map[string]int, len(header))
	for i, name := range header {
		index[strings.ToLower(strings.TrimSpace(name))] = i
	}
	return index
}

func field(record []string, index map[string]int, name string) string {
	i, ok := index[name]
	if !ok || i >= len(record) {
		return ""
	}
	return strings.TrimSpace(record[i])
}

// stripBOM drops the marker Excel writes, which would otherwise become part of
// the first header name and break the column lookup.
func stripBOM(r io.Reader) io.Reader {
	buf := make([]byte, 3)
	n, err := io.ReadFull(r, buf)
	if err != nil && err != io.ErrUnexpectedEOF {
		return strings.NewReader("")
	}
	if n == 3 && buf[0] == 0xEF && buf[1] == 0xBB && buf[2] == 0xBF {
		return r
	}
	return io.MultiReader(strings.NewReader(string(buf[:n])), r)
}

// ExportFilename gives the download a name that says what and when.
func ExportFilename(prefix string, now time.Time) string {
	return fmt.Sprintf("%s-%s.csv", prefix, now.Format("2006-01-02"))
}

func actorPtr(id string) *string {
	if id == "" {
		return nil
	}
	return &id
}
