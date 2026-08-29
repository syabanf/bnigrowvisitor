-- 015 removed the trailing counters but assigned names in pool order, which
-- walks every given name against one family name before moving on. The result
-- reads as generated in a different way: the first thirty visitors were all
-- called Santoso.
--
-- Ordering the pool by a hash of its two indices mixes given and family names
-- while staying deterministic — the same rows get the same names on every
-- fresh database, which matters because screenshots and the quick tour refer
-- to them.
--
-- A second migration rather than an edit to 015: the runner checksums applied
-- migrations and refuses to start if one changes underneath it, which is what
-- stops a schema from silently diverging between environments. Paying that here
-- is the point of the guard.

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
  row_number() OVER (ORDER BY md5(g.n::text || ':' || f.n::text)) AS idx,
  g.v || ' ' || f.v AS full_name,
  lower(g.v) || '.' || lower(f.v) AS email_local
FROM family f CROSS JOIN given g;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY chapter_id, created_at, id) AS rn, email
  FROM visitors
)
UPDATE visitors v
SET name  = p.full_name,
    email = CASE WHEN o.email IS NULL OR o.email = '' THEN v.email
                 ELSE p.email_local || '@demo.test' END
FROM ordered o JOIN seed_name_pool p ON p.idx = o.rn
WHERE v.id = o.id;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY chapter_id, created_at, id) AS rn, email
  FROM members
)
UPDATE members m
SET name  = p.full_name,
    email = CASE WHEN o.email IS NULL OR o.email = '' THEN m.email
                 ELSE p.email_local || '@demo.test' END
FROM ordered o JOIN seed_name_pool p ON p.idx = o.rn + 120
WHERE m.id = o.id;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY chapter_id, created_at, id) AS rn, email
  FROM guests
)
UPDATE guests g
SET name  = p.full_name,
    email = CASE WHEN o.email IS NULL OR o.email = '' THEN g.email
                 ELSE p.email_local || '@demo.test' END
FROM ordered o JOIN seed_name_pool p ON p.idx = o.rn + 240
WHERE g.id = o.id;

UPDATE visitors v
SET referral_name = p.full_name
FROM seed_name_pool p
WHERE v.referral_name IS NOT NULL
  AND v.referral_name <> ''
  AND p.idx = ((abs(hashtext(v.id::text)) % 120) + 1);

DROP TABLE seed_name_pool;
