package http

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"bni-visitor/internal/delivery/http/handler"
	"bni-visitor/internal/delivery/http/middleware"
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
}

func NewRouter(h Handlers, sessions *session.Manager, allowedOrigins []string) http.Handler {
	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(30 * time.Second))

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
		api.Post("/auth/login", h.Auth.Login)
		api.Post("/auth/logout", h.Auth.Logout)

		// Everything below this line requires a valid session.
		api.Group(func(private chi.Router) {
			private.Use(middleware.RequireSession(sessions))

			private.Get("/auth/me", h.Auth.Me)
			private.Get("/chapters", h.Chapter.List)
			private.Get("/meetings", h.Chapter.ListMeetings)

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
