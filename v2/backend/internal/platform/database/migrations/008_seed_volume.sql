-- Bulk visitors, members and guests, generated rather than hand-written so the
-- dataset is large enough to exercise pagination, search and per-chapter
-- dashboard differences.
--
-- Statuses are assigned from the funnel position, and airtime results only ever
-- land on visitors far enough along to legitimately have one — otherwise the
-- CHECK constraint added in 005 would reject the row, and rightly so.

WITH names AS (
  SELECT * FROM (VALUES
    ('Budi Santoso'),('Sari Kusuma'),('Andi Pratama'),('Dewi Lestari'),('Rizky Wijaya'),
    ('Putri Halim'),('Hendra Nugroho'),('Maya Saputra'),('Agus Permana'),('Nina Hartono'),
    ('Fajar Gunawan'),('Ratna Setiawan'),('Doni Rahayu'),('Lestari Firmansyah'),('Iwan Santoso'),
    ('Citra Kusuma'),('Bayu Pratama'),('Wulan Lestari'),('Yudi Wijaya'),('Anggun Halim'),
    ('Reza Nugroho'),('Intan Saputra'),('Galih Permana'),('Mira Hartono'),('Surya Gunawan'),
    ('Kartika Setiawan'),('Bagas Rahayu'),('Ayu Firmansyah'),('Dimas Santoso'),('Sinta Kusuma')
  ) AS t(name)
),
fields AS (
  SELECT * FROM (VALUES
    ('Kontraktor Interior','CV Karya Mandiri'),('Konsultan Pajak','PT Sinar Abadi'),
    ('Digital Marketing','PT Nusantara Digital'),('Supplier Alat Kesehatan','CV Medika Sentosa'),
    ('Katering & Event','Dapur Rasa Catering'),('Asuransi Jiwa','PT Proteksi Utama'),
    ('Percetakan & Packaging','CV Cetak Cepat'),('Jasa Logistik','PT Kargo Lintas'),
    ('Properti & Kost','PT Griya Property'),('Klinik Kecantikan','Klinik Ayu Sehat'),
    ('IT Managed Service','PT Solusi Teknologi'),('Travel Umroh','PT Barokah Wisata')
  ) AS t(field, company)
),
chapters AS (
  SELECT * FROM (VALUES
    ('a0000004-0000-4000-8000-000000000001'::uuid, 26, 1),
    ('a0000004-0000-4000-8000-000000000002'::uuid, 18, 2),
    ('a0000004-0000-4000-8000-000000000003'::uuid, 12, 3)
  ) AS t(chapter_id, target, seq)
),
numbered AS (
  SELECT
    c.chapter_id, c.seq, g.n,
    (SELECT name FROM names OFFSET ((c.seq * 7 + g.n) % 30) LIMIT 1) AS name,
    (SELECT field FROM fields OFFSET ((c.seq * 3 + g.n) % 12) LIMIT 1) AS field,
    (SELECT company FROM fields OFFSET ((c.seq * 5 + g.n) % 12) LIMIT 1) AS company
  FROM chapters c
  CROSS JOIN LATERAL generate_series(1, c.target) AS g(n)
),
staged AS (
  SELECT
    numbered.*,
    -- Meetings already in the past can carry the full funnel; anything dated
    -- ahead can only hold pre-attendance states, or the data describes an
    -- outcome that has not happened yet.
    (ARRAY['new','followup','confirmed','attended','attended','member',
           'no_show','interview','not_continue','followup','new','confirmed']
      )[(n % 12) + 1]::visitor_status AS status
  FROM numbered
)
INSERT INTO visitors (chapter_id, name, phone, email, business_field, company, gender,
                      referral_name, meeting_id, pic_id, status,
                      attended_choice_number, attended_choice_note, created_at)
SELECT
  s.chapter_id,
  s.name || ' ' || s.n,
  '0812' || lpad(((s.seq * 1000) + s.n * 7 + 3000000)::text, 8, '0'),
  CASE WHEN s.n % 3 = 0 THEN NULL
       ELSE lower(replace(split_part(s.name, ' ', 1), ' ', '')) || s.n || '@demo.test' END,
  s.field,
  s.company,
  CASE WHEN s.n % 3 = 0 THEN 'P' ELSE 'L' END,
  (SELECT name FROM names OFFSET ((s.n * 3) % 30) LIMIT 1),
  (SELECT id FROM meetings m WHERE m.chapter_id = s.chapter_id
     ORDER BY m.meeting_date DESC OFFSET (s.n % 5) LIMIT 1),
  (SELECT id FROM users u WHERE u.chapter_id = s.chapter_id AND u.role = 'pic' AND u.is_active
     ORDER BY u.name OFFSET (s.n % 3) LIMIT 1),
  s.status,
  CASE WHEN s.status IN ('attended','interview','member','not_continue')
       THEN (s.n % 3) + 1 END,
  CASE WHEN s.status IN ('attended','interview','member','not_continue')
       THEN (ARRAY['Bersedia bergabung','Ingin datang lagi','Belum tertarik'])[(s.n % 3) + 1] END,
  now() - ((s.n % 40) || ' days')::interval
