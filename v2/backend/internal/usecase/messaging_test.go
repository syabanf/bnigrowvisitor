package usecase

import "testing"

func TestNormalizePhone(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{"local leading zero becomes 62", "081234567890", "6281234567890"},
		{"already international is kept", "6281234567890", "6281234567890"},
		{"spaces and dashes are stripped", "0812-3456-7890", "6281234567890"},
		{"a +62 prefix survives the strip", "+62 812 3456 7890", "6281234567890"},
		{"parentheses are stripped", "(0812) 3456 7890", "6281234567890"},

		// The cases that must produce no link at all rather than a broken one.
		{"empty", "", ""},
		{"letters only", "tidak ada", ""},
		{"far too short", "0812", ""},
		{"far too long", "0812345678901234567", ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := normalizePhone(tc.input); got != tc.want {
				t.Errorf("normalizePhone(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}
