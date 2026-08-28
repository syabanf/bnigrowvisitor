-- Trigram indexes for the columns the search actually matches on.
--
-- Both search predicates are a disjunction of ILIKE '%…%' over several columns.
-- One unindexed branch is enough to make the others useless: Postgres cannot
-- satisfy the whole OR from indexes, so it sequentially scans the table and
-- evaluates every predicate on every row.
--
-- Visitors matched name, phone, email and company; email had no index.
-- Guests matched name, phone and company; only name had one.
--
-- Measured on 40k visitors, the search endpoint served 60 requests a second
-- against 423 for an unfiltered list — by a wide margin the slowest thing in
-- the app, and the one people type into most.
--
-- Only the searched columns are indexed. A trigram index is not small, and one
-- on a column nothing searches is write cost with no read to pay for it.
CREATE INDEX IF NOT EXISTS idx_visitors_email_trgm ON visitors USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_guests_phone_trgm ON guests USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_guests_company_trgm ON guests USING gin (company gin_trgm_ops);
