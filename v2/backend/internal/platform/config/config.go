// Package config reads every knob the process needs from the environment once,
// at startup, so nothing deeper in the app reaches for os.Getenv on the fly.
package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port           string
	DatabaseURL    string
	SessionSecret  string
	SessionMaxAge  time.Duration
	AllowedOrigins []string
	Environment    string
	// PublicBaseURL is what {link_hadir} points at in a WhatsApp message. It
	// must be the address a visitor's phone can reach, which is not the same as
	// the address the API is bound to.
	PublicBaseURL string

	// Narration for the quick tour. Optional: with no key the tour falls back
	// to the browser's own speech synthesis, so the feature degrades rather
	// than disappearing.
	ElevenLabsKey     string
	ElevenLabsVoiceID string
	ElevenLabsModelID string

	// The AI assistant. Also optional, and for the same reason: with no key it
	// answers from the figures instead of refusing, so a deployment without a
	// provider still has a working assistant rather than a broken button.
	//
	// A base URL rather than a hardcoded vendor — DeepSeek, OpenAI, Groq,
	// OpenRouter and most self-hosted servers speak the same chat-completions
	// shape, and which one an operator can use is not a code decision.
	AIBaseURL     string
	AIAPIKey      string
	AIModel       string
	AssistantName string

	// DemoMode publishes the seeded accounts on the login screen. Off unless a
	// deployment asks for it: handing out working credentials is right for a
	// demo and wrong everywhere else, so it is never inferred from anything.
	DemoMode     bool
	DemoPassword string

	// SeedDemoData applies the demonstration migrations. Off in production by
	// default, because those migrations create accounts whose shared password
	// is published in the README — running them on a reachable host puts a
	// known credential on the internet.
	SeedDemoData bool

	// The first administrator on a database that has none. Read once at
	// startup; production skips the seeds, so without this there is no way in.
	BootstrapAdminEmail    string
	BootstrapAdminPassword string
	BootstrapAdminName     string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:          env("PORT", "8080"),
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		SessionSecret: os.Getenv("SESSION_SECRET"),
		Environment:   env("APP_ENV", "development"),
		PublicBaseURL: env("PUBLIC_BASE_URL", "http://localhost:8095"),

		ElevenLabsKey:     os.Getenv("ELEVENLABS_API_KEY"),
		ElevenLabsVoiceID: os.Getenv("ELEVENLABS_VOICE_ID"),
		ElevenLabsModelID: env("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"),

		AIBaseURL:     env("AI_BASE_URL", "https://api.deepseek.com"),
		AIAPIKey:      os.Getenv("AI_API_KEY"),
		AIModel:       env("AI_MODEL", "deepseek-chat"),
		AssistantName: env("ASSISTANT_NAME", "Grow Assistant"),

		DemoMode:     env("DEMO_MODE", "false") == "true",
		DemoPassword: env("DEMO_PASSWORD", "demo123"),

		AllowedOrigins: splitOrigins(env("CORS_ORIGIN", "http://localhost:8095,http://localhost:5173")),
	}

	// Derived from the environment rather than defaulted blindly, and still
	// overridable: a staging box may legitimately want the sample data, and a
	// developer may legitimately want an empty database.
	cfg.SeedDemoData = env("SEED_DEMO_DATA", boolText(cfg.Environment != "production")) == "true"

	cfg.BootstrapAdminEmail = strings.ToLower(strings.TrimSpace(os.Getenv("BOOTSTRAP_ADMIN_EMAIL")))
	cfg.BootstrapAdminPassword = os.Getenv("BOOTSTRAP_ADMIN_PASSWORD")
	cfg.BootstrapAdminName = env("BOOTSTRAP_ADMIN_NAME", "Administrator")

	days, err := strconv.Atoi(env("SESSION_MAX_AGE_DAYS", "7"))
	if err != nil {
		return nil, fmt.Errorf("SESSION_MAX_AGE_DAYS harus angka: %w", err)
	}
	cfg.SessionMaxAge = time.Duration(days) * 24 * time.Hour

	if cfg.DatabaseURL == "" {
		return nil, errors.New("DATABASE_URL wajib diset")
	}
	if err := validateSecret(cfg.SessionSecret, cfg.Environment); err != nil {
		return nil, err
	}

	return cfg, nil
}

// Secrets shipped in examples and compose files get deployed verbatim more
// often than anyone admits, and a predictable signing key means anyone can mint
// a valid admin cookie. Refusing to start is the only reliable guard.
var wellKnownSecrets = map[string]struct{}{
	"dev-only-secret-change-me":       {},
	"changeme":                        {},
	"secret":                          {},
	"development":                     {},
	"bni-visitor-demo-session-secret": {},
}

const minSecretLength = 32

func validateSecret(secret, environment string) error {
	if secret == "" {
		return errors.New("SESSION_SECRET wajib diset")
	}
	if _, known := wellKnownSecrets[strings.ToLower(strings.TrimSpace(secret))]; known {
		return errors.New("SESSION_SECRET masih memakai nilai contoh — ganti dengan nilai acak: openssl rand -base64 32")
	}
	// Outside production a short key is tolerated with a warning so a local run
	// is not blocked, but the placeholder check above still applies.
	if len(secret) < minSecretLength {
		if environment == "production" {
			return fmt.Errorf("SESSION_SECRET terlalu pendek (%d karakter, minimal %d)", len(secret), minSecretLength)
		}
		slog.Warn("SESSION_SECRET pendek — cukup untuk lokal, tidak untuk produksi",
			"panjang", len(secret), "minimal", minSecretLength)
	}
	return nil
}

func boolText(v bool) string {
	if v {
		return "true"
	}
	return "false"
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// splitOrigins parses the comma-separated allowlist. Origins are compared
// verbatim against the browser's Origin header, so they are lowercased and
// stripped of a trailing slash — a mismatch there silently blocks the real app
// rather than any attacker.
func splitOrigins(raw string) []string {
	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		o := strings.TrimSuffix(strings.ToLower(strings.TrimSpace(p)), "/")
		if o != "" {
			origins = append(origins, o)
		}
	}
	return origins
}
