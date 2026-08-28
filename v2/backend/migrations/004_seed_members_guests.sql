-- Seed for the new tables. Renewal dates are deliberately spread across
-- overdue / due-soon / far-off so the dashboard counters have something real to
-- report instead of all zeros.

INSERT INTO members (id, chapter_id, name, phone, email, business_field, company,
                     joined_date, renewal_date, status) VALUES
  ('a0000009-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000001',
   'Hendra Gunawan', '081230081001', 'hendra@demo.test', 'Kontraktor Interior', 'CV Karya Mandiri',
   CURRENT_DATE - 400, CURRENT_DATE - 12, 'active'),
  ('a0000009-0000-4000-8000-000000000002', 'a0000004-0000-4000-8000-000000000001',
   'Maya Kusuma', '081230081002', 'maya@demo.test', 'Konsultan Pajak', 'PT Sinar Abadi',
   CURRENT_DATE - 300, CURRENT_DATE + 9, 'active'),
  ('a0000009-0000-4000-8000-000000000003', 'a0000004-0000-4000-8000-000000000001',
   'Bayu Saputra', '081230081003', NULL, 'Digital Marketing', 'PT Nusantara Digital',
   CURRENT_DATE - 250, CURRENT_DATE + 180, 'active'),
  ('a0000009-0000-4000-8000-000000000004', 'a0000004-0000-4000-8000-000000000001',
   'Wulan Permana', '081230081004', NULL, 'Katering & Event', 'Dapur Rasa Catering',
   CURRENT_DATE - 500, CURRENT_DATE + 220, 'inactive'),
  ('a0000009-0000-4000-8000-000000000005', 'a0000004-0000-4000-8000-000000000002',
   'Reza Hartono', '081230081005', NULL, 'Jasa Logistik', 'PT Kargo Lintas',
   CURRENT_DATE - 200, CURRENT_DATE + 30, 'active'),
  ('a0000009-0000-4000-8000-000000000006', 'a0000004-0000-4000-8000-000000000003',
   'Intan Setiawan', '081230081006', NULL, 'Klinik Kecantikan', 'Klinik Ayu Sehat',
   CURRENT_DATE - 150, CURRENT_DATE + 60, 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO guests (id, chapter_id, name, gender, business_field, company, phone,
                    referral_name, meeting_id, visit_date, meeting_format) VALUES
  ('a000000a-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000001',
   'Galih Firmansyah', 'L', 'IT Managed Service', 'PT Solusi Teknologi', '081230089001',
   'Hendra Gunawan', 'a0000007-0000-4000-8000-000000000001', CURRENT_DATE - 7, 'offline'),
  ('a000000a-0000-4000-8000-000000000002', 'a0000004-0000-4000-8000-000000000001',
   'Mira Rahayu', 'P', 'Travel Umroh', 'PT Barokah Wisata', '081230089002',
   'Maya Kusuma', 'a0000007-0000-4000-8000-000000000001', CURRENT_DATE - 7, 'online'),
  ('a000000a-0000-4000-8000-000000000003', 'a0000004-0000-4000-8000-000000000002',
   'Surya Nugroho', 'L', 'Percetakan & Packaging', 'CV Cetak Cepat', '081230089003',
   'Reza Hartono', 'a0000007-0000-4000-8000-000000000003', CURRENT_DATE - 5, 'offline')
ON CONFLICT (id) DO NOTHING;
