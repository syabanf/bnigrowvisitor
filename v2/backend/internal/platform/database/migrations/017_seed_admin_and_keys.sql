-- Two gaps in the demo data.
--
-- The user_role enum has five values and the seed covered four: there was no
-- account for `admin` at all, so the one role that sits above national had no
-- way to be tried. It behaves the same as national_admin today — IsNational()
-- covers both — but a demo that cannot show a role is a demo with a hole in it,
-- and the quick sign-in panel is built from whatever accounts exist.
--
-- Same bcrypt hash as every other seeded account (cost 12, matching
-- platform/password so no login triggers a rehash): the password is "demo123".
INSERT INTO users (id, name, email, password_hash, role, phone, organization_id, chapter_id) VALUES
  ('a0000006-0000-4000-8000-0000000000ff', 'Arif Nugroho', 'admin@demo.test',
   '$2a$12$CpiyvkYGiymwt1oBSvAYme4jVlUShb5dChXtdtLoZhv/1e7MXd43a', 'admin', '081200000099',
   'a0000001-0000-4000-8000-000000000001', NULL)
ON CONFLICT (id) DO NOTHING;

-- The API Keys screen and the whole /external/v1 surface were built, and the
-- table was empty — so the screen demoed as a blank state and the external API
-- had nothing to try it with.
--
-- The hashes below are of random values that were never written down, so these
-- rows are records, not credentials. That is deliberate: a working key in a
-- seed is a machine credential that ships to every deployment and is easy to
-- forget about, and it would not help anyway — the plaintext is shown once at
-- creation and never again, so a listed key is not usable even in the real
-- flow. The screen shows what it looks like populated; a real key is minted
-- from the UI.
--
-- The three rows cover the states the screen has to render differently: active,
-- deactivated, and expired.
INSERT INTO api_keys (id, name, key_prefix, key_hash, scope, is_active,
                      organization_id, last_used_at, expires_at, created_at) VALUES
  ('a0000009-0000-4000-8000-000000000001', 'Integrasi Keuangan', 'bnik_7f3a',
   '2acffb954b7fb27a433499a3f21375eb8c0d95ed299c6a98b2618907ec2c7fd0', 'finance', true,
   'a0000001-0000-4000-8000-000000000001', now() - interval '2 hours', NULL, now() - interval '40 days'),

  ('a0000009-0000-4000-8000-000000000002', 'Dashboard Lama (nonaktif)', 'bnik_2b91',
   'becfa7b8e097342ede62a9061baab90f3821e744f1a1249978aabfb9b2c0165b', 'finance', false,
   'a0000001-0000-4000-8000-000000000001', now() - interval '90 days', NULL, now() - interval '150 days'),

  -- Expired rather than deactivated: FindByHash refuses both, and the screen
  -- has to tell them apart or nobody can work out why a key stopped working.
  ('a0000009-0000-4000-8000-000000000003', 'Uji Coba Vendor', 'bnik_e05c',
   '6bbfa4bb55e894efaca5577b74035e00b1bc3d640c0e049f73dc6f7835eba160', 'finance', true,
   'a0000001-0000-4000-8000-000000000001', NULL, now() - interval '7 days', now() - interval '60 days')
ON CONFLICT (id) DO NOTHING;
