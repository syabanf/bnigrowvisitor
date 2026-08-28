// Command api wires the layers together and runs the HTTP server. This is the
// only place that knows about every package at once; the dependency graph
// everywhere else points inward toward the domain.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	nethttp "bni-visitor/internal/delivery/http"
	"bni-visitor/internal/delivery/http/handler"
	"bni-visitor/internal/platform/config"
	"bni-visitor/internal/platform/database"
	"bni-visitor/internal/platform/session"
	"bni-visitor/internal/repository/postgres"
	"bni-visitor/internal/usecase"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	if err := run(logger); err != nil {
		logger.Error("server berhenti", "err", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	logger.Info("terhubung ke database")

	// Infrastructure implementations, injected upward as domain interfaces.
	users := postgres.NewUserRepository(pool)
	visitors := postgres.NewVisitorRepository(pool)
	chapters := postgres.NewChapterRepository(pool)
	meetings := postgres.NewMeetingRepository(pool)
	audit := postgres.NewLoginAuditRepository(pool)

	sessions := session.New(cfg.SessionSecret, cfg.SessionMaxAge)
	appLogger := &slogAdapter{logger}

	authUC := usecase.NewAuthUsecase(users, audit, appLogger)
	visitorUC := usecase.NewVisitorUsecase(visitors, chapters)

	secureCookies := cfg.Environment == "production"
	router := nethttp.NewRouter(nethttp.Handlers{
		Auth:    handler.NewAuthHandler(authUC, sessions, secureCookies),
		Visitor: handler.NewVisitorHandler(visitorUC),
		Chapter: handler.NewChapterHandler(chapters, meetings),
	}, sessions, cfg.AllowedOrigins)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}

	serverErr := make(chan error, 1)
	go func() {
		logger.Info("server berjalan", "port", cfg.Port, "env", cfg.Environment)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	select {
	case err := <-serverErr:
		return err
	case <-ctx.Done():
		// Drain in-flight requests instead of cutting them off mid-write.
		logger.Info("sinyal berhenti diterima, menutup dengan rapi")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}

// slogAdapter satisfies usecase.Logger without making the use cases import slog.
type slogAdapter struct{ l *slog.Logger }

func (a *slogAdapter) Error(msg string, args ...any) { a.l.Error(msg, args...) }
func (a *slogAdapter) Info(msg string, args ...any)  { a.l.Info(msg, args...) }
