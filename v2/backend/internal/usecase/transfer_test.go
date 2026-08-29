package usecase

import (
	"io"
	"strings"
	"testing"
	"time"
)

func readAll(t *testing.T, r io.Reader) string {
	t.Helper()
	b, err := io.ReadAll(r)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	return string(b)
}

func TestStripBOM(t *testing.T) {
	// Excel writes a BOM. Left in place it becomes part of the first header
	// name, so the "nama" column lookup silently misses and every row is
	// rejected as missing a name.
	withBOM := "\xEF\xBB\xBFnama,telepon\nBudi,0812"
	got := readAll(t, stripBOM(strings.NewReader(withBOM)))
	if !strings.HasPrefix(got, "nama,") {
		t.Errorf("BOM not stripped: %q", got[:10])
	}

	without := "nama,telepon\nBudi,0812"
	got = readAll(t, stripBOM(strings.NewReader(without)))
	if got != without {
		t.Errorf("a file with no BOM must pass through unchanged, got %q", got)
	}

	// A file shorter than the BOM itself must not be truncated.
	short := "ab"
	got = readAll(t, stripBOM(strings.NewReader(short)))
	if got != short {
		t.Errorf("short input mangled: got %q, want %q", got, short)
	}
}

func TestColumnIndexAndField(t *testing.T) {
	index := columnIndex([]string{"Nama", " TELEPON ", "email"})

	if index["nama"] != 0 || index["telepon"] != 1 || index["email"] != 2 {
		t.Fatalf("header names should be lowercased and trimmed: %v", index)
	}

	record := []string{"Budi", "0812", "budi@test"}
	if got := field(record, index, "nama"); got != "Budi" {
		t.Errorf("field(nama) = %q", got)
	}
	// A column the header never declared must yield "" rather than panic.
	if got := field(record, index, "tidak_ada"); got != "" {
		t.Errorf("unknown column should be empty, got %q", got)
	}
	// A row shorter than the header must not index out of range.
	if got := field([]string{"Budi"}, index, "email"); got != "" {
		t.Errorf("short row should be empty, got %q", got)
	}
}

func TestExportFilename(t *testing.T) {
	at := time.Date(2026, 8, 28, 15, 0, 0, 0, time.UTC)
	if got := ExportFilename("visitors", at, "csv"); got != "visitors-2026-08-28.csv" {
		t.Errorf("ExportFilename csv = %q", got)
	}
	if got := ExportFilename("visitors", at, "xlsx"); got != "visitors-2026-08-28.xlsx" {
		t.Errorf("ExportFilename xlsx = %q", got)
	}
}
