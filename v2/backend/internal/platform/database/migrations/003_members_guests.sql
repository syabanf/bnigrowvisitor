-- Members and guests. Guests are people who attended without going through the
-- visitor pipeline (usually imported from a BNI report), kept in their own
-- table so they never distort visitor conversion statistics.

CREATE TYPE member_status AS ENUM ('active', 'inactive', 'suspended');

CREATE TABLE IF NOT EXISTS members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id      uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name            varchar(150) NOT NULL,
  phone           varchar(30),
  email           varchar(150),
  business_field  varchar(150),
  company         varchar(150),
  joined_date     date,
  renewal_date    date,
  last_renewed_at timestamptz,
  status          member_status NOT NULL DEFAULT 'active',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_members_chapter ON members (chapter_id, name);
CREATE INDEX IF NOT EXISTS idx_members_status ON members (status);
-- Partial: rows without a renewal date are never scanned by the "due soon"
-- query, so they do not belong in the index.
CREATE INDEX IF NOT EXISTS idx_members_renewal ON members (renewal_date)
  WHERE renewal_date IS NOT NULL;

CREATE TABLE IF NOT EXISTS guests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id     uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name           varchar(150) NOT NULL,
  gender         varchar(20),
  business_field varchar(150),
  company        varchar(150),
  phone          varchar(30),
  email          varchar(150),
  referral_name  varchar(150),
  meeting_id     uuid REFERENCES meetings(id) ON DELETE SET NULL,
  visit_date     date,
  meeting_format varchar(20),
  source_type    varchar(50) NOT NULL DEFAULT 'Guest',
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guests_chapter ON guests (chapter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guests_meeting ON guests (meeting_id);
