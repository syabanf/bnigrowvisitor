-- The remaining half of the same gap. Members are searched on name, phone,
-- email and company; only name and phone were indexed, so the member search
-- sequentially scans for exactly the reason the visitor search did.
CREATE INDEX IF NOT EXISTS idx_members_email_trgm ON members USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_members_company_trgm ON members USING gin (company gin_trgm_ops);

-- Two searches are deliberately left unindexed, so the omission is a decision
-- rather than the next thing someone finds:
--
--   meetings (title, location) — a chapter meets weekly, so this table holds
--   tens of rows per chapter. A sequential scan over that is cheaper than
--   maintaining a GIN index on every write.
--
--   login_audit (email) — bounded by the retention sweep at 90 days, and read
--   only from the governance screen. It is the highest-write table in the
--   schema; indexing it would tax every login to speed up an occasional audit.
