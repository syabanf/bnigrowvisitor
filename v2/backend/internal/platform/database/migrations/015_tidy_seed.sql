-- Tidies the demo dataset. Nothing structural — this only rewrites seeded rows
-- so the app demonstrates well.
--
-- Three things were wrong, all of them the first thing a visitor to the demo
-- sees:
--
--   1. Names carried a trailing counter — "Dewi Lestari 26", "Andi Pratama 25".
--      008 appended it because a 30-name pool cannot fill 56 rows without
--      colliding, and the unique constraint is on (meeting_id, phone) so a
--      repeat would have been legal but confusing. A larger pool removes the
--      need for the counter entirely.
--
--   2. business_field and company were drawn from different offsets of the same
--      list, so every pairing was nonsense: life insurance at a logistics firm,
--      catering at a printing shop.
--
--   3. Emails were built from the old numbered name, so they matched nothing.
--
-- Written as an UPDATE rather than a re-seed: the rows are referenced by
-- meetings, activity logs and audit entries, and replacing them would orphan
-- all of it.

-- 30 given names x 12 family names = 360 distinct combinations, which is far
-- more than the ~130 rows seeded. Each table takes a different slice, so a
-- visitor and a member are never the same person.
CREATE TEMPORARY TABLE seed_name_pool AS
WITH given AS (
  SELECT v, n FROM unnest(ARRAY[
    'Adi','Bagas','Citra','Dimas','Eka','Fajar','Galih','Hana','Indra','Joko',
    'Kartika','Lestari','Maya','Nadia','Oka','Putri','Rangga','Sinta','Tegar','Utami',
    'Vina','Wahyu','Yudha','Zahra','Ayu','Bima','Dewi','Farhan','Gita','Hendra'
  ]) WITH ORDINALITY AS t(v, n)
),
family AS (
  SELECT v, n FROM unnest(ARRAY[
    'Santoso','Kusuma','Pratama','Wijaya','Halim','Nugroho',
    'Saputra','Permana','Hartono','Gunawan','Setiawan','Rahayu'
  ]) WITH ORDINALITY AS t(v, n)
)
SELECT
  row_number() OVER (ORDER BY f.n, g.n) AS idx,
  g.v || ' ' || f.v AS full_name,
  lower(g.v) || '.' || lower(f.v) AS email_local
FROM family f CROSS JOIN given g;

-- Field and company as one row, so a business can no longer be in the wrong
-- industry.
CREATE TEMPORARY TABLE seed_business AS
SELECT * FROM (VALUES
  (1,  'Kontraktor Interior',     'CV Karya Mandiri'),
  (2,  'Konsultan Pajak',         'PT Sinar Abadi'),
  (3,  'Digital Marketing',       'PT Nusantara Digital'),
  (4,  'Supplier Alat Kesehatan', 'CV Medika Sentosa'),
  (5,  'Katering & Event',        'Dapur Rasa Catering'),
  (6,  'Asuransi Jiwa',           'PT Proteksi Utama'),
  (7,  'Percetakan & Packaging',  'CV Cetak Cepat'),
  (8,  'Jasa Logistik',           'PT Kargo Lintas'),
  (9,  'Properti & Kost',         'PT Griya Property'),
  (10, 'Klinik Kecantikan',       'Klinik Ayu Sehat'),
  (11, 'IT Managed Service',      'PT Solusi Teknologi'),
  (12, 'Travel Umroh',            'PT Barokah Wisata')
) AS t(n, field, company);

-- Visitors ------------------------------------------------------------------
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY chapter_id, created_at, id) AS rn, email
  FROM visitors
)
UPDATE visitors v
SET name           = p.full_name,
    business_field = b.field,
    company        = b.company,
    -- A NULL email stays NULL: not everyone leaves one, and the demo is more
    -- honest for showing that.
    email          = CASE WHEN o.email IS NULL OR o.email = '' THEN v.email
                          ELSE p.email_local || '@demo.test' END
FROM ordered o
JOIN seed_name_pool p ON p.idx = o.rn
JOIN seed_business  b ON b.n   = ((o.rn - 1) % 12) + 1
WHERE v.id = o.id;

-- Members -------------------------------------------------------------------
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY chapter_id, created_at, id) AS rn, email
  FROM members
)
UPDATE members m
SET name           = p.full_name,
    business_field = b.field,
    company        = b.company,
    email          = CASE WHEN o.email IS NULL OR o.email = '' THEN m.email
                          ELSE p.email_local || '@demo.test' END
FROM ordered o
-- Offset by 120 so members and visitors never share a name.
JOIN seed_name_pool p ON p.idx = o.rn + 120
JOIN seed_business  b ON b.n   = ((o.rn - 1) % 12) + 1
WHERE m.id = o.id;

-- Guests --------------------------------------------------------------------
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY chapter_id, created_at, id) AS rn, email
  FROM guests
)
UPDATE guests g
SET name           = p.full_name,
    business_field = b.field,
    company        = b.company,
    email          = CASE WHEN o.email IS NULL OR o.email = '' THEN g.email
                          ELSE p.email_local || '@demo.test' END
FROM ordered o
JOIN seed_name_pool p ON p.idx = o.rn + 240
JOIN seed_business  b ON b.n   = ((o.rn - 1) % 12) + 1
WHERE g.id = o.id;

-- A referral has to be someone; pointing at a name that is no longer in the
-- data would look like a broken link rather than a person.
UPDATE visitors v
SET referral_name = p.full_name
FROM seed_name_pool p
WHERE v.referral_name IS NOT NULL
  AND v.referral_name <> ''
  AND p.idx = ((abs(hashtext(v.id::text)) % 120) + 1);

DROP TABLE seed_name_pool;
DROP TABLE seed_business;
