-- Trigram indexes for the search boxes.
--
-- Search uses ILIKE '%term%'. A leading wildcard makes a B-tree index useless,
-- so the planner reads every row and discards almost all of them — measured at
-- 17k visitors: a sequential scan removing 17,621 rows by filter to return 11.
-- That cost grows linearly, so it is fine in a demo and unusable in production.
--
-- pg_trgm indexes three-character substrings, which is what lets a middle-of-
-- the-string match use an index at all. GIN rather than GiST: slower to write,
-- much faster to search, and these columns are read far more than written.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_visitors_name_trgm
  ON visitors USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_visitors_phone_trgm
  ON visitors USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_visitors_company_trgm
  ON visitors USING gin (company gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_members_name_trgm
  ON members USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_members_phone_trgm
  ON members USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_guests_name_trgm
  ON guests USING gin (name gin_trgm_ops);
