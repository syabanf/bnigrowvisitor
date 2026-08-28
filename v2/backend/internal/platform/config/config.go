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
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:          env("PORT", "8080"),
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		SessionSecret: os.Getenv("SESSION_SECRET"),
		Environment:   env("APP_ENV", "development"),
		PublicBaseURL: env("PUBLIC_BASE_URL", "http://localhost:8095"),
		AllowedOrigins: splitOrigins(env("CORS_ORIGIN", "http://localhost:8095,http://localhost:5173")),
	}

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
	"dev-only-secret-change-me": {},
	"changeme":                  {},
	"secret":                    {},
	"development":               {},
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
