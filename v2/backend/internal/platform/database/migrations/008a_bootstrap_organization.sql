-- The one row every deployment needs, separated from the demonstration data it
-- used to be bundled with.
--
-- 002_seed.sql created the organization alongside the demo accounts, so
-- skipping the seeds in production also skipped the organization — and 009,
-- which inserts default policies referencing it, then failed its foreign key
-- and aborted the whole migration run. A fresh production database could not
-- start at all.
--
-- Numbered 008a so it sorts between 008 and 009: '_' precedes 'a', so
-- "008_seed_volume.sql" < "008a_..." < "009_...". Existing databases have
-- already applied 009, so this arriving late is harmless — the insert is
-- idempotent, and nothing before it changes.
--
-- Deliberately not named with the seed marker: this is bootstrap, not sample
-- data. An app with no organization has no root for chapters, policies or
-- users to hang from.
INSERT INTO organizations (id, name, code) VALUES
  ('a0000001-0000-4000-8000-000000000001', 'BNI Indonesia', 'BNI-ID')
ON CONFLICT (id) DO NOTHING;
