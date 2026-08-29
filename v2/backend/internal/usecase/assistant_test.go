package usecase

import (
	"context"
	"strings"
	"testing"

	"bni-visitor/internal/domain"
	"bni-visitor/internal/platform/llm"
)

// stubStats answers with whatever the scope asks for, and records the scope it
// was asked with. The point of most of these tests is which scope reaches the
// repository, not what comes back.
type stubStats struct {
	chapter    domain.ChapterStats
	perChapter []domain.ChapterStats
	breakdown  []domain.StatusCount
	sawScope   domain.Scope
}

func (s *stubStats) ChapterStats(_ context.Context, scope domain.Scope) (*domain.ChapterStats, error) {
	s.sawScope = scope
	out := s.chapter
	return &out, nil
}

func (s *stubStats) PerChapterStats(context.Context) ([]domain.ChapterStats, error) {
	return s.perChapter, nil
}

func (s *stubStats) VisitorStatusBreakdown(context.Context, domain.Scope) ([]domain.StatusCount, error) {
	return s.breakdown, nil
}

type stubVisitors struct {
	list     []domain.Visitor
	sawScope domain.Scope
}

func (s *stubVisitors) List(_ context.Context, scope domain.Scope, _ domain.VisitorFilter) ([]domain.Visitor, error) {
	s.sawScope = scope
	return s.list, nil
}
func (s *stubVisitors) Count(_ context.Context, scope domain.Scope, _ domain.VisitorFilter) (int, error) {
	s.sawScope = scope
	return len(s.list), nil
}
func (s *stubVisitors) FindByID(context.Context, string) (*domain.Visitor, error) {
	return nil, domain.ErrNotFound
}
func (s *stubVisitors) Create(context.Context, *domain.Visitor) error { return nil }
func (s *stubVisitors) Update(context.Context, *domain.Visitor) error { return nil }
func (s *stubVisitors) Delete(context.Context, string) error          { return nil }

type stubMembers struct{}

func (stubMembers) List(context.Context, domain.Scope, domain.MemberFilter) ([]domain.Member, error) {
	return nil, nil
}
func (stubMembers) Count(context.Context, domain.Scope, domain.MemberFilter) (int, error) {
	return 0, nil
}
func (stubMembers) FindByID(context.Context, string) (*domain.Member, error) {
	return nil, domain.ErrNotFound
}
func (stubMembers) Create(context.Context, *domain.Member) error { return nil }
func (stubMembers) Update(context.Context, *domain.Member) error { return nil }
func (stubMembers) Delete(context.Context, string) error         { return nil }

func newAssistant(stats *stubStats, visitors *stubVisitors) *AssistantUsecase {
	// No API key: every test here exercises the path that runs without a
	// provider, which is the one that must work in any deployment.
	return NewAssistantUsecase(llm.New("", "", ""), stats, visitors, stubMembers{}, "Uji")
}

func chapterScope(id string) domain.Scope { return domain.Scope{ChapterID: &id} }

func TestAssistantAnswersFromDataWithoutAProvider(t *testing.T) {
	stats := &stubStats{chapter: domain.ChapterStats{
		ChapterName: "BNI Grow", TotalVisitors: 40, BecameMember: 8,
		NeedFollowUp: 5, Unassigned: 2, Confirmed: 12, Attended: 9,
		TotalMembers: 30, ActiveMembers: 28, RenewalDueSoon: 3,
	}}
	uc := newAssistant(stats, &stubVisitors{})

	cases := []struct {
		name     string
		question string
		want     []string
	}{
		{"conversion", "berapa konversi kita?", []string{"40", "8", "20.0"}},
		{"attendance", "gimana kehadirannya?", []string{"12", "9", "75.0"}},
		{"follow up", "siapa yang perlu follow up?", []string{"5", "2"}},
		{"members", "berapa member yang perlu perpanjangan?", []string{"30", "28", "3"}},
		{"summary", "ringkas kondisi chapter", []string{"40", "5", "8"}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := uc.Ask(context.Background(), chapterScope("c1"), "a@b.test", "chapter_admin", tc.question, nil)
			if err != nil {
				t.Fatalf("Ask: %v", err)
			}
			if got.Source != "data" {
				t.Errorf("source = %q, want data", got.Source)
			}
			for _, want := range tc.want {
				if !strings.Contains(got.Answer, want) {
					t.Errorf("answer missing %q:\n%s", want, got.Answer)
				}
			}
		})
	}
}

