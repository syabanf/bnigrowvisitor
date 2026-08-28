-- Schema for the Go rebuild. Ported from the Supabase migrations, with the
-- multi-tenant spine (organization > city > area > chapter) kept intact.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       varchar(150) NOT NULL UNIQUE,
  code       varchar(80)  NOT NULL UNIQUE,
  is_active  boolean      NOT NULL DEFAULT true,
  created_at timestamptz  NOT NULL DEFAULT now(),
  updated_at timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cities (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            varchar(120) NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS areas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id    uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name       varchar(120) NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, name)
);

CREATE TABLE IF NOT EXISTS chapters (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id      uuid NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  name         varchar(120) NOT NULL,
  display_name varchar(180) NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (area_id, name)
);

CREATE TYPE user_role AS ENUM ('admin', 'national_admin', 'chapter_admin', 'pic', 'member');

CREATE TABLE IF NOT EXISTS users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            varchar(100) NOT NULL,
  email           varchar(150) NOT NULL UNIQUE,
  password_hash   text NOT NULL,
  role            user_role NOT NULL DEFAULT 'pic',
  phone           varchar(20),
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  chapter_id      uuid REFERENCES chapters(id) ON DELETE SET NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Lookups are always by lowercased email, so the index has to match or it is
-- never used.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_users_chapter ON users (chapter_id);

CREATE TABLE IF NOT EXISTS meetings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id   uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  title        varchar(150) NOT NULL,
  meeting_date date NOT NULL,
  location     varchar(200),
  notes        text,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetings_chapter_date ON meetings (chapter_id, meeting_date DESC);

CREATE TYPE visitor_status AS ENUM (
  'new', 'followup', 'confirmed', 'attended', 'no_show', 'interview', 'member', 'not_continue'
);

CREATE TABLE IF NOT EXISTS visitors (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id     uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  name           varchar(150) NOT NULL,
  phone          varchar(30) NOT NULL,
  email          varchar(150),
  business_field varchar(150),
  company        varchar(150),
  gender         varchar(10),
  referral_name  varchar(150),
  meeting_id     uuid REFERENCES meetings(id) ON DELETE SET NULL,
  pic_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  status         visitor_status NOT NULL DEFAULT 'new',
  notes          text,
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Every list query filters by chapter first, then sorts by recency.
CREATE INDEX IF NOT EXISTS idx_visitors_chapter_created ON visitors (chapter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitors_status ON visitors (status);
CREATE INDEX IF NOT EXISTS idx_visitors_meeting ON visitors (meeting_id);
CREATE INDEX IF NOT EXISTS idx_visitors_pic ON visitors (pic_id);

-- A returning visitor may attend several meetings, so the phone is unique per
-- meeting rather than globally.
CREATE UNIQUE INDEX IF NOT EXISTS idx_visitors_phone_per_meeting
  ON visitors (meeting_id, phone) WHERE meeting_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS login_audit (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  email      varchar(180),
  success    boolean NOT NULL,
  reason     varchar(120),
  ip         varchar(60),
  user_agent text,
  chapter_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_audit_created ON login_audit (created_at DESC);
