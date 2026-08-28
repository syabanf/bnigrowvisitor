package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"bni-visitor/internal/domain"
)

type MasterRepository struct{ db *pgxpool.Pool }

func NewMasterRepository(db *pgxpool.Pool) *MasterRepository { return &MasterRepository{db: db} }

// Load returns the whole hierarchy in one call. The screen renders it as a
// tree, so fetching each level separately would only add round trips for data
// that is always displayed together — and it is small by nature.
func (r *MasterRepository) Load(ctx context.Context) (*domain.MasterData, error) {
	data := &domain.MasterData{
		Organizations: []domain.Organization{},
		Cities:        []domain.City{},
		Areas:         []domain.Area{},
		Chapters:      []domain.Chapter{},
		Domains:       []domain.ChapterDomain{},
	}

	orgs, err := r.db.Query(ctx, `SELECT id, name, code, is_active, created_at FROM organizations ORDER BY name`)
	if err != nil {
		return nil, err
	}
	for orgs.Next() {
		var o domain.Organization
		if err := orgs.Scan(&o.ID, &o.Name, &o.Code, &o.IsActive, &o.CreatedAt); err != nil {
			orgs.Close()
			return nil, err
		}
		data.Organizations = append(data.Organizations, o)
	}
	orgs.Close()

	cities, err := r.db.Query(ctx, `SELECT id, organization_id, name, is_active FROM cities ORDER BY name`)
	if err != nil {
		return nil, err
	}
	for cities.Next() {
		var c domain.City
		if err := cities.Scan(&c.ID, &c.OrganizationID, &c.Name, &c.IsActive); err != nil {
			cities.Close()
			return nil, err
		}
		data.Cities = append(data.Cities, c)
	}
	cities.Close()

	areas, err := r.db.Query(ctx, `SELECT id, city_id, name, is_active FROM areas ORDER BY name`)
	if err != nil {
		return nil, err
	}
	for areas.Next() {
		var a domain.Area
		if err := areas.Scan(&a.ID, &a.CityID, &a.Name, &a.IsActive); err != nil {
			areas.Close()
			return nil, err
		}
		data.Areas = append(data.Areas, a)
	}
	areas.Close()

	chapters, err := r.db.Query(ctx, `
		SELECT id, area_id, name, display_name, is_active, created_at
		FROM chapters ORDER BY display_name`)
	if err != nil {
		return nil, err
	}
	for chapters.Next() {
		var c domain.Chapter
		if err := chapters.Scan(&c.ID, &c.AreaID, &c.Name, &c.DisplayName, &c.IsActive, &c.CreatedAt); err != nil {
			chapters.Close()
			return nil, err
		}
		data.Chapters = append(data.Chapters, c)
	}
	chapters.Close()

	domains, err := r.db.Query(ctx, `
		SELECT id, chapter_id, domain, type, is_primary
		FROM chapter_domains WHERE is_active ORDER BY domain`)
	if err != nil {
		return nil, err
	}
	defer domains.Close()
	for domains.Next() {
		var d domain.ChapterDomain
		if err := domains.Scan(&d.ID, &d.ChapterID, &d.Domain, &d.Type, &d.IsPrimary); err != nil {
			return nil, err
		}
		data.Domains = append(data.Domains, d)
	}
	return data, domains.Err()
}

func (r *MasterRepository) CreateCity(ctx context.Context, c *domain.City) error {
	err := r.db.QueryRow(ctx, `
		INSERT INTO cities (organization_id, name) VALUES ($1, $2) RETURNING id`,
		c.OrganizationID, c.Name).Scan(&c.ID)
	return translate(err)
}

func (r *MasterRepository) CreateArea(ctx context.Context, a *domain.Area) error {
	err := r.db.QueryRow(ctx, `
		INSERT INTO areas (city_id, name) VALUES ($1, $2) RETURNING id`,
		a.CityID, a.Name).Scan(&a.ID)
	return translate(err)
}

func (r *MasterRepository) CreateChapter(ctx context.Context, c *domain.Chapter) error {
	err := r.db.QueryRow(ctx, `
		INSERT INTO chapters (area_id, name, display_name) VALUES ($1, $2, $3)
		RETURNING id, created_at`,
		c.AreaID, c.Name, c.DisplayName).Scan(&c.ID, &c.CreatedAt)
	return translate(err)
}

func (r *MasterRepository) SetChapterActive(ctx context.Context, id string, active bool) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE chapters SET is_active = $2, updated_at = now() WHERE id = $1`, id, active)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return domain.ErrNotFound
	}
	return nil
}
