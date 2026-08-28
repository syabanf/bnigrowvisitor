-- National governance: policies that apply across chapters, and API keys for
-- external integrations.

CREATE TABLE IF NOT EXISTS national_policies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  -- NULL means the national default; a value overrides it for one chapter.
  chapter_id      uuid REFERENCES chapters(id) ON DELETE CASCADE,
  policy_type     varchar(40) NOT NULL,
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One row per (chapter, type). A partial unique index is needed because NULL is
-- never equal to NULL in a plain UNIQUE, so the national default could be
-- inserted twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_chapter
  ON national_policies (chapter_id, policy_type) WHERE chapter_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_national
  ON national_policies (policy_type) WHERE chapter_id IS NULL;

CREATE TABLE IF NOT EXISTS api_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            varchar(120) NOT NULL,
  -- Only the leading slice is stored for display. The full key is never
  -- persisted; a stolen database cannot yield a working credential.
  key_prefix      varchar(20) NOT NULL,
  key_hash        varchar(64) NOT NULL UNIQUE,
  scope           varchar(40) NOT NULL DEFAULT 'finance',
  is_active       boolean NOT NULL DEFAULT true,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  last_used_at    timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys (is_active, created_at DESC);

INSERT INTO national_policies (organization_id, chapter_id, policy_type, config) VALUES
  ('a0000001-0000-4000-8000-000000000001', NULL, 'visitor_frequency',
   '{"max_visits": 3, "period_months": 6}'::jsonb),
  ('a0000001-0000-4000-8000-000000000001', NULL, 'membership_renewal',
   '{"grace_period_days": 30, "reminder_days": [30, 14, 7]}'::jsonb),
  ('a0000001-0000-4000-8000-000000000001', NULL, 'chapter_target',
   '{"visitors_per_meeting": 10, "member_conversion_pct": 15, "min_active_pic": 3}'::jsonb)
ON CONFLICT DO NOTHING;
