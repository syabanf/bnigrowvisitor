// Package metrics exposes what the service is doing, in Prometheus text format.
//
// Structured logs already say what happened; metrics say how often and how
// slowly. Without them the only way to answer "is it slower than last week" is
// to run the stress test again, which measures a machine rather than
// production.
package metrics

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type Registry struct {
	reg      *prometheus.Registry
	requests *prometheus.CounterVec
	duration *prometheus.HistogramVec
	inFlight prometheus.Gauge
}

func New(pool *pgxpool.Pool) *Registry {
	// A private registry rather than the default one: nothing else in this
	// process registers metrics, and a global makes two test runs in the same
	// binary collide on a duplicate registration.
	reg := prometheus.NewRegistry()
	reg.MustRegister(
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
	)

	m := &Registry{
		reg: reg,
		requests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Requests served, by route pattern and status class.",
		}, []string{"method", "route", "status"}),
		duration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name: "http_request_duration_seconds",
			Help: "Request latency by route pattern.",
			// Tuned to what this service actually does: most reads land in the
			// low milliseconds, and the interesting question is how much sits
			// past 100ms. The default buckets start at 5ms and would put almost
			// everything in the first one.
			Buckets: []float64{.001, .0025, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5},
		}, []string{"method", "route"}),
		inFlight: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "http_requests_in_flight",
			Help: "Requests currently being served.",
		}),
	}
	reg.MustRegister(m.requests, m.duration, m.inFlight)

	if pool != nil {
		reg.MustRegister(newPoolCollector(pool))
	}
	return m
}

// Handler serves the metrics. It is deliberately not proxied by nginx: route
// names and traffic shape are useful to an attacker sizing up a service, and
// there is no reason for them to leave the internal network.
func (m *Registry) Handler() http.Handler {
	return promhttp.HandlerFor(m.reg, promhttp.HandlerOpts{})
}

// Middleware records every request.
func (m *Registry) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m.inFlight.Inc()
		defer m.inFlight.Dec()

		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		start := time.Now()
		next.ServeHTTP(rec, r)
		elapsed := time.Since(start).Seconds()

		// The route pattern, never the raw path: /visitors/{id} is one label
		// value, while the path itself would mint a new time series per visitor
		// and eventually take the metrics store down with it.
		route := chi.RouteContext(r.Context()).RoutePattern()
		if route == "" {
			route = "unmatched"
		}

		m.requests.WithLabelValues(r.Method, route, strconv.Itoa(rec.status)).Inc()
		m.duration.WithLabelValues(r.Method, route).Observe(elapsed)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status  int
	written bool
}

func (r *statusRecorder) WriteHeader(code int) {
	if r.written {
		return
	}
	r.status = code
	r.written = true
	r.ResponseWriter.WriteHeader(code)
}

func (r *statusRecorder) Write(b []byte) (int, error) {
	// A handler that writes without calling WriteHeader has implicitly sent
	// 200; recording it here keeps the default from being reported as whatever
	// the zero value happened to be.
	r.written = true
	return r.ResponseWriter.Write(b)
}

// poolCollector reports connection-pool state on scrape rather than sampling it
// on a timer, so the numbers are the ones at the moment they were asked for.
type poolCollector struct {
	pool               *pgxpool.Pool
	acquired, idle     *prometheus.Desc
	total, max         *prometheus.Desc
	waitCount, waitDur *prometheus.Desc
}

func newPoolCollector(pool *pgxpool.Pool) *poolCollector {
	d := func(name, help string) *prometheus.Desc {
		return prometheus.NewDesc("db_pool_"+name, help, nil, nil)
	}
	return &poolCollector{
		pool:      pool,
		acquired:  d("acquired_connections", "Connections currently checked out."),
		idle:      d("idle_connections", "Connections open and unused."),
		total:     d("total_connections", "Connections open."),
		max:       d("max_connections", "Pool ceiling."),
		waitCount: d("acquire_waits_total", "Acquires that had to wait for a free connection."),
		// The one to alert on: waiting to get a connection is queueing that no
		// query-level timing will show.
		waitDur: d("acquire_wait_seconds_total", "Total time spent waiting for a connection."),
	}
}

func (c *poolCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- c.acquired
	ch <- c.idle
	ch <- c.total
	ch <- c.max
	ch <- c.waitCount
	ch <- c.waitDur
}

func (c *poolCollector) Collect(ch chan<- prometheus.Metric) {
	s := c.pool.Stat()
	ch <- prometheus.MustNewConstMetric(c.acquired, prometheus.GaugeValue, float64(s.AcquiredConns()))
	ch <- prometheus.MustNewConstMetric(c.idle, prometheus.GaugeValue, float64(s.IdleConns()))
	ch <- prometheus.MustNewConstMetric(c.total, prometheus.GaugeValue, float64(s.TotalConns()))
	ch <- prometheus.MustNewConstMetric(c.max, prometheus.GaugeValue, float64(s.MaxConns()))
	ch <- prometheus.MustNewConstMetric(c.waitCount, prometheus.CounterValue, float64(s.EmptyAcquireCount()))
	ch <- prometheus.MustNewConstMetric(c.waitDur, prometheus.CounterValue, s.AcquireDuration().Seconds())
}
