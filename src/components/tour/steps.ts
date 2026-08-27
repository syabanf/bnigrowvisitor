export interface TourStep {
  id: string
  title: string
  body: string
  // Where the step lives. Chapter routes are resolved at runtime against the
  // active chapter, so these are the plain fallback paths.
  route?: string
  // data-tour value to spotlight. When set and no *visible* element carries it,
  // the step is skipped — that's how role-specific menu entries (Akun PIC, Log)
  // drop out of the tour without duplicating the sidebar's role logic here.
  anchor?: string
}

export const CHAPTER_TOUR: TourStep[] = [
  {
    id: 'welcome',
    title: 'Selamat datang 👋',
    body: 'Tur singkat ini keliling semua fitur utama. Sekitar 1 menit — bisa dilewati kapan saja.',
  },
  {
    id: 'chapter-dashboard',
    title: 'Chapter Dashboard',
    body: 'Ringkasan harian chapter: siapa yang perlu di-follow up, belum punya PIC, dan siap dikirimi WA. Conversion funnel di bawahnya menunjukkan perjalanan visitor sampai jadi member.',
    anchor: 'chapter-dashboard',
    route: '/chapter-dashboard',
  },
  {
    id: 'kanban',
    title: 'Pipeline',
    body: 'Papan kanban visitor dari "Baru Daftar" sampai "Jadi Member". Geser kartu lewat tombol Next untuk menaikkan status.',
    anchor: 'kanban',
  },
  {
    id: 'visitors',
    title: 'Visitor',
    body: 'Daftar lengkap visitor: cari, filter per status/meeting/PIC, assign PIC, kirim WA, dan export CSV. Tombol WA memakai template yang berisi link konfirmasi kehadiran.',
    anchor: 'visitors',
    route: '/visitors',
  },
  {
    id: 'guests',
    title: 'Guest',
    body: 'Tamu yang hadir tanpa lewat alur visitor — biasanya hasil impor dari laporan BNI. Terpisah supaya statistik visitor tetap bersih.',
    anchor: 'guests',
  },
  {
    id: 'attended',
    title: 'MCQA',
    body: 'Hasil airtime tiap visitor yang hadir: bersedia bergabung, ingin datang lagi, atau belum tertarik.',
    anchor: 'attended',
  },
  {
    id: 'members',
    title: 'Member',
    body: 'Data anggota chapter beserta tanggal renewal. Member yang lewat jatuh tempo ditandai supaya bisa ditindaklanjuti.',
    anchor: 'members',
    route: '/members',
  },
  {
    id: 'wa-blast',
    title: 'WA Blast',
    body: 'Kirim WhatsApp ke banyak visitor sekaligus — misalnya mengingatkan yang belum konfirmasi menjelang meeting.',
    anchor: 'wa-blast',
  },
  {
    id: 'export-import',
    title: 'Export / Import',
    body: 'Impor visitor dan member massal dari file laporan BNI, atau tarik data keluar sebagai CSV/Excel.',
    anchor: 'export-import',
  },
  {
    id: 'text-format',
    title: 'Text Format',
    body: 'Atur template pesan WhatsApp. Variabel seperti {nama} dan {link_hadir} otomatis terisi saat pesan dibuat.',
    anchor: 'text-format',
  },
  {
    id: 'pic',
    title: 'Kelola PIC',
    body: 'Atur siapa yang bertanggung jawab atas tiap visitor, lengkap dengan klasifikasi bidang usaha.',
    anchor: 'pic',
  },
  {
    id: 'weekly',
    title: 'Weekly Meeting',
    body: 'Kelola jadwal meeting mingguan. Setiap visitor terhubung ke satu meeting, dan itu dasar semua laporan kehadiran.',
    anchor: 'weekly',
  },
  {
    id: 'pic-accounts',
    title: 'Akun PIC',
    body: 'Khusus Chapter Admin: buat akun PIC, atur password, aktif/nonaktifkan. PIC chapter lain tidak bisa diakses.',
    anchor: 'pic-accounts',
  },
  {
    id: 'logs',
    title: 'Log Aktivitas',
    body: 'Jejak audit setiap perubahan data — siapa mengubah apa dan kapan.',
    anchor: 'logs',
  },
  {
    id: 'assistant',
    title: 'Asisten AI',
    body: 'Tanya apa saja soal data chapter dengan bahasa biasa — "berapa visitor yang belum follow up?" Asisten hanya membaca data chapter ini.',
    anchor: 'assistant',
  },
  {
    id: 'done',
    title: 'Selesai 🎉',
    body: 'Itu semua fitur utamanya. Semua data di sini dummy, jadi bebas dicoba — klik, ubah, hapus, tidak ada yang rusak.',
  },
]

export const NATIONAL_TOUR: TourStep[] = [
  {
    id: 'welcome',
    title: 'Selamat datang 👋',
    body: 'Tur singkat fitur National Admin. Sekitar 1 menit — bisa dilewati kapan saja.',
  },
  {
    id: 'national-overview',
    title: 'Dashboard Nasional',
    body: 'Ringkasan seluruh chapter: total visitor, konversi member, kehadiran, dan health score per chapter. Alert Center menandai chapter yang perlu perhatian.',
    anchor: 'national-overview',
    route: '/national-overview',
  },
  {
    id: 'national-dashboard',
    title: 'Manage Chapter',
    body: 'Tambah dan kelola chapter, termasuk penempatannya di kota/area dan domain yang dipakai.',
    anchor: 'national-dashboard',
  },
  {
    id: 'master',
    title: 'Master Wilayah',
    body: 'Struktur wilayah: organisasi → kota → area → chapter, beserta daftar domain tiap chapter.',
    anchor: 'master',
  },
  {
    id: 'national-governance',
    title: 'Governance & Audit',
    body: 'Riwayat login dan jejak aktivitas lintas chapter untuk keperluan audit.',
    anchor: 'national-governance',
  },
  {
    id: 'national-policies',
    title: 'Template & Policy',
    body: 'Aturan yang berlaku nasional — misalnya batas kunjungan visitor dalam periode tertentu, dan masa tenggang renewal member.',
    anchor: 'national-policies',
  },
  {
    id: 'national-api-keys',
    title: 'API Keys',
    body: 'Kunci akses untuk integrasi eksternal, misalnya sistem keuangan yang membaca data renewal member.',
    anchor: 'national-api-keys',
  },
  {
    id: 'assistant',
    title: 'BNI Assistant',
    body: 'Tanya data lintas chapter dengan bahasa biasa. Di scope nasional, asisten bisa membaca data semua chapter.',
    anchor: 'assistant',
  },
  {
    id: 'done',
    title: 'Selesai 🎉',
    body: 'Itu semua fitur utamanya. Semua data di sini dummy, jadi bebas dicoba.',
  },
]
