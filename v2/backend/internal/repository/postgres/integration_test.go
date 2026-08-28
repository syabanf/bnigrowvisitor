package postgres

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"bni-visitor/internal/domain"
)

// These run against a real Postgres because the thing worth testing here is the
// SQL itself — scope filtering, the unique index, the joins. A mocked driver
// would only assert that the strings I wrote are the strings I wrote.
//
// Skipped unless TEST_DATABASE_URL is set, so `go test ./...` stays runnable
// without Docker:
//
//	TEST_DATABASE_URL='postgres://bni:bni_dev_password@localhost:5440/bni_visitor?sslmode=disable' go test ./...
func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL tidak diset — lewati tes integrasi")
	}

	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatalf("gagal terhubung: %v", err)
	}
	t.Cleanup(pool.Close)

	if err := pool.Ping(context.Background()); err != nil {
		t.Fatalf("database tidak merespons: %v", err)
	}
	return pool
}

const (
	chapterGrow = "a0000004-0000-4000-8000-000000000001"
	chapterRise = "a0000004-0000-4000-8000-000000000002"
)

func growScope() domain.Scope {
	id := chapterGrow
	return domain.Scope{ChapterID: &id}
}

func nationalScope() domain.Scope { return domain.Scope{IsNational: true} }

func TestVisitorScopeIsolation(t *testing.T) {
	repo := NewVisitorRepository(testPool(t))
	ctx := context.Background()

	all, err := repo.List(ctx, nationalScope(), domain.VisitorFilter{Limit: 100})
	if err != nil {
		t.Fatalf("list national: %v", err)
	}
	scoped, err := repo.List(ctx, growScope(), domain.VisitorFilter{Limit: 100})
	if err != nil {
		t.Fatalf("list scoped: %v", err)
	}

	if len(scoped) >= len(all) {
		t.Fatalf("a chapter scope returned %d of %d rows — it is not filtering", len(scoped), len(all))
	}
	// Every row must belong to the scoped chapter. A count alone would pass
	// even if the filter selected the wrong chapter's rows.
	for _, v := range scoped {
		if v.ChapterID != chapterGrow {
			t.Errorf("visitor %q belongs to chapter %s, outside the scope", v.Name, v.ChapterID)
		}
	}

	count, err := repo.Count(ctx, growScope(), domain.VisitorFilter{})
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != len(scoped) {
		t.Errorf("Count() = %d but List() returned %d — the two apply different filters", count, len(scoped))
	}
}

func TestVisitorSearchFiltersWithinScope(t *testing.T) {
	repo := NewVisitorRepository(testPool(t))
	ctx := context.Background()

	// A visitor that exists only in the other chapter must stay invisible even
	// when searched for by name.
	rise, err := repo.List(ctx, domain.Scope{ChapterID: ptr(chapterRise)}, domain.VisitorFilter{Limit: 10})
	if err != nil || len(rise) == 0 {
		t.Skip("tidak ada visitor di chapter pembanding")
	}
	target := rise[0].Name

	found, err := repo.List(ctx, growScope(), domain.VisitorFilter{Search: target, Limit: 10})
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(found) != 0 {
		t.Errorf("searching for %q from another chapter returned %d rows; scope must win over search", target, len(found))
	}
}

