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
  /**
   * What the voice says, when it should differ from what the card shows.
   *
   * Read text and heard text are not the same thing. The card is terse because
   * it sits next to the screen it describes; the voice has no screen, so it has
   * to say what to do rather than name what is there. It also has to avoid
   * pointing — "di bawahnya" means nothing to someone listening — and to spell
   * out what a speech engine mangles: "WA" comes out as two letters, "MCQA" as
   * a word.
   *
   * Absent means the card's own text is spoken, which is right for the steps
   * where the two say the same thing.
   */
  narration?: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Selamat datang',
    body: 'Tur singkat ini berkeliling semua fitur. Sekitar satu menit, dan bisa dilewati kapan saja.',
    narration: 'Selamat datang di BNI Visitor Manager. Saya akan menemani kamu berkeliling, sekitar satu menit. Tekan panah kanan untuk lanjut, atau tombol Escape kalau mau langsung mulai bekerja.',
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    body: 'Ringkasan chapter: siapa yang perlu di-follow up, belum punya PIC, dan berapa yang sudah jadi member. Sebaran status visitor ada di bawahnya.',
    narration: 'Ini Dashboard, halaman pertama yang kamu lihat tiap masuk. Angka-angka di sini menjawab satu pertanyaan: siapa yang perlu dihubungi hari ini. Perhatikan dua kartu berwarna, Perlu Follow Up dan Belum Ada PIC. Kalau keduanya nol, chapter kamu sedang rapi.',
    anchor: 'nav-/', route: '/',
  },
  {
    id: 'pipeline',
    title: 'Pipeline',
    body: 'Papan kanban perjalanan visitor, dari baru mendaftar sampai jadi member. Geser kartu memakai tombol panah.',
    narration: 'Pipeline menampilkan perjalanan visitor sebagai papan. Tiap kolom satu tahap, dari baru mendaftar sampai jadi member. Untuk memindahkan seseorang ke tahap berikutnya, tekan tombol panah di kartunya. Papan ini yang paling cepat kalau kamu sedang merapikan banyak orang sekaligus.',
    anchor: 'nav-/pipeline',
  },
  {
    id: 'visitors',
    title: 'Visitor',
    body: 'Daftar lengkap visitor. Bisa dicari, difilter per status, dan diubah PIC-nya langsung dari tabel.',
    narration: 'Halaman Visitor adalah daftar lengkapnya. Kotak pencarian mencari nama, telepon, email, dan perusahaan sekaligus, jadi kamu tidak perlu ingat yang mana. Status tiap orang bisa langsung diubah dari daftarnya, tanpa membuka halaman lain.',
    anchor: 'nav-/visitors',
  },
  {
    id: 'mcqa',
    title: 'MCQA',
    body: 'Hasil airtime visitor yang sudah hadir. Yang belum hadir tidak muncul di sini, karena mencatat airtime untuk mereka akan merusak laporan.',
    narration: 'Ini layar M C Q A, tempat mencatat hasil Airtime setelah visitor benar-benar hadir. Pilihannya tiga: bersedia bergabung, pikir-pikir dulu, atau tidak tertarik. Yang bersedia bergabung inilah yang lanjut ke proses member.',
    anchor: 'nav-/mcqa',
  },
  {
    id: 'members',
    title: 'Member',
    body: 'Anggota chapter beserta tanggal renewal. Tanggal yang sudah lewat ditandai merah, yang kurang dari tiga puluh hari ditandai kuning.',
    narration: 'Daftar Member menyimpan siapa saja yang sudah bergabung, lengkap dengan tanggal perpanjangan. Tanggal yang berwarna merah sudah lewat, yang kuning tinggal kurang dari tiga puluh hari. Dua warna itu daftar kerja kamu.',
    anchor: 'nav-/members',
  },
  {
    id: 'guests',
    title: 'Guest',
    body: 'Tamu yang hadir tanpa melewati alur visitor. Dipisah supaya statistik konversi visitor tetap bersih.',
    narration: 'Guest untuk tamu yang datang tanpa lewat jalur visitor, misalnya tamu undangan pembicara. Dicatat terpisah supaya angka konversi visitor tidak ikut berubah karenanya.',
    anchor: 'nav-/guests',
  },
  {
    id: 'meetings',
    title: 'Weekly Meeting',
    body: 'Jadwal pertemuan mingguan. Setiap visitor terhubung ke satu meeting, dan itu dasar semua laporan kehadiran.',
    narration: 'Meeting adalah jadwal pertemuan mingguan chapter. Setiap visitor bisa dikaitkan ke satu meeting, dan dari situlah kehadiran dihitung. Pertemuan yang belum berlangsung ditandai supaya mudah dibedakan.',
    anchor: 'nav-/meetings',
  },
  {
    id: 'wa-blast',
    title: 'WA Blast',
    body: 'Menyiapkan pesan WhatsApp beserta tautan konfirmasi. Aplikasi tidak mengirim otomatis — kamu yang menekan kirim.',
    narration: 'Ini WhatsApp Blast. Pilih siapa yang mau dikirimi, pilih templatenya, lalu aplikasi menyiapkan pesannya satu per satu dengan nama masing-masing sudah terisi. Pengirimannya tetap lewat WhatsApp kamu sendiri.',
    anchor: 'nav-/wa-blast',
  },
  {
    id: 'text-format',
    title: 'Text Format',
    body: 'Editor template pesan. Placeholder seperti nama dan link hadir otomatis terisi saat pesan dibuat.',
    narration: 'Text Format tempat menyimpan template pesan. Tulisan dalam kurung kurawal akan diganti otomatis, misalnya nama dan tanggal. Kalau ada kurung kurawal yang tidak dikenali, dia sengaja dibiarkan terlihat supaya salah ketik ketahuan sebelum pesannya terkirim.',
    anchor: 'nav-/text-format',
  },
  {
    id: 'transfer',
    title: 'Export dan Import',
    body: 'Unduh data visitor sebagai CSV, atau impor massal dari file. Setiap baris yang gagal dilaporkan beserta alasannya.',
    narration: 'Export dan Import untuk memindahkan data dalam jumlah banyak. Unduhannya tersedia dalam Excel maupun C S V, dan hasil unduhan itu bisa langsung diimpor kembali. Saat mengimpor, format file dikenali dari isinya, jadi salah nama file tidak masalah.',
    anchor: 'nav-/transfer',
  },
  {
    id: 'activity',
    title: 'Log Aktivitas',
    body: 'Jejak setiap perubahan data: siapa mengubah apa, dan kapan.',
    narration: 'Log Aktivitas mencatat setiap perubahan data, siapa yang mengubah dan kapan. Kalau ada yang terasa janggal, ini tempat pertama untuk melihat apa yang sebenarnya terjadi.',
    anchor: 'nav-/activity',
  },
  {
    id: 'accounts',
    title: 'Kelola Akun',
    body: 'Membuat dan menonaktifkan akun PIC di chapter ini. Chapter admin hanya bisa membuat peran di bawahnya.',
    narration: 'Halaman Akun untuk mengelola pengguna di chapter kamu, biasanya menambah P I C baru. Akun tidak bisa dihapus, hanya dinonaktifkan, supaya jejak pekerjaan mereka di log tetap utuh.',
    anchor: 'nav-/accounts',
  },
  {
    id: 'master',
    title: 'Master Wilayah',
    body: 'Khusus national admin: struktur organisasi, kota, area, dan chapter beserta domainnya.',
    narration: 'Master Wilayah mengatur kota, area, dan chapter. Ini hanya untuk akun nasional, karena perubahannya berpengaruh ke seluruh organisasi.',
    anchor: 'nav-/master',
  },
  {
    id: 'policies',
    title: 'Template dan Policy',
    body: 'Khusus national admin: aturan yang berlaku nasional, misalnya batas kunjungan visitor dan masa tenggang renewal.',
    narration: 'Policy menyimpan aturan yang berlaku nasional, misalnya berapa kali seorang visitor boleh datang sebelum harus memutuskan, dan berapa lama masa tenggang perpanjangan member.',
    anchor: 'nav-/policies',
  },
  {
    id: 'api-keys',
    title: 'API Keys',
    body: 'Khusus national admin: kunci untuk integrasi eksternal. Kunci aslinya hanya tampil sekali saat dibuat.',
    narration: 'API Keys untuk integrasi dengan sistem lain, misalnya sistem keuangan yang perlu membaca status member. Kunci hanya ditampilkan sekali saat dibuat, jadi salin dulu sebelum menutup layarnya. Kalau hilang, terbitkan yang baru.',
    anchor: 'nav-/api-keys',
  },
  {
    id: 'api-docs',
    title: 'Dokumentasi API',
    body: 'Panduan lengkap untuk yang memegang kunci: endpoint, scope, contoh, dan arti tiap kode error.',
    narration: 'Dan ini dokumentasinya, untuk siapa pun yang memegang kunci tadi. Isinya alamat dasar, cara mengirim kuncinya, semua endpoint yang tersedia, beserta contoh yang bisa langsung disalin dan dijalankan.',
    anchor: 'nav-/api-docs', route: '/api-docs',
  },
  {
    id: 'assistant',
    title: 'Asisten',
    body: 'Tanya apa saja soal data chapter — follow up, konversi, kehadiran. Jawabannya dihitung dari angka yang kamu punya.',
    narration: 'Tombol di pojok kanan bawah membuka asisten. Tanyakan apa saja soal data chapter kamu: siapa yang perlu follow up, berapa konversinya, bagaimana kehadirannya. Jawabannya dihitung dari angka yang benar-benar ada, bukan ditebak.',
    anchor: 'assistant',
  },
  {
    id: 'done',
    title: 'Selesai',
    body: 'Itu semua fitur utamanya. Semua data di sini contoh, jadi bebas dicoba.',
    narration: 'Sekian tur singkatnya. Tombol Tour di kanan atas selalu ada kalau kamu mau mengulang. Dan kalau ada yang ingin ditanyakan tentang data chapter, gunakan tombol asisten di pojok kanan bawah.',
  },
]
