package http

import (
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
	Auth      *handler.AuthHandler
	Visitor   *handler.VisitorHandler
	Chapter   *handler.ChapterHandler
	Member    *handler.MemberHandler
	Guest     *handler.GuestHandler
	Dashboard *handler.DashboardHandler
	Account   *handler.AccountHandler
	Meeting   *handler.MeetingHandler
	MCQA      *handler.MCQAHandler
	Messaging *handler.MessagingHandler
	Transfer  *handler.TransferHandler
	Tenant    *handler.TenantHandler
	Activity  *handler.ActivityHandler
	Public     *handler.PublicHandler
	Governance *handler.GovernanceHandler
}

func NewRouter(h Handlers, sessions *session.Manager, validator domain.SessionValidator, allowedOrigins []string) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(30 * time.Second))
	r.Use(middleware.SecurityHeaders)

	// Credentials are required because auth rides on a cookie, and a wildcard
	// origin is invalid in that mode — the allowlist has to be explicit.
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		handler.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api", func(api chi.Router) {
		api.Use(middleware.RequireSameOrigin(allowedOrigins))

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
