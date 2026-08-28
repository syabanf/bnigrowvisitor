package domain

import "testing"

func TestRenderTemplate(t *testing.T) {
	values := map[string]string{
		"nama":       "Budi",
		"meeting":    "Weekly Meeting",
		"link_hadir": "https://example.test/wm/abc",
	}

	tests := []struct {
		name string
		body string
		want string
	}{
		{"single placeholder", "Halo {nama}", "Halo Budi"},
		{"several placeholders", "{nama} di {meeting}", "Budi di Weekly Meeting"},
		{"repeated placeholder", "{nama} {nama}", "Budi Budi"},
		{"no placeholder", "Halo semua", "Halo semua"},
		{"link placeholder", "Konfirmasi: {link_hadir}", "Konfirmasi: https://example.test/wm/abc"},

		// An unknown placeholder stays visible on purpose: a stray {typo} in the
		// preview tells the author what is wrong, while blanking it hides the
		// mistake until the message has already gone out.
		{"unknown placeholder is left intact", "Halo {salah_ketik}", "Halo {salah_ketik}"},
		{"partial braces are untouched", "Halo {nama", "Halo {nama"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := RenderTemplate(tc.body, values); got != tc.want {
				t.Errorf("RenderTemplate(%q) = %q, want %q", tc.body, got, tc.want)
			}
		})
	}
}

func TestNormalizeHost(t *testing.T) {
	tests := []struct{ input, want string }{
		{"GROW.BNI-VH.COM", "grow.bni-vh.com"},
		{"www.grow.bni-vh.com", "grow.bni-vh.com"},
		{"  grow.bni-vh.com  ", "grow.bni-vh.com"},
		{"grow.bni-vh.com.", "grow.bni-vh.com"},
		{"localhost:8095", "localhost:8095"},
		{"", ""},
	}
	for _, tc := range tests {
		if got := NormalizeHost(tc.input); got != tc.want {
			t.Errorf("NormalizeHost(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestCanRecordAirtime(t *testing.T) {
	// Recording an airtime result against someone who never turned up would
	// silently skew the MCQA report, so the funnel gate is asserted explicitly.
	allowed := []VisitorStatus{StatusAttended, StatusInterview, StatusMember, StatusNotContinue}
	denied := []VisitorStatus{StatusNew, StatusFollowUp, StatusConfirmed, StatusNoShow}

	for _, s := range allowed {
		if !s.CanRecordAirtime() {
			t.Errorf("%q should allow an airtime result", s)
		}
	}
	for _, s := range denied {
		if s.CanRecordAirtime() {
			t.Errorf("%q should NOT allow an airtime result", s)
		}
	}
}

func TestCanConfirmAttendance(t *testing.T) {
	// Re-opening an old WhatsApp link must not walk a settled visitor back to
	// "confirmed", so only the two pre-attendance states qualify.
	for _, s := range []VisitorStatus{StatusNew, StatusFollowUp} {
		if !s.CanConfirmAttendance() {
			t.Errorf("%q should be confirmable", s)
		}
	}
	for _, s := range []VisitorStatus{StatusConfirmed, StatusAttended, StatusInterview,
		StatusMember, StatusNotContinue, StatusNoShow} {
		if s.CanConfirmAttendance() {
			t.Errorf("%q should NOT be re-confirmable", s)
		}
	}
}