FROM staged s
-- The unique index is (meeting_id, phone); a generated collision should be
-- skipped rather than abort the whole migration.
ON CONFLICT DO NOTHING;

-- Members, with renewal dates spread across overdue / due-soon / far off.
WITH chapters AS (
  SELECT * FROM (VALUES
    ('a0000004-0000-4000-8000-000000000001'::uuid, 18, 1),
    ('a0000004-0000-4000-8000-000000000002'::uuid, 14, 2),
    ('a0000004-0000-4000-8000-000000000003'::uuid, 10, 3)
  ) AS t(chapter_id, target, seq)
)
INSERT INTO members (chapter_id, name, phone, email, business_field, company,
                     joined_date, renewal_date, status)
SELECT
  c.chapter_id,
  (ARRAY['Hendra','Maya','Bayu','Wulan','Reza','Intan','Surya','Kartika','Bagas','Ayu',
         'Dimas','Sinta','Arif','Novi','Teguh','Rani','Eko','Vina']
    )[(g.n % 18) + 1] || ' ' ||
  (ARRAY['Santoso','Kusuma','Pratama','Lestari','Wijaya','Halim','Nugroho','Saputra']
    )[(g.n % 8) + 1] || ' ' || g.n,
  '0812' || lpad(((c.seq * 2000) + g.n * 11 + 8000000)::text, 8, '0'),
  CASE WHEN g.n % 4 = 0 THEN NULL ELSE 'member' || c.seq || g.n || '@demo.test' END,
  (ARRAY['Kontraktor Interior','Konsultan Pajak','Digital Marketing','Katering & Event',
         'Asuransi Jiwa','Jasa Logistik','Properti & Kost','IT Managed Service']
    )[(g.n % 8) + 1],
  (ARRAY['CV Karya Mandiri','PT Sinar Abadi','PT Nusantara Digital','Dapur Rasa Catering',
         'PT Proteksi Utama','PT Kargo Lintas','PT Griya Property','PT Solusi Teknologi']
    )[(g.n % 8) + 1],
  CURRENT_DATE - (300 - g.n * 11),
  CASE
    WHEN g.n = 1 THEN CURRENT_DATE - 12   -- lewat jatuh tempo
    WHEN g.n = 2 THEN CURRENT_DATE + 9    -- jatuh tempo < 30 hari
    ELSE CURRENT_DATE + 120 + g.n * 7
  END,
  CASE WHEN g.n = 13 THEN 'inactive'::member_status ELSE 'active'::member_status END
FROM chapters c
CROSS JOIN LATERAL generate_series(1, c.target) AS g(n)
ON CONFLICT DO NOTHING;

-- Guests: people who attended without entering the visitor pipeline.
WITH chapters AS (
  SELECT * FROM (VALUES
    ('a0000004-0000-4000-8000-000000000001'::uuid, 6, 1),
    ('a0000004-0000-4000-8000-000000000002'::uuid, 6, 2),
    ('a0000004-0000-4000-8000-000000000003'::uuid, 6, 3)
  ) AS t(chapter_id, target, seq)
)
INSERT INTO guests (chapter_id, name, gender, business_field, company, phone,
                    referral_name, meeting_id, visit_date, meeting_format)
SELECT
  c.chapter_id,
  (ARRAY['Galih','Mira','Surya','Kartika','Bagas','Ayu']
    )[(g.n % 6) + 1] || ' ' ||
  (ARRAY['Firmansyah','Rahayu','Gunawan','Setiawan','Permana','Hartono']
    )[(g.n % 6) + 1] || ' ' || (c.seq * 10 + g.n),
  CASE WHEN g.n % 2 = 0 THEN 'L' ELSE 'P' END,
  (ARRAY['IT Managed Service','Travel Umroh','Percetakan & Packaging',
         'Klinik Kecantikan','Supplier Alat Kesehatan','Asuransi Jiwa'])[(g.n % 6) + 1],
  (ARRAY['PT Solusi Teknologi','PT Barokah Wisata','CV Cetak Cepat',
         'Klinik Ayu Sehat','CV Medika Sentosa','PT Proteksi Utama'])[(g.n % 6) + 1],
  '0812' || lpad(((c.seq * 3000) + g.n * 13 + 9000000)::text, 8, '0'),
  (ARRAY['Hendra Santoso','Maya Kusuma','Bayu Pratama'])[(g.n % 3) + 1],
  (SELECT id FROM meetings m WHERE m.chapter_id = c.chapter_id
     ORDER BY m.meeting_date DESC OFFSET (g.n % 4) LIMIT 1),
  CURRENT_DATE - (g.n * 7),
  CASE WHEN g.n % 2 = 0 THEN 'offline' ELSE 'online' END
FROM chapters c
CROSS JOIN LATERAL generate_series(1, c.target) AS g(n)
ON CONFLICT DO NOTHING;
