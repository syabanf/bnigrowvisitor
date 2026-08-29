package usecase

import (
	"bni-visitor/internal/domain"
	"fmt"
	"sort"
	"strings"
)

// summarise answers from the numbers alone, with no model involved.
//
// This is what runs when no AI provider is configured. It is not a pretend
// model: it matches the question against a few things it can actually answer,
// gives the figures, and says plainly when the question is beyond it. v1
// returned a 500 in this situation, which told the user nothing and made the
// whole assistant useless in any deployment without a key.
func (uc *AssistantUsecase) summarise(question string, facts *assistantContext) string {
	q := strings.ToLower(question)
	s := facts.Stats

	var body string
	switch {
	case mentions(q, "follow up", "followup", "tindak lanjut", "dihubungi", "chase"):
		body = fmt.Sprintf("Ada %d visitor yang perlu follow up dan %d yang belum punya PIC.",
			s.NeedFollowUp, s.Unassigned)
		if len(facts.NeedAction) > 0 {
			names := make([]string, 0, 5)
			for _, v := range facts.NeedAction {
				if len(names) == 5 {
					break
				}
				names = append(names, v.Name)
			}
			body += " Yang teratas: " + strings.Join(names, ", ") + "."
		}

	case mentions(q, "konversi", "conversion", "jadi member", "closing"):
		body = fmt.Sprintf("Dari %d visitor, %d jadi member — konversi %s persen.",
			s.TotalVisitors, s.BecameMember, facts.Conversion)

	case mentions(q, "hadir", "kehadiran", "attendance", "datang"):
		body = fmt.Sprintf("%d visitor konfirmasi hadir dan %d benar-benar datang — tingkat kehadiran %s persen.",
			s.Confirmed, s.Attended, facts.Attendance)

	case mentions(q, "member", "anggota", "renewal", "perpanjangan"):
		body = fmt.Sprintf("Total %d member, %d aktif, dan %d perlu perpanjangan dalam waktu dekat.",
			s.TotalMembers, s.ActiveMembers, s.RenewalDueSoon)

	case mentions(q, "chapter mana", "paling aktif", "perbandingan", "bandingkan", "terbaik"):
		if len(facts.PerChapter) == 0 {
			body = "Perbandingan antar chapter hanya tersedia untuk akun nasional."
			break
		}
		ranked := make([]string, 0, len(facts.PerChapter))
		rows := facts.PerChapter
		sort.SliceStable(rows, func(i, j int) bool {
			return rows[i].TotalVisitors > rows[j].TotalVisitors
		})
		for i, c := range rows {
			if i == 3 {
				break
			}
			ranked = append(ranked, fmt.Sprintf("%s (%d visitor, %d member)",
				c.ChapterName, c.TotalVisitors, c.BecameMember))
		}
		body = "Urutan berdasarkan jumlah visitor: " + strings.Join(ranked, ", ") + "."

	case mentions(q, "status", "pipeline", "sebaran", "breakdown"):
		parts := make([]string, 0, len(facts.ByStatus))
		for _, status := range orderedStatusLabels(facts) {
			parts = append(parts, fmt.Sprintf("%s %d", status, facts.ByStatus[status]))
		}
		body = "Sebaran status: " + strings.Join(parts, ", ") + "."

	case mentions(q, "ringkas", "rangkum", "overview", "kondisi", "gimana", "bagaimana", "halo", "hai"):
		body = fmt.Sprintf(
			"Saat ini ada %d visitor, %d perlu follow up, %d hadir, dan %d jadi member. Member aktif %d, %d perlu perpanjangan.",
			s.TotalVisitors, s.NeedFollowUp, s.Attended, s.BecameMember, s.ActiveMembers, s.RenewalDueSoon)

	default:
		return fmt.Sprintf(
			"Belum ada penyedia AI yang dikonfigurasi, jadi saya hanya bisa menjawab dari angka yang ada. "+
				"Untuk pertanyaan bebas, set AI_API_KEY di server.\n\n"+
				"Yang bisa saya jawab sekarang: follow up, konversi, kehadiran, member dan perpanjangan, sebaran status, "+
				"serta ringkasan keseluruhan. Ringkasnya: %d visitor, %d perlu follow up, %d jadi member.",
			s.TotalVisitors, s.NeedFollowUp, s.BecameMember)
	}

	return body + "\n\nCatatan: dijawab langsung dari data, tanpa model AI — set AI_API_KEY untuk pertanyaan bebas."
}

// orderedStatusLabels keeps the pipeline order. Ranging over the map directly
// would print the stages shuffled differently on every request.
func orderedStatusLabels(facts *assistantContext) []string {
	out := make([]string, 0, len(facts.ByStatus))
	for _, s := range allStatusLabelsInOrder() {
		if _, ok := facts.ByStatus[s]; ok {
			out = append(out, s)
		}
	}
	return out
}

func allStatusLabelsInOrder() []string {
	statuses := domain.AllVisitorStatuses()
	out := make([]string, 0, len(statuses))
	for _, s := range statuses {
		out = append(out, domain.StatusLabel(s))
	}
	return out
}

func mentions(haystack string, needles ...string) bool {
	for _, n := range needles {
		if strings.Contains(haystack, n) {
			return true
		}
	}
	return false
}