// The figures must be the caller's own. A chapter user asking for a comparison
// gets a refusal, not another chapter's numbers — the failure this guards
// against is data crossing a tenant boundary through the assistant, which every
// other screen is careful about.
func TestAssistantKeepsChapterScope(t *testing.T) {
	stats := &stubStats{
		chapter: domain.ChapterStats{ChapterName: "BNI Grow", TotalVisitors: 40},
		perChapter: []domain.ChapterStats{
			{ChapterName: "BNI Grow", TotalVisitors: 40},
			{ChapterName: "BNI Rise", TotalVisitors: 90},
		},
	}
	visitors := &stubVisitors{}
	uc := newAssistant(stats, visitors)

	got, err := uc.Ask(context.Background(), chapterScope("c1"), "a@b.test", "chapter_admin",
		"chapter mana yang paling aktif?", nil)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(got.Answer, "BNI Rise") || strings.Contains(got.Answer, "90") {
		t.Fatalf("chapter-scoped answer leaked another chapter:\n%s", got.Answer)
	}
	if !strings.Contains(got.Answer, "nasional") {
		t.Errorf("expected the answer to say why it cannot compare:\n%s", got.Answer)
	}
	if visitors.sawScope.IsNational {
		t.Error("repository was queried with national scope for a chapter user")
	}
}

func TestAssistantComparesChaptersForNationalScope(t *testing.T) {
	stats := &stubStats{
		chapter: domain.ChapterStats{TotalVisitors: 130},
		perChapter: []domain.ChapterStats{
			{ChapterName: "BNI Grow", TotalVisitors: 40, BecameMember: 8},
			{ChapterName: "BNI Rise", TotalVisitors: 90, BecameMember: 5},
		},
	}
	uc := newAssistant(stats, &stubVisitors{})

	got, err := uc.Ask(context.Background(), domain.Scope{IsNational: true}, "n@b.test", "national",
		"chapter mana yang paling aktif?", nil)
	if err != nil {
		t.Fatal(err)
	}
	// Ranked by visitors, so Rise leads despite converting fewer.
	if !strings.HasPrefix(strings.TrimPrefix(got.Answer, "Urutan berdasarkan jumlah visitor: "), "BNI Rise") {
		t.Errorf("expected BNI Rise ranked first:\n%s", got.Answer)
	}
}

func TestAssistantRejectsEmptyAndOversizedQuestions(t *testing.T) {
	uc := newAssistant(&stubStats{}, &stubVisitors{})

	if _, err := uc.Ask(context.Background(), chapterScope("c1"), "a@b.test", "pic", "   ", nil); err == nil {
		t.Error("expected an error for a blank question")
	}
	huge := strings.Repeat("a", maxQuestionChars+1)
	if _, err := uc.Ask(context.Background(), chapterScope("c1"), "a@b.test", "pic", huge, nil); err == nil {
		t.Error("expected an error for an over-long question")
	}
}

// An unrecognised question says so rather than inventing an answer, and names
// what would make free-form questions work.
func TestAssistantIsHonestAboutWhatItCannotAnswer(t *testing.T) {
	stats := &stubStats{chapter: domain.ChapterStats{TotalVisitors: 40, NeedFollowUp: 5, BecameMember: 8}}
	uc := newAssistant(stats, &stubVisitors{})

	got, err := uc.Ask(context.Background(), chapterScope("c1"), "a@b.test", "pic",
		"tuliskan puisi tentang kucing", nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(got.Answer, "AI_API_KEY") {
		t.Errorf("answer should say how to enable free-form questions:\n%s", got.Answer)
	}
}
