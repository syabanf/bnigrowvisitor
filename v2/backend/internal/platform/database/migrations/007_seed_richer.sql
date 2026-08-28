-- A fuller demo dataset. The thin original seed made every screen look empty
-- and hid problems that only appear with volume: pagination, search that has to
-- discriminate, dashboards where the numbers actually differ per chapter.
--
-- All accounts use the password "demo123" (bcrypt cost 12).

-- More PICs per chapter, so the assignment picker and per-PIC reports have
-- real spread instead of a single name.
INSERT INTO users (id, name, email, password_hash, role, phone, organization_id, chapter_id) VALUES
  ('a0000006-0000-4000-8000-000000000011', 'Reza Nugroho',    'pic1.grow@demo.test',
   '$2a$12$CpiyvkYGiymwt1oBSvAYme4jVlUShb5dChXtdtLoZhv/1e7MXd43a', 'pic', '081200000011',
   'a0000001-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000001'),
  ('a0000006-0000-4000-8000-000000000012', 'Intan Saputra',   'pic2.grow@demo.test',
   '$2a$12$CpiyvkYGiymwt1oBSvAYme4jVlUShb5dChXtdtLoZhv/1e7MXd43a', 'pic', '081200000012',
   'a0000001-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000001'),
  ('a0000006-0000-4000-8000-000000000013', 'Galih Permana',   'pic3.grow@demo.test',
   '$2a$12$CpiyvkYGiymwt1oBSvAYme4jVlUShb5dChXtdtLoZhv/1e7MXd43a', 'pic', '081200000013',
   'a0000001-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000001'),
  ('a0000006-0000-4000-8000-000000000014', 'Ayu Hartono',     'pic1.rise@demo.test',
   '$2a$12$CpiyvkYGiymwt1oBSvAYme4jVlUShb5dChXtdtLoZhv/1e7MXd43a', 'pic', '081200000014',
   'a0000001-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000002'),
  ('a0000006-0000-4000-8000-000000000015', 'Bagas Wijaya',    'pic2.rise@demo.test',
   '$2a$12$CpiyvkYGiymwt1oBSvAYme4jVlUShb5dChXtdtLoZhv/1e7MXd43a', 'pic', '081200000015',
   'a0000001-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000002'),
  ('a0000006-0000-4000-8000-000000000016', 'Mira Kusuma',     'pic1.surya@demo.test',
   '$2a$12$CpiyvkYGiymwt1oBSvAYme4jVlUShb5dChXtdtLoZhv/1e7MXd43a', 'pic', '081200000016',
   'a0000001-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000003'),
  ('a0000006-0000-4000-8000-000000000017', 'Dimas Gunawan',   'surya@demo.test',
   '$2a$12$CpiyvkYGiymwt1oBSvAYme4jVlUShb5dChXtdtLoZhv/1e7MXd43a', 'chapter_admin', '081200000017',
   'a0000001-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000003'),
  ('a0000006-0000-4000-8000-000000000018', 'Dewi Lestari',    'member@demo.test',
   '$2a$12$CpiyvkYGiymwt1oBSvAYme4jVlUShb5dChXtdtLoZhv/1e7MXd43a', 'member', '081200000018',
   'a0000001-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000001'),
  -- A deactivated account, so the "Aktifkan" path has something to act on and
  -- the login-refusal behaviour is visible in the demo.
  ('a0000006-0000-4000-8000-000000000019', 'Wawan Nonaktif',  'nonaktif@demo.test',
   '$2a$12$CpiyvkYGiymwt1oBSvAYme4jVlUShb5dChXtdtLoZhv/1e7MXd43a', 'pic', '081200000019',
   'a0000001-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

UPDATE users SET is_active = false WHERE email = 'nonaktif@demo.test';

-- Weekly meetings: six past plus one upcoming per chapter, so the dashboard has
-- history and the "akan datang" badge has something to mark.
INSERT INTO meetings (id, chapter_id, title, meeting_date, location, created_by)
SELECT
  ('a0000007-0000-4000-8000-0000000001' || lpad((c.n * 10 + w.n)::text, 2, '0'))::uuid,
  c.chapter_id,
  'Weekly Meeting ' || c.label,
  CURRENT_DATE - (w.n * 7) + 7,
  c.venue,
  c.admin_id
FROM (VALUES
  (1, 'a0000004-0000-4000-8000-000000000001'::uuid, 'BNI Grow',  'Ballroom BNI Grow',  'a0000006-0000-4000-8000-000000000002'::uuid),
  (2, 'a0000004-0000-4000-8000-000000000002'::uuid, 'BNI Rise',  'Ballroom BNI Rise',  'a0000006-0000-4000-8000-000000000003'::uuid),
  (3, 'a0000004-0000-4000-8000-000000000003'::uuid, 'BNI Surya', 'Hotel Vasa Surabaya','a0000006-0000-4000-8000-000000000017'::uuid)
) AS c(n, chapter_id, label, venue, admin_id)
CROSS JOIN generate_series(0, 5) AS w(n)
ON CONFLICT (id) DO NOTHING;
