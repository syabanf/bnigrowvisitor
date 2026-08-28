// Package config reads every knob the process needs from the environment once,
// at startup, so nothing deeper in the app reaches for os.Getenv on the fly.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Port           string
	DatabaseURL    string
	SessionSecret  string
	SessionMaxAge  time.Duration
	AllowedOrigins []string
	Environment    string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:          env("PORT", "8080"),
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		SessionSecret: os.Getenv("SESSION_SECRET"),
		Environment:   env("APP_ENV", "development"),
		AllowedOrigins: []string{
			env("CORS_ORIGIN", "http://localhost:5173"),
		},
	}

	days, err := strconv.Atoi(env("SESSION_MAX_AGE_DAYS", "7"))
	if err != nil {
		return nil, fmt.Errorf("SESSION_MAX_AGE_DAYS harus angka: %w", err)
	}
	cfg.SessionMaxAge = time.Duration(days) * 24 * time.Hour

	if cfg.DatabaseURL == "" {
		return nil, errors.New("DATABASE_URL wajib diset")
	}
	// Refusing to start beats silently signing sessions with a default secret:
	// a predictable key means anyone can mint a valid admin cookie.
	if cfg.SessionSecret == "" {
		return nil, errors.New("SESSION_SECRET wajib diset")
	}

	return cfg, nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
