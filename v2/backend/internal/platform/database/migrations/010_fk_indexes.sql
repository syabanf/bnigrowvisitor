-- Indexes on the foreign keys that had none.
--
-- Postgres creates an index for a PRIMARY KEY and a UNIQUE constraint, but not
-- for a REFERENCES column. Every join and every ON DELETE check against these
-- columns is a sequential scan until the planner is given something better —
-- which does not show up in a small demo dataset and does show up in
-- production.

CREATE INDEX IF NOT EXISTS idx_visitors_created_by      ON visitors (created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by      ON meetings (created_by);
CREATE INDEX IF NOT EXISTS idx_users_organization       ON users (organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_actor           ON activity_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_user         ON login_audit (user_id);
CREATE INDEX IF NOT EXISTS idx_chapter_domains_chapter  ON chapter_domains (chapter_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by      ON api_keys (created_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_organization    ON api_keys (organization_id);
CREATE INDEX IF NOT EXISTS idx_policies_organization    ON national_policies (organization_id);

-- Not a foreign key, but the same problem: the members list sorts by name
-- within a chapter, and the renewal dashboard counts by date.
CREATE INDEX IF NOT EXISTS idx_members_chapter_name     ON members (chapter_id, name);
