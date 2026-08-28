export interface TourStep {
  id: string
  title: string
  body: string
  /** Route to visit before showing the step. */
  route?: string
  /**
   * data-tour value to spotlight. When set and no *visible* element carries it,
   * the step is dropped — that is how the national-only screens stay out of a
   * chapter admin's tour without duplicating the nav's role logic here.
   */
  anchor?: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Selamat datang',
    body: 'Tur singkat ini berkeliling semua fitur. Sekitar satu menit, dan bisa dilewati kapan saja.',
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    body: 'Ringkasan chapter: siapa yang perlu di-follow up, belum punya PIC, dan berapa yang sudah jadi member. Sebaran status visitor ada di bawahnya.',
    anchor: 'nav-/', route: '/',
  },
  {
    id: 'pipeline',
    title: 'Pipeline',
    body: 'Papan kanban perjalanan visitor, dari baru mendaftar sampai jadi member. Geser kartu memakai tombol panah.',
    anchor: 'nav-/pipeline',
  },
  {
    id: 'visitors',
    title: 'Visitor',
    body: 'Daftar lengkap visitor. Bisa dicari, difilter per status, dan diubah PIC-nya langsung dari tabel.',
    anchor: 'nav-/visitors',
  },
  {
    id: 'mcqa',
    title: 'MCQA',
    body: 'Hasil airtime visitor yang sudah hadir. Yang belum hadir tidak muncul di sini, karena mencatat airtime untuk mereka akan merusak laporan.',
    anchor: 'nav-/mcqa',
  },
  {
    id: 'members',
    title: 'Member',
    body: 'Anggota chapter beserta tanggal renewal. Tanggal yang sudah lewat ditandai merah, yang kurang dari tiga puluh hari ditandai kuning.',
    anchor: 'nav-/members',
  },
  {
    id: 'guests',
    title: 'Guest',
    body: 'Tamu yang hadir tanpa melewati alur visitor. Dipisah supaya statistik konversi visitor tetap bersih.',
    anchor: 'nav-/guests',
  },
  {
    id: 'meetings',
    title: 'Weekly Meeting',
    body: 'Jadwal pertemuan mingguan. Setiap visitor terhubung ke satu meeting, dan itu dasar semua laporan kehadiran.',
    anchor: 'nav-/meetings',
  },
  {
    id: 'wa-blast',
    title: 'WA Blast',
    body: 'Menyiapkan pesan WhatsApp beserta tautan konfirmasi. Aplikasi tidak mengirim otomatis — kamu yang menekan kirim.',
    anchor: 'nav-/wa-blast',
  },
  {
    id: 'text-format',
    title: 'Text Format',
    body: 'Editor template pesan. Placeholder seperti nama dan link hadir otomatis terisi saat pesan dibuat.',
    anchor: 'nav-/text-format',
  },
  {
    id: 'transfer',
    title: 'Export dan Import',
    body: 'Unduh data visitor sebagai CSV, atau impor massal dari file. Setiap baris yang gagal dilaporkan beserta alasannya.',
    anchor: 'nav-/transfer',
  },
  {
    id: 'activity',
    title: 'Log Aktivitas',
    body: 'Jejak setiap perubahan data: siapa mengubah apa, dan kapan.',
    anchor: 'nav-/activity',
  },
  {
    id: 'accounts',
    title: 'Kelola Akun',
    body: 'Membuat dan menonaktifkan akun PIC di chapter ini. Chapter admin hanya bisa membuat peran di bawahnya.',
    anchor: 'nav-/accounts',
  },
  {
    id: 'master',
    title: 'Master Wilayah',
    body: 'Khusus national admin: struktur organisasi, kota, area, dan chapter beserta domainnya.',
    anchor: 'nav-/master',
  },
  {
    id: 'policies',
    title: 'Template dan Policy',
    body: 'Khusus national admin: aturan yang berlaku nasional, misalnya batas kunjungan visitor dan masa tenggang renewal.',
    anchor: 'nav-/policies',
  },
  {
    id: 'api-keys',
    title: 'API Keys',
    body: 'Khusus national admin: kunci untuk integrasi eksternal. Kunci aslinya hanya tampil sekali saat dibuat.',
    anchor: 'nav-/api-keys',
  },
  {
    id: 'done',
    title: 'Selesai',
    body: 'Itu semua fitur utamanya. Semua data di sini contoh, jadi bebas dicoba.',
  },
]
