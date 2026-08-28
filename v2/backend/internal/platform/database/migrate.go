package database

import (
	"context"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"fmt"
	"io/fs"
	"log/slog"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Migrations are embedded in the binary rather than mounted, so the image is
// self-contained and the same artefact migrates any environment.
//
// This replaces Postgres's docker-entrypoint-initdb.d, which only runs against
// an empty data directory — meaning every migration added after the first boot
// would silently never apply to an existing database.
//
//go:embed all:migrations
var migrationFS embed.FS

const migrationTable = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     text PRIMARY KEY,
  checksum    text NOT NULL,
  applied_at  timestamptz NOT NULL DEFAULT now()
)`

type migration struct {
	version  string
	body     string
	checksum string
}

// Migrate applies every migration not yet recorded, in filename order, each in
// its own transaction so a failure leaves the database on the last good version
// rather than half-way through one.
func Migrate(ctx context.Context, pool *pgxpool.Pool, logger *slog.Logger) error {
	if _, err := pool.Exec(ctx, migrationTable); err != nil {
		return fmt.Errorf("gagal menyiapkan tabel migrasi: %w", err)
	}

	available, err := loadMigrations()
	if err != nil {
		return err
	}

	applied, err := appliedMigrations(ctx, pool)
	if err != nil {
		return err
	}

	pending := 0
	for _, m := range available {
		if existing, done := applied[m.version]; done {
			// An edited migration means the database and the source no longer
			// agree; silently ignoring that is how environments drift apart.
			if existing != m.checksum {
				return fmt.Errorf(
					"migrasi %s sudah diterapkan tapi isinya berubah (checksum berbeda) — "+
						"buat migrasi baru, jangan ubah yang lama", m.version)
			}
			continue
		}

		if err := applyMigration(ctx, pool, m); err != nil {
			return fmt.Errorf("migrasi %s gagal: %w", m.version, err)
		}
		logger.Info("migrasi diterapkan", "version", m.version)
		pending++
	}

	if pending == 0 {
		logger.Info("skema database sudah mutakhir", "total", len(available))
	} else {
		logger.Info("migrasi selesai", "diterapkan", pending, "total", len(available))
	}
	return nil
}

func loadMigrations() ([]migration, error) {
	entries, err := fs.ReadDir(migrationFS, "migrations")
	if err != nil {
		return nil, fmt.Errorf("gagal membaca migrasi: %w", err)
	}

	migrations := make([]migration, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}
		body, err := migrationFS.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return nil, err
		}
		sum := sha256.Sum256(body)
		migrations = append(migrations, migration{
			version:  entry.Name(),
			body:     string(body),
			checksum: hex.EncodeToString(sum[:]),
		})
	}

	// Filenames are zero-padded, so lexical order is application order.
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].version < migrations[j].version
	})
	return migrations, nil
}

func appliedMigrations(ctx context.Context, pool *pgxpool.Pool) (map[string]string, error) {
	rows, err := pool.Query(ctx, `SELECT version, checksum FROM schema_migrations`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[string]string)
	for rows.Next() {
		var version, checksum string
		if err := rows.Scan(&version, &checksum); err != nil {
			return nil, err
		}
		applied[version] = checksum
	}
	return applied, rows.Err()
}

func applyMigration(ctx context.Context, pool *pgxpool.Pool, m migration) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, m.body); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)`,
		m.version, m.checksum); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
