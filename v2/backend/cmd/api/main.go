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
	"bni-visitor/internal/platform/llm"
	"bni-visitor/internal/platform/maintenance"
	"bni-visitor/internal/platform/metrics"
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

	// Applied on every boot, not just the first: the previous setup relied on
	// Postgres's init hook, which never runs again once the volume has data.
	if err := database.Migrate(ctx, pool, logger); err != nil {
		return err
	}

	// Infrastructure implementations, injected upward as domain interfaces.
	users := postgres.NewUserRepository(pool)
	visitors := postgres.NewVisitorRepository(pool)
	chapters := postgres.NewChapterRepository(pool)
	meetings := postgres.NewMeetingRepository(pool)
	members := postgres.NewMemberRepository(pool)
	guests := postgres.NewGuestRepository(pool)
	stats := postgres.NewStatsRepository(pool)
	domains := postgres.NewDomainRepository(pool)
	templates := postgres.NewWATemplateRepository(pool)
	activity := postgres.NewActivityLogRepository(pool)
	master := postgres.NewMasterRepository(pool)
	policies := postgres.NewPolicyRepository(pool)
	apiKeys := postgres.NewAPIKeyRepository(pool)
	governance := postgres.NewGovernanceRepository(pool)
	audit := postgres.NewLoginAuditRepository(pool)

	sessions := session.New(cfg.SessionSecret, cfg.SessionMaxAge)
	appLogger := &slogAdapter{logger}

	authUC := usecase.NewAuthUsecase(users, audit, appLogger)
	visitorUC := usecase.NewVisitorUsecase(visitors, chapters, activity, appLogger)
	memberUC := usecase.NewMemberUsecase(members, chapters, activity, appLogger)
	guestUC := usecase.NewGuestUsecase(guests, chapters, activity, appLogger)
	dashboardUC := usecase.NewDashboardUsecase(stats)
	accountUC := usecase.NewAccountUsecase(users, chapters)
	tenantUC := usecase.NewTenantUsecase(domains, chapters)
	messagingUC := usecase.NewMessagingUsecase(templates, visitors, chapters, cfg.PublicBaseURL)
	transferUC := usecase.NewTransferUsecase(visitors, members, chapters)
	governanceUC := usecase.NewGovernanceUsecase(master, policies, apiKeys, governance)
	narrationUC := usecase.NewNarrationUsecase(cfg.ElevenLabsKey, cfg.ElevenLabsVoiceID, cfg.ElevenLabsModelID)
	assistantUC := usecase.NewAssistantUsecase(
		llm.New(cfg.AIBaseURL, cfg.AIAPIKey, cfg.AIModel),
		stats, visitors, members, cfg.AssistantName,
	)

	secureCookies := cfg.Environment == "production"
	demoUC := usecase.NewDemoUsecase(users, chapters, cfg.DemoMode, cfg.DemoPassword)

	obs := metrics.New(pool)

	router := nethttp.NewRouter(nethttp.Handlers{
		Auth:       handler.NewAuthHandler(authUC, sessions, secureCookies),
		Visitor:    handler.NewVisitorHandler(visitorUC),
		Chapter:    handler.NewChapterHandler(chapters, meetings),
		Member:     handler.NewMemberHandler(memberUC),
		Guest:      handler.NewGuestHandler(guestUC),
		Dashboard:  handler.NewDashboardHandler(dashboardUC),
		Account:    handler.NewAccountHandler(accountUC),
		Meeting:    handler.NewMeetingHandler(meetings, chapters),
		MCQA:       handler.NewMCQAHandler(visitorUC),
		Messaging:  handler.NewMessagingHandler(messagingUC),
		Transfer:   handler.NewTransferHandler(transferUC),
		Tenant:     handler.NewTenantHandler(tenantUC),
		Activity:   handler.NewActivityHandler(activity),
		Public:     handler.NewPublicHandler(visitorUC),
		Governance: handler.NewGovernanceHandler(governanceUC),
		Narration:  handler.NewNarrationHandler(narrationUC),
		Assistant:  handler.NewAssistantHandler(assistantUC),
		Demo:       handler.NewDemoHandler(demoUC),
		External:   handler.NewExternalHandler(members),
	}, sessions, users, apiKeys, cfg.AllowedOrigins, obs, pool)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}

	// Housekeeping runs alongside the server and stops with it.
	go maintenance.Run(ctx, pool, maintenance.DefaultRetention(), logger)

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
