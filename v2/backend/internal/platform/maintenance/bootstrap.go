package maintenance

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"bni-visitor/internal/platform/password"
)

// BootstrapAdmin is the first account on a database that has none.
//
// Production skips the seed migrations, which is what keeps accounts with a
// published password off a reachable host — but it also leaves nobody able to
// sign in. Something has to create the first administrator, and an environment
// variable read once at startup is the smallest thing that can: no extra
// endpoint to secure, no default credential baked into an image.
type BootstrapAdmin struct {
	Email    string
	Password string
	Name     string
}

// EnsureAdmin creates the first national administrator if the database has no
// active one.
//
// Guarded on there being none, not on a flag: leaving the variables set is the
// normal state of a deployment, and re-running must not mint a second account
// or reset the password of an existing one. Someone who has changed their
// password must not have it changed back by a restart.
func EnsureAdmin(ctx context.Context, pool *pgxpool.Pool, in BootstrapAdmin, logger *slog.Logger) error {
	var existing int
	err := pool.QueryRow(ctx, `
		SELECT count(*) FROM users
		WHERE is_active = true AND role IN ('admin', 'national_admin')`).Scan(&existing)
	if err != nil {
		return err
	}
	if existing > 0 {
		return nil
	}

	if in.Email == "" || in.Password == "" {
		// Not fatal — the public attendance-confirmation route still works, and
		// refusing to boot would take down a running deployment the moment its
		// last admin was deactivated. Loud, because until this is set the app
		// has no way in at all.
		logger.Warn("database belum punya admin aktif dan tidak ada akun bootstrap",
			"cara", "set BOOTSTRAP_ADMIN_EMAIL dan BOOTSTRAP_ADMIN_PASSWORD lalu jalankan ulang")
		return nil
	}

	// The same policy the account screen enforces. A bootstrap account is the
	// most privileged one there will ever be, so it is the last place to make
	// an exception.
	if err := password.Validate(in.Password); err != nil {
		return fmt.Errorf("BOOTSTRAP_ADMIN_PASSWORD ditolak: %w", err)
	}

	hash, err := password.Hash(in.Password)
	if err != nil {
		return err
	}

	name := in.Name
	if name == "" {
		name = "Administrator"
	}

	var orgID string
	err = pool.QueryRow(ctx, `SELECT id FROM organizations ORDER BY created_at LIMIT 1`).Scan(&orgID)
	if errors.Is(err, pgx.ErrNoRows) {
		return errors.New("tidak ada organisasi — migrasi bootstrap belum jalan")
	}
	if err != nil {
		return err
	}

	// ON CONFLICT on email rather than a plain insert: the address may already
	// belong to a deactivated account, and failing the boot over that would be
	// a worse outcome than doing nothing.
	tag, err := pool.Exec(ctx, `
		INSERT INTO users (name, email, password_hash, role, organization_id, chapter_id)
		VALUES ($1, $2, $3, 'national_admin', $4, NULL)
		ON CONFLICT (email) DO NOTHING`,
		name, in.Email, hash, orgID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		logger.Warn("akun bootstrap tidak dibuat: email sudah dipakai akun lain",
			"email", in.Email,
			"cara", "aktifkan kembali akun itu lewat database, atau pakai email lain")
		return nil
	}

	// The password is never logged, here or anywhere.
	logger.Warn("admin bootstrap dibuat karena database belum punya admin aktif",
		"email", in.Email, "role", "national_admin")
	return nil
}
