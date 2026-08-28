// Package maintenance runs the periodic housekeeping the app needs to keep
// working over months rather than days.
package maintenance

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Retention bounds how long the audit tables keep rows. Both grow with every
// login and every write; without a ceiling they eventually become the largest
// thing in the database, and an audit log nobody can query is not an audit log.
type Retention struct {
	ActivityDays int
	LoginDays    int
	Interval     time.Duration
}

func DefaultRetention() Retention {
	return Retention{
		// Long enough to investigate an incident found weeks later, short
		// enough that the tables stay queryable.
		ActivityDays: 180,
		LoginDays:    90,
		Interval:     24 * time.Hour,
	}
}

// Run sweeps on an interval until the context is cancelled. Started as a
// goroutine from main; it stops with the server.
func Run(ctx context.Context, pool *pgxpool.Pool, cfg Retention, logger *slog.Logger) {
	// Sweep once at startup, so an instance that restarts daily still prunes
	// rather than never reaching its first tick.
	sweep(ctx, pool, cfg, logger)

	ticker := time.NewTicker(cfg.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			sweep(ctx, pool, cfg, logger)
		}
	}
}

func sweep(ctx context.Context, pool *pgxpool.Pool, cfg Retention, logger *slog.Logger) {
	// Bounded independently of the caller: a sweep must not hold a connection
	// open indefinitely if the database is struggling.
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	activity, err := deleteOlderThan(ctx, pool, "activity_logs", cfg.ActivityDays)
	if err != nil {
		logger.Error("gagal membersihkan activity_logs", "err", err)
	}
	logins, err := deleteOlderThan(ctx, pool, "login_audit", cfg.LoginDays)
	if err != nil {
		logger.Error("gagal membersihkan login_audit", "err", err)
	}

	if activity > 0 || logins > 0 {
		logger.Info("retensi audit dijalankan",
			"activity_logs_dihapus", activity, "login_audit_dihapus", logins)
	}
}

func deleteOlderThan(ctx context.Context, pool *pgxpool.Pool, table string, days int) (int64, error) {
	// The table name is a package constant, never caller input, so interpolating
	// it cannot introduce injection — and Postgres will not accept an identifier
	// as a bind parameter.
	query := "DELETE FROM " + table + " WHERE created_at < now() - $1::interval"
	tag, err := pool.Exec(ctx, query, fmt.Sprintf("%d days", days))
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
