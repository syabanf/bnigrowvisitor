package maintenance

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
)

// demoEmailSuffix marks a seeded account. `.test` is reserved by RFC 6761 and
// can never be a real domain, so nothing legitimate is caught by this.
const demoEmailSuffix = "@demo.test"

// DisableDemoAccounts deactivates seeded accounts in production.
//
// Skipping the seed migrations keeps a fresh production database clean, but a
// database seeded before that split still holds them — and they all share a
// password printed in the README. Found exactly that on a reachable host:
// admin@demo.test with the published password, signing in successfully.
//
// Deactivated rather than deleted, because a user id is referenced by activity
// logs, login audit and created_by columns; removing the rows would orphan the
// trail that explains what those accounts did. Deactivation is what the session
// middleware already checks on every request, so it takes effect immediately
// and can be undone from the Accounts screen.
//
// Announced at WARN, never silent: changing data at startup is surprising, and
// an operator who did not expect it needs to see what was touched and why.
func DisableDemoAccounts(ctx context.Context, pool *pgxpool.Pool, environment string, logger *slog.Logger) error {
	if environment != "production" {
		return nil
	}

	rows, err := pool.Query(ctx, `
		UPDATE users SET is_active = false, updated_at = now()
		WHERE is_active = true AND email LIKE '%' || $1
		RETURNING email`, demoEmailSuffix)
	if err != nil {
		return err
	}
	defer rows.Close()

	disabled := make([]string, 0)
	for rows.Next() {
		var email string
		if err := rows.Scan(&email); err != nil {
			return err
		}
		disabled = append(disabled, email)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	if len(disabled) > 0 {
		logger.Warn("akun demo dinonaktifkan karena APP_ENV=production",
			"jumlah", len(disabled), "akun", disabled,
			"alasan", "password akun seed dipublikasikan di README")
	}
	return nil
}
