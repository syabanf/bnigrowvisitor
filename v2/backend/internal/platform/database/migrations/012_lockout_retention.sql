-- Account lockout and audit retention.

-- The lockout counter lives on the user, not in a cache, so it survives a
-- restart. An attacker who can force a restart must not get a clean slate.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_users_locked ON users (locked_until)
  WHERE locked_until IS NOT NULL;

-- Both audit tables grow without bound. Deleting on a schedule keeps them
-- useful rather than letting them become the largest thing in the database.
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs (created_at);
