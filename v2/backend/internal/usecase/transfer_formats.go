package usecase

import (
	"bufio"
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"strings"

	"github.com/xuri/excelize/v2"

	"bni-visitor/internal/domain"
)

// zipMagic is the first four bytes of every .xlsx file: a workbook is a zip
// archive of XML parts. Detecting on content rather than on the filename means
// a mis-named export still imports, which is most of them.
var zipMagic = []byte{'P', 'K', 0x03, 0x04}

func readRows(r io.Reader) (rowSource, error) {
	// Buffered so the magic bytes can be inspected and then handed on intact;
	// the underlying reader may not be seekable.
	buf := bufio.NewReader(r)
	head, err := buf.Peek(4)
	if err != nil && err != io.EOF {
		return nil, fmt.Errorf("%w: file tidak terbaca", domain.ErrValidation)
	}

	if bytes.HasPrefix(head, zipMagic) {
		return newXLSXRows(buf)
	}
	return newCSVRows(buf), nil
}

// --- CSV -------------------------------------------------------------------

type csvRows struct{ r *csv.Reader }

func newCSVRows(r io.Reader) *csvRows {
	reader := csv.NewReader(stripBOM(r))
	reader.FieldsPerRecord = -1 // tolerate short rows; each field is checked on use
	reader.TrimLeadingSpace = true
	return &csvRows{r: reader}
}

func (c *csvRows) Next() ([]string, error) { return c.r.Read() }

// --- XLSX ------------------------------------------------------------------

type xlsxRows struct {
	rows [][]string
	at   int
}

// newXLSXRows reads the first sheet.
//
// The whole sheet is held in memory rather than streamed: the upload is capped
// at 5 MiB by the handler, which bounds this, and excelize's row iterator does
// not resolve shared strings on its own — the very thing that makes a real
// workbook readable at all.
func newXLSXRows(r io.Reader) (*xlsxRows, error) {
	f, err := excelize.OpenReader(r)
	if err != nil {
		return nil, fmt.Errorf("%w: file Excel tidak terbaca", domain.ErrValidation)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("%w: workbook tidak punya sheet", domain.ErrValidation)
	}

	// The first sheet, not the active one: which sheet was selected when the
	// file was last saved is incidental, and an import that depends on it would
	// read a different sheet for the same file depending on who saved it.
	rows, err := f.GetRows(sheets[0])
	if err != nil {
		return nil, fmt.Errorf("%w: sheet '%s' tidak terbaca", domain.ErrValidation, sheets[0])
	}
	return &xlsxRows{rows: rows}, nil
}

func (x *xlsxRows) Next() ([]string, error) {
	if x.at >= len(x.rows) {
		return nil, io.EOF
	}
	row := x.rows[x.at]
	x.at++
	return row, nil
}

// isBlankRow reports a row with nothing in it. Spreadsheets accumulate trailing
// empty rows from any cell someone once clicked into, and reporting those as
// failures would show dozens of errors for a file that imported perfectly.
func isBlankRow(record []string) bool {
	for _, cell := range record {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}

// --- XLSX export -----------------------------------------------------------

const exportSheet = "Visitor"

// ExportVisitorsXLSX writes the same columns as the CSV export.
//
// Deliberately the same shape: a file exported as Excel has to import back
// through the same path, and a second column layout would be a second thing to
// keep in step.
func (uc *TransferUsecase) ExportVisitorsXLSX(ctx context.Context, scope domain.Scope, filter domain.VisitorFilter, w io.Writer) error {
	f := excelize.NewFile()
	defer f.Close()

	index, err := f.NewSheet(exportSheet)
	if err != nil {
		return err
	}
	f.SetActiveSheet(index)
	// NewFile creates a default sheet that would otherwise ship as an empty
	// first tab — and the import reads the first sheet.
	if err := f.DeleteSheet("Sheet1"); err != nil {
		return err
	}

	// A stream writer rather than SetCellValue per cell: it writes rows out as
	// it goes instead of building the whole sheet in memory, which is what lets
	// a large chapter export without the process growing to match.
	sw, err := f.NewStreamWriter(exportSheet)
	if err != nil {
		return err
	}

	header := make([]any, len(visitorHeader))
	for i, h := range visitorHeader {
		header[i] = h
	}
	if err := sw.SetRow("A1", header, excelize.RowOpts{StyleID: 0}); err != nil {
		return err
	}

	line := 2
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
			cell, err := excelize.CoordinatesToCellName(1, line)
			if err != nil {
				return err
			}
			if err := sw.SetRow(cell, []any{
				v.Name, v.Phone, v.Email, v.BusinessField, v.Company, v.Gender,
				v.ReferralName, v.PICName, v.MeetingName, string(v.Status),
				airtime, v.Notes, v.CreatedAt.Format("2006-01-02"),
			}); err != nil {
				return err
			}
			line++
		}
		if len(batch) < page {
			break
		}
		filter.Offset += page
	}

	if err := sw.Flush(); err != nil {
		return err
	}
	return f.Write(w)
}
