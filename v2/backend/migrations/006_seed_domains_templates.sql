-- localhost maps to the first chapter so a fresh `docker compose up` lands on a
-- branded tenant instead of an unresolved host.
INSERT INTO chapter_domains (chapter_id, domain, type, is_primary) VALUES
  ('a0000004-0000-4000-8000-000000000001', 'localhost:8095',    'localhost', true),
  ('a0000004-0000-4000-8000-000000000001', 'grow.bni-vh.com',   'subdomain', false),
  ('a0000004-0000-4000-8000-000000000002', 'rise.bni-vh.com',   'subdomain', false),
  ('a0000004-0000-4000-8000-000000000003', 'surya.bni-vh.com',  'subdomain', false)
ON CONFLICT (domain) DO NOTHING;

INSERT INTO wa_templates (chapter_id, name, body, is_default) VALUES
  ('a0000004-0000-4000-8000-000000000001', 'Undangan Meeting',
   'Halo {nama}, terima kasih sudah mendaftar di {chapter}.' || chr(10) ||
   'Meeting kita: {meeting} pada {tanggal}.' || chr(10) ||
   'Konfirmasi kehadiran di sini ya: {link_hadir}', true),
  ('a0000004-0000-4000-8000-000000000001', 'Follow Up',
   'Halo {nama}, ini {pic} dari {chapter}. Boleh saya bantu jelaskan lebih lanjut soal meeting kita?', false),
  ('a0000004-0000-4000-8000-000000000002', 'Undangan Meeting',
   'Halo {nama}, sampai jumpa di {meeting} ({tanggal}). Konfirmasi: {link_hadir}', true)
ON CONFLICT (chapter_id, name) DO NOTHING;

-- Backfill an airtime result for the visitors already marked attended so the
-- MCQA screen is not empty on a fresh install.
UPDATE visitors SET attended_choice_number = 1, attended_choice_note = 'Bersedia bergabung'
  WHERE id = 'a0000008-0000-4000-8000-000000000001';
UPDATE visitors SET attended_choice_number = 1, attended_choice_note = 'Bersedia bergabung'
  WHERE id = 'a0000008-0000-4000-8000-000000000002';
