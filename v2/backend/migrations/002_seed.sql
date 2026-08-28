-- Development seed. Every account uses the password "demo123"; the hash below
-- is bcrypt cost 12, matching platform/password so no login triggers a rehash.
--
-- Idempotent throughout: ON CONFLICT DO NOTHING lets the container re-run this
-- on restart without duplicating rows or failing the boot.

INSERT INTO organizations (id, name, code) VALUES
  ('a0000001-0000-4000-8000-000000000001', 'BNI Indonesia', 'BNI-ID')
ON CONFLICT (id) DO NOTHING;

INSERT INTO cities (id, organization_id, name) VALUES
  ('a0000002-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'Jakarta'),
  ('a0000002-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000001', 'Surabaya')
ON CONFLICT (id) DO NOTHING;

INSERT INTO areas (id, city_id, name) VALUES
  ('a0000003-0000-4000-8000-000000000001', 'a0000002-0000-4000-8000-000000000001', 'Jakarta Selatan'),
  ('a0000003-0000-4000-8000-000000000002', 'a0000002-0000-4000-8000-000000000001', 'Jakarta Pusat'),
  ('a0000003-0000-4000-8000-000000000003', 'a0000002-0000-4000-8000-000000000002', 'Surabaya Barat')
ON CONFLICT (id) DO NOTHING;

INSERT INTO chapters (id, area_id, name, display_name) VALUES
  ('a0000004-0000-4000-8000-000000000001', 'a0000003-0000-4000-8000-000000000001', 'BNI Grow',  'BNI Grow Chapter'),
  ('a0000004-0000-4000-8000-000000000002', 'a0000003-0000-4000-8000-000000000002', 'BNI Rise',  'BNI Rise Chapter'),
  ('a0000004-0000-4000-8000-000000000003', 'a0000003-0000-4000-8000-000000000003', 'BNI Surya', 'BNI Surya Chapter')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, name, email, password_hash, role, phone, organization_id, chapter_id) VALUES
  ('a0000006-0000-4000-8000-000000000001', 'Rina Wijaya',  'national@demo.test',
   '$2a$12$CpiyvkYGiymwt1oBSvAYme4jVlUShb5dChXtdtLoZhv/1e7MXd43a', 'national_admin', '081200000001',
   'a0000001-0000-4000-8000-000000000001', NULL),
  ('a0000006-0000-4000-8000-000000000002', 'Budi Santoso', 'grow@demo.test',
   '$2a$12$CpiyvkYGiymwt1oBSvAYme4jVlUShb5dChXtdtLoZhv/1e7MXd43a', 'chapter_admin', '081200000002',
   'a0000001-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000001'),
  ('a0000006-0000-4000-8000-000000000003', 'Sari Kusuma',  'rise@demo.test',
   '$2a$12$CpiyvkYGiymwt1oBSvAYme4jVlUShb5dChXtdtLoZhv/1e7MXd43a', 'chapter_admin', '081200000003',
   'a0000001-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000002'),
  ('a0000006-0000-4000-8000-000000000004', 'Andi Pratama', 'pic@demo.test',
   '$2a$12$CpiyvkYGiymwt1oBSvAYme4jVlUShb5dChXtdtLoZhv/1e7MXd43a', 'pic', '081200000004',
   'a0000001-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;

INSERT INTO meetings (id, chapter_id, title, meeting_date, location, created_by) VALUES
  ('a0000007-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000001',
   'Weekly Meeting BNI Grow', CURRENT_DATE - 7, 'Ballroom BNI Grow Chapter',
   'a0000006-0000-4000-8000-000000000002'),
  ('a0000007-0000-4000-8000-000000000002', 'a0000004-0000-4000-8000-000000000001',
   'Weekly Meeting BNI Grow', CURRENT_DATE + 7, 'Ballroom BNI Grow Chapter',
   'a0000006-0000-4000-8000-000000000002'),
  ('a0000007-0000-4000-8000-000000000003', 'a0000004-0000-4000-8000-000000000002',
   'Weekly Meeting BNI Rise',  CURRENT_DATE - 5, 'Ballroom BNI Rise Chapter',
   'a0000006-0000-4000-8000-000000000003')
ON CONFLICT (id) DO NOTHING;

INSERT INTO visitors (id, chapter_id, name, phone, email, business_field, company, gender,
                      referral_name, meeting_id, pic_id, status, created_by) VALUES
  ('a0000008-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000001',
   'Doni Nugroho', '081230085625', 'doni@demo.test', 'Properti & Kost', 'PT Solusi Teknologi', 'L',
   'Budi Santoso', 'a0000007-0000-4000-8000-000000000001', 'a0000006-0000-4000-8000-000000000004',
   'attended', 'a0000006-0000-4000-8000-000000000002'),
  ('a0000008-0000-4000-8000-000000000002', 'a0000004-0000-4000-8000-000000000001',
   'Ratna Halim', '081230085488', 'ratna@demo.test', 'Jasa Logistik', 'Klinik Ayu Sehat', 'P',
   'Budi Santoso', 'a0000007-0000-4000-8000-000000000001', 'a0000006-0000-4000-8000-000000000004',
   'member', 'a0000006-0000-4000-8000-000000000002'),
  ('a0000008-0000-4000-8000-000000000003', 'a0000004-0000-4000-8000-000000000001',
   'Fajar Wijaya', '081230085351', NULL, 'Percetakan & Packaging', 'PT Griya Property', 'L',
   'Budi Santoso', 'a0000007-0000-4000-8000-000000000002', NULL,
   'confirmed', 'a0000006-0000-4000-8000-000000000002'),
  ('a0000008-0000-4000-8000-000000000004', 'a0000004-0000-4000-8000-000000000001',
   'Nina Lestari', '081230085214', NULL, 'Asuransi Jiwa', 'PT Kargo Lintas', 'P',
   'Budi Santoso', 'a0000007-0000-4000-8000-000000000002', 'a0000006-0000-4000-8000-000000000004',
   'followup', 'a0000006-0000-4000-8000-000000000002'),
  -- Belongs to another chapter: proves scope isolation is enforced, not assumed.
  ('a0000008-0000-4000-8000-000000000005', 'a0000004-0000-4000-8000-000000000002',
   'Agus Pratama', '081230085077', NULL, 'Katering & Event', 'CV Cetak Cepat', 'L',
   'Sari Kusuma', 'a0000007-0000-4000-8000-000000000003', NULL,
   'new', 'a0000006-0000-4000-8000-000000000003')
ON CONFLICT (id) DO NOTHING;
