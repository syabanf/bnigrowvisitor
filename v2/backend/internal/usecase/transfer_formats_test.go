package usecase

import (
	"bytes"
	"io"
	"strings"
	"testing"

	"github.com/xuri/excelize/v2"
)

// drain collects everything a rowSource yields, so a test can assert on the
// shape the import actually sees rather than on the parser's internals.
func drain(t *testing.T, src rowSource) [][]string {
	t.Helper()
	var out [][]string
	for {
		row, err := src.Next()
		if err == io.EOF {
			return out
		}
		if err != nil {
			t.Fatalf("Next: %v", err)
		}
		out = append(out, row)
	}
}

func workbook(t *testing.T, sheet string, rows [][]any) []byte {
	t.Helper()
	f := excelize.NewFile()
	defer f.Close()
	if _, err := f.NewSheet(sheet); err != nil {
		t.Fatal(err)
	}
	if sheet != "Sheet1" {
		if err := f.DeleteSheet("Sheet1"); err != nil {
			t.Fatal(err)
		}
	}
	for i, row := range rows {
		cell, _ := excelize.CoordinatesToCellName(1, i+1)
		if err := f.SetSheetRow(sheet, cell, &row); err != nil {
			t.Fatal(err)
		}
	}
	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestReadRowsDetectsFormatFromContent(t *testing.T) {
	// The point of sniffing: neither of these carries a filename, and a renamed
	// export is the common case.
	t.Run("csv", func(t *testing.T) {
		src, err := readRows(strings.NewReader("nama,telepon\nBudi,0812\n"))
		if err != nil {
			t.Fatal(err)
		}
		got := drain(t, src)
		if len(got) != 2 || got[1][0] != "Budi" {
			t.Fatalf("rows = %v", got)
		}
	})

	t.Run("xlsx", func(t *testing.T) {
		raw := workbook(t, "Visitor", [][]any{
			{"nama", "telepon"},
			{"Budi", "0812"},
		})
		src, err := readRows(bytes.NewReader(raw))
		if err != nil {
			t.Fatal(err)
		}
		got := drain(t, src)
		if len(got) != 2 || got[1][0] != "Budi" {
			t.Fatalf("rows = %v", got)
		}
	})

	// A CSV that happens to start with "PK" is text, not a workbook — the magic
	// bytes are four, not two, and truncating the check would misroute it.
	t.Run("csv starting with PK is still csv", func(t *testing.T) {
		src, err := readRows(strings.NewReader("nama,telepon\nPKS Motor,0812\n"))
		if err != nil {
			t.Fatal(err)
		}
		if got := drain(t, src); len(got) != 2 {
			t.Fatalf("rows = %v", got)
		}
	})
}

func TestReadRowsRejectsCorruptWorkbook(t *testing.T) {
	// Zip magic with nothing valid behind it: this must be a validation error,
	// not a panic and not an empty import reported as success.
	src, err := readRows(bytes.NewReader([]byte("PK\x03\x04 and then rubbish")))
	if err == nil {
		t.Fatalf("expected an error, got source %#v", src)
	}
	if !strings.Contains(err.Error(), "Excel") {
		t.Errorf("error should name the format, got %q", err)
	}
}

func TestXLSXReadsFirstSheetNotTheActiveOne(t *testing.T) {
	f := excelize.NewFile()
	defer f.Close()
	first, _ := f.NewSheet("Data")
	second, _ := f.NewSheet("Catatan")
	_ = first
	if err := f.DeleteSheet("Sheet1"); err != nil {
		t.Fatal(err)
	}
	f.SetSheetRow("Data", "A1", &[]any{"nama"})
	f.SetSheetRow("Data", "A2", &[]any{"Dari sheet pertama"})
	f.SetSheetRow("Catatan", "A1", &[]any{"nama"})
	f.SetSheetRow("Catatan", "A2", &[]any{"Dari sheet kedua"})
	// Saved with the second sheet selected, which is incidental to the file's
	// content and must not change what gets imported.
	f.SetActiveSheet(second)

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		t.Fatal(err)
	}

	src, err := readRows(&buf)
	if err != nil {
		t.Fatal(err)
	}
	got := drain(t, src)
	if len(got) < 2 || got[1][0] != "Dari sheet pertama" {
		t.Fatalf("read the wrong sheet: %v", got)
	}
}

func TestIsBlankRow(t *testing.T) {
	cases := []struct {
		name string
		row  []string
		want bool
	}{
		{"empty slice", nil, true},
		{"all empty strings", []string{"", "", ""}, true},
		{"whitespace only", []string{" ", "\t", "  "}, true},
		{"one value", []string{"", "Budi", ""}, false},
		// A row holding only a zero is data, not padding.
		{"zero is a value", []string{"0"}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := isBlankRow(tc.row); got != tc.want {
				t.Errorf("isBlankRow(%q) = %v, want %v", tc.row, got, tc.want)
			}
		})
	}
}
