package http

import (
	"bni-visitor/internal/platform/metrics"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"

	"bni-visitor/internal/delivery/http/handler"
	"bni-visitor/internal/delivery/http/middleware"
	"bni-visitor/internal/domain"
	"bni-visitor/internal/platform/session"
)

type Handlers struct {
	Auth       *handler.AuthHandler
	Visitor    *handler.VisitorHandler
	Chapter    *handler.ChapterHandler
	Member     *handler.MemberHandler
	Guest      *handler.GuestHandler
	Dashboard  *handler.DashboardHandler
	Account    *handler.AccountHandler
	Meeting    *handler.MeetingHandler
	MCQA       *handler.MCQAHandler
	Messaging  *handler.MessagingHandler
	Transfer   *handler.TransferHandler
	Tenant     *handler.TenantHandler
	Activity   *handler.ActivityHandler
	Public     *handler.PublicHandler
	Governance *handler.GovernanceHandler
	Narration  *handler.NarrationHandler
	Assistant  *handler.AssistantHandler
	Demo       *handler.DemoHandler
	External   *handler.ExternalHandler
}

func NewRouter(
	h Handlers,
	sessions *session.Manager,
	validator domain.SessionValidator,
	apiKeys domain.APIKeyRepository,
	allowedOrigins []string,
	environment string,
	obs *metrics.Registry,
	pool *pgxpool.Pool,
) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(30 * time.Second))
	r.Use(middleware.SecurityHeaders)
	// After the router has matched, so the route pattern is available to label
	// by; before the handlers, so a request that fails inside one is still
	// counted.
	r.Use(obs.Middleware)

	// Credentials are required because auth rides on a cookie, and a wildcard
	// origin is invalid in that mode — the allowlist has to be explicit.
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Liveness: the process is running and can serve. Deliberately does not
	// touch the database — a restart cannot fix an unreachable database, and a
	// liveness probe that fails on it turns a database blip into a restart loop
	// that makes the outage worse.
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		handler.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Readiness: this instance can actually do work. It pings the database,
	// because an instance that cannot reach it should be taken out of rotation
	// rather than accepting requests it will fail. /health answered "ok"
	// regardless, which is exactly the state an orchestrator most needs to
	// distinguish.
	r.Get("/ready", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			// The reason is logged, not returned: a probe endpoint is
			// unauthenticated, and connection errors carry host names.
			slog.Error("readiness gagal", "err", err)
			handler.WriteJSON(w, http.StatusServiceUnavailable,
				map[string]string{"status": "database tidak siap"})
			return
		}
		handler.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})

	// Metrics. Not proxied by nginx, so it is reachable only from inside the
	// network: route names and traffic shape are useful to anyone sizing up a
	// service, and there is no reason for them to leave it.
	r.Handle("/metrics", obs.Handler())

	// Machine-facing API, mounted outside /api so no browser-oriented middleware
	// applies to it. It authenticates with a key rather than a cookie, so the
	// Origin check would be meaningless — a server-to-server caller sends no
	// Origin, and CSRF needs an ambient credential this route does not have.
	r.Route("/external/v1", func(ext chi.Router) {
		ext.Use(middleware.LimitBody(middleware.DefaultMaxBody))
		ext.Use(httprate.LimitByIP(120, time.Minute))
		ext.Use(middleware.RequireAPIKey(apiKeys, "finance"))

		ext.Get("/members", h.External.ListMembers)
		ext.Get("/members/{id}", h.External.GetMember)
		ext.Post("/members/{id}/renewal", h.External.Renew)
	})

	r.Route("/api", func(api chi.Router) {
		api.Use(middleware.RequireSameOrigin(allowedOrigins, environment))
		api.Use(middleware.LimitBody(middleware.DefaultMaxBody))

		// A ceiling across the whole API, well above what a person clicking
		// through the UI generates but low enough to blunt a scripted flood.
		// The tighter per-endpoint limits below still apply on top.
		api.Use(httprate.LimitByIP(300, time.Minute))

		// Login is the one unauthenticated write, so it is the one endpoint an
		// attacker can hammer. Throttling by IP turns an offline-speed password
		// guess into a months-long exercise; bcrypt alone only slows each
		// attempt, it does not bound how many they get.
		api.Group(func(auth chi.Router) {
			auth.Use(httprate.LimitByIP(10, time.Minute))
			auth.Post("/auth/login", h.Auth.Login)
		})
		api.Post("/auth/logout", h.Auth.Logout)

		// Public by design: the login screen needs chapter branding before a
		// session exists, and a visitor confirming attendance from a WhatsApp
		// link has no account at all.
		api.Get("/tenant-context", h.Tenant.Context)
		// Public because the login screen needs it before a session exists.
		// Returns 404 unless demo mode is on, so nothing here hints that a
		// list of working accounts is one flag away.
		api.Get("/demo-accounts", h.Demo.Accounts)
		api.Post("/public/confirm/{token}", h.Public.Confirm)

		// Everything below this line requires a valid session.
		api.Group(func(private chi.Router) {
			private.Use(middleware.RequireSession(sessions, validator))

			private.Get("/auth/me", h.Auth.Me)
			private.Get("/chapters", h.Chapter.List)

			private.Route("/visitors", func(v chi.Router) {
				v.Get("/", h.Visitor.List)
				v.Post("/", h.Visitor.Create)
				v.Get("/{id}", h.Visitor.Get)
				v.Patch("/{id}", h.Visitor.Update)
				v.Delete("/{id}", h.Visitor.Delete)
			})

			private.Route("/members", func(m chi.Router) {
				m.Get("/", h.Member.List)
				m.Post("/", h.Member.Create)
				m.Get("/{id}", h.Member.Get)
				m.Patch("/{id}", h.Member.Update)
				m.Delete("/{id}", h.Member.Delete)
			})

			private.Route("/guests", func(g chi.Router) {
				g.Get("/", h.Guest.List)
				g.Post("/", h.Guest.Create)
				g.Get("/{id}", h.Guest.Get)
				g.Patch("/{id}", h.Guest.Update)
				g.Delete("/{id}", h.Guest.Delete)
			})

			private.Get("/dashboard/chapter", h.Dashboard.Chapter)
			private.Get("/dashboard/national", h.Dashboard.National)

			private.Route("/meetings", func(m chi.Router) {
				m.Get("/", h.Meeting.List)
				m.Post("/", h.Meeting.Create)
				m.Patch("/{id}", h.Meeting.Update)
				m.Delete("/{id}", h.Meeting.Delete)
			})

			private.Route("/mcqa", func(m chi.Router) {
				m.Get("/", h.MCQA.List)
				m.Get("/choices", h.MCQA.Choices)
				m.Patch("/{id}", h.MCQA.Record)
			})

			private.Route("/wa", func(t chi.Router) {
				t.Get("/templates", h.Messaging.ListTemplates)
				t.Post("/templates", h.Messaging.SaveTemplate)
				t.Patch("/templates/{id}", h.Messaging.SaveTemplate)
				t.Delete("/templates/{id}", h.Messaging.DeleteTemplate)
				t.Get("/blast", h.Messaging.Blast)
			})

			private.Get("/export/visitors", h.Transfer.ExportVisitors)
			private.Post("/import/visitors", h.Transfer.ImportVisitors)
			private.Get("/activity", h.Activity.List)

			// National-only. The use case refuses a chapter-bound caller, so
			// the gate is not merely a hidden nav link.
			private.Route("/master", func(m chi.Router) {
				m.Get("/", h.Governance.Master)
				m.Post("/cities", h.Governance.CreateCity)
				m.Post("/areas", h.Governance.CreateArea)
				m.Post("/chapters", h.Governance.CreateChapter)
				m.Patch("/chapters/{id}/active", h.Governance.SetChapterActive)
			})

			private.Route("/policies", func(p chi.Router) {
				p.Get("/", h.Governance.Policies)
				p.Post("/", h.Governance.SavePolicy)
			})

			private.Route("/api-keys", func(k chi.Router) {
				k.Get("/", h.Governance.APIKeys)
				k.Post("/", h.Governance.CreateAPIKey)
				k.Patch("/{id}/active", h.Governance.SetAPIKeyActive)
				k.Delete("/{id}", h.Governance.DeleteAPIKey)
			})

			private.Get("/governance/logins", h.Governance.Logins)

			private.Get("/assistant/status", h.Assistant.Status)
			// Throttled like narration and for the same reason: every question
			// spends provider credits, so a stuck client must not drain the
			// account. Tighter than narration because one answer costs more
			// than one line of speech.
			private.Group(func(a chi.Router) {
				a.Use(httprate.LimitByIP(20, time.Minute))
				a.Post("/assistant", h.Assistant.Ask)
			})

			private.Get("/narration/status", h.Narration.Status)
			// Throttled separately from login: every call spends provider
			// credits, so a stuck client must not drain the quota.
			private.Group(func(n chi.Router) {
				n.Use(httprate.LimitByIP(60, time.Minute))
				n.Post("/narration", h.Narration.Speak)
			})

			private.Get("/pics", h.Account.ListPICs)
			private.Post("/account/change-password", h.Account.ChangeOwnPassword)

			private.Route("/accounts", func(a chi.Router) {
				a.Get("/", h.Account.List)
				a.Post("/", h.Account.Create)
				a.Post("/{id}/password", h.Account.SetPassword)
				a.Patch("/{id}/active", h.Account.SetActive)
			})
		})
	})

	return r
}