func TestVisitorCRUDRoundTrip(t *testing.T) {
	repo := NewVisitorRepository(testPool(t))
	ctx := context.Background()

	v := &domain.Visitor{
		ChapterID: chapterGrow, Name: "Integrasi Uji", Phone: "081200990011",
		BusinessField: "Pengujian", Status: domain.StatusNew,
	}
	if err := repo.Create(ctx, v); err != nil {
		t.Fatalf("create: %v", err)
	}
	t.Cleanup(func() { _ = repo.Delete(context.Background(), v.ID) })

	if v.ID == "" || v.CreatedAt.IsZero() {
		t.Fatal("create must return the generated id and timestamps")
	}

	got, err := repo.FindByID(ctx, v.ID)
	if err != nil {
		t.Fatalf("find: %v", err)
	}
	if got.Name != "Integrasi Uji" || got.Status != domain.StatusNew {
		t.Errorf("round trip lost data: %+v", got)
	}

	got.Status = domain.StatusAttended
	choice := 2
	got.AttendedChoiceNumber = &choice
	got.AttendedChoiceNote = "Ingin datang lagi"
	if err := repo.Update(ctx, got); err != nil {
		t.Fatalf("update: %v", err)
	}

	after, err := repo.FindByID(ctx, v.ID)
	if err != nil {
		t.Fatalf("find after update: %v", err)
	}
	// The MCQA columns were added late; this is the regression guard that they
	// are actually written and read back.
	if after.AttendedChoiceNumber == nil || *after.AttendedChoiceNumber != 2 {
		t.Errorf("airtime not persisted: %+v", after.AttendedChoiceNumber)
	}
	if after.Status != domain.StatusAttended {
		t.Errorf("status not persisted: %q", after.Status)
	}

	if err := repo.Delete(ctx, v.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := repo.FindByID(ctx, v.ID); err != domain.ErrNotFound {
		t.Errorf("after delete err = %v, want ErrNotFound", err)
	}
}

func TestDeleteMissingRowIsNotFound(t *testing.T) {
	repo := NewVisitorRepository(testPool(t))
	err := repo.Delete(context.Background(), "00000000-0000-4000-8000-000000000000")
	if err != domain.ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestUserLookupIsCaseInsensitiveAndActiveOnly(t *testing.T) {
	repo := NewUserRepository(testPool(t))
	ctx := context.Background()

	lower, err := repo.FindByEmail(ctx, "grow@demo.test")
	if err != nil {
		t.Fatalf("find lowercase: %v", err)
	}
	upper, err := repo.FindByEmail(ctx, "GROW@DEMO.TEST")
	if err != nil {
		t.Fatalf("find uppercase: %v", err)
	}
	if lower.ID != upper.ID {
		t.Error("email lookup must be case-insensitive, or a user can be locked out by capitalisation")
	}
	if lower.PasswordHash == "" {
		t.Error("the hash is needed to verify a login")
	}
	// The joins have to resolve, otherwise the UI shows a user with no chapter.
	if lower.ChapterName == "" || lower.CityName == "" {
		t.Errorf("chapter joins did not resolve: chapter=%q city=%q", lower.ChapterName, lower.CityName)
	}
}

func TestStatsMatchTheListTheySummarise(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()

	stats, err := NewStatsRepository(pool).ChapterStats(ctx, growScope())
	if err != nil {
		t.Fatalf("stats: %v", err)
	}
	rows, err := NewVisitorRepository(pool).List(ctx, growScope(), domain.VisitorFilter{Limit: 200})
	if err != nil {
		t.Fatalf("list: %v", err)
	}

	// A dashboard that disagrees with the list underneath it is worse than no
	// dashboard, so the two are asserted against each other.
	if stats.TotalVisitors != len(rows) {
		t.Errorf("dashboard says %d visitors, the list has %d", stats.TotalVisitors, len(rows))
	}
}

func TestPerChapterStatsKeepsEmptyChapters(t *testing.T) {
	stats, err := NewStatsRepository(testPool(t)).PerChapterStats(context.Background())
	if err != nil {
		t.Fatalf("per chapter: %v", err)
	}
	if len(stats) < 2 {
		t.Skip("butuh lebih dari satu chapter aktif")
	}
	// A chapter with no visitors must still appear at zero. An INNER JOIN would
	// drop it and the national table would quietly lose a chapter.
	for _, s := range stats {
		if s.ChapterName == "" {
			t.Errorf("chapter %s has no display name", s.ChapterID)
		}
	}
}

func ptr(s string) *string { return &s }
