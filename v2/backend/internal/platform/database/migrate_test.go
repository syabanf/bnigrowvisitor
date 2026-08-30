package database

import (
	"strings"
	"testing"
)

// Every migration is either schema or demonstration data, and the filename is
// what says which. A new seed migration named without the marker would run in
// production and put accounts with a published password on a reachable host —
// which is not a hypothetical, it is what was found on one.
func TestEveryMigrationDeclaresItsKind(t *testing.T) {
	migrations, err := loadMigrations()
	if err != nil {
		t.Fatal(err)
	}
	if len(migrations) == 0 {
		t.Fatal("tidak ada migrasi yang terbaca")
	}

	// Statements that only appear in demonstration data. A migration carrying
	// one of these while not marked as a seed is the failure this guards.
	seedish := []string{
		"INSERT INTO users", "INSERT INTO visitors", "INSERT INTO members",
		"INSERT INTO guests", "INSERT INTO meetings", "INSERT INTO api_keys",
	}

	for _, m := range migrations {
		body := strings.ToUpper(m.body)
		carriesData := false
		for _, marker := range seedish {
			if strings.Contains(body, strings.ToUpper(marker)) {
				carriesData = true
				break
			}
		}
		if carriesData && !m.seed {
			t.Errorf("%s memasukkan data contoh tapi namanya tidak mengandung %q — "+
				"migrasi ini akan ikut jalan di production", m.version, seedMarker)
		}
	}
}

func TestSeedClassificationMatchesFilenames(t *testing.T) {
	migrations, err := loadMigrations()
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range migrations {
		want := strings.Contains(m.version, seedMarker)
		if m.seed != want {
			t.Errorf("%s: seed=%v, dari nama file harusnya %v", m.version, m.seed, want)
		}
	}
}

// The marker must not match a schema migration by accident. "search_indexes"
// sits one letter away from it, which is close enough to be worth pinning.
func TestSeedMarkerDoesNotMatchSchemaNames(t *testing.T) {
	for _, name := range []string{
		"011_search_indexes.sql", "013_search_index_gaps.sql",
		"014_member_search_index.sql", "001_init.sql", "012_lockout_retention.sql",
	} {
		if strings.Contains(name, seedMarker) {
			t.Errorf("%s salah diklasifikasikan sebagai data contoh", name)
		}
	}
}
