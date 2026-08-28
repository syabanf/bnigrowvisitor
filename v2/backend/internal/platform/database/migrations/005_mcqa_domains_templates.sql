-- Remaining tables and columns for feature parity with the Next.js app.

-- MCQA: the airtime outcome recorded for a visitor who attended.
-- 1 = willing to join, 2 = wants to visit again, 3 = not interested yet.
ALTER TABLE visitors
  ADD COLUMN IF NOT EXISTS attended_choice_number smallint,
  ADD COLUMN IF NOT EXISTS attended_choice_note  varchar(120);

ALTER TABLE visitors
  ADD CONSTRAINT visitors_attended_choice_range
  CHECK (attended_choice_number IS NULL OR attended_choice_number BETWEEN 1 AND 3);

-- Only attended visitors can have an airtime result; anything else is a data
-- bug that the database should refuse rather than store.
ALTER TABLE visitors
  ADD CONSTRAINT visitors_attended_choice_requires_attendance
  CHECK (attended_choice_number IS NULL OR status IN ('attended', 'interview', 'member', 'not_continue'));

CREATE INDEX IF NOT EXISTS idx_visitors_attended_choice ON visitors (attended_choice_number)
  WHERE attended_choice_number IS NOT NULL;

-- Multi-tenant: which host serves which chapter.
CREATE TABLE IF NOT EXISTS chapter_domains (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  domain     varchar(255) NOT NULL UNIQUE,
  type       varchar(30) NOT NULL DEFAULT 'subdomain',
  is_primary boolean NOT NULL DEFAULT false,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chapter_domains_type_check CHECK (type IN ('subdomain', 'custom_domain', 'localhost'))
);

CREATE INDEX IF NOT EXISTS idx_chapter_domains_lookup ON chapter_domains (domain) WHERE is_active;

-- WhatsApp message templates, per chapter.
CREATE TABLE IF NOT EXISTS wa_templates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name       varchar(120) NOT NULL,
  body       text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chapter_id, name)
);

-- Audit trail for data changes, not just logins.
CREATE TABLE IF NOT EXISTS activity_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name   varchar(150),
  actor_role   varchar(50),
  chapter_id   uuid REFERENCES chapters(id) ON DELETE CASCADE,
  action       varchar(30) NOT NULL,
  entity       varchar(50) NOT NULL,
  entity_id    uuid,
  entity_label text,
  metadata     jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_chapter_created ON activity_logs (chapter_id, created_at DESC);
